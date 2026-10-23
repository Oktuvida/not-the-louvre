import type { DrawingDocumentV2 } from '#lib/features/stroke-json/document.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import {
	decodeLegacyPayload,
	encodeLegacyPayload,
	parseLegacyDocument,
	StrokeDocumentError,
	toCanonicalV2,
	toEditableV2
} from '#lib/stroke/legacy.js';

// Drawings are stored as canonical version 2 documents, gzipped
// (document-store.ts keeps the bytes).
export type PreparedDrawingDocument = {
	compressed: Uint8Array<ArrayBuffer>;
	document: DrawingDocumentV2;
	version: 2;
};

export const toArtworkFlowError = (error: unknown) => {
	if (error instanceof ArtworkFlowError) return error;
	if (error instanceof StrokeDocumentError) {
		return error.code === 'LIMITS_EXCEEDED'
			? new ArtworkFlowError(413, 'Drawing document is too large', 'DRAWING_DOCUMENT_TOO_LARGE')
			: new ArtworkFlowError(400, 'Invalid drawing document', 'INVALID_DRAWING_DOCUMENT');
	}
	return new ArtworkFlowError(500, 'Drawing runtime failed', 'DRAWING_RUNTIME_FAILED');
};

export const prepareDrawingDocumentForStorage = async (
	documentJson: string
): Promise<PreparedDrawingDocument> => {
	try {
		const document = toCanonicalV2(parseLegacyDocument(documentJson));
		const compressed = await encodeLegacyPayload(JSON.stringify(document));
		return { compressed, document, version: 2 };
	} catch (error) {
		throw toArtworkFlowError(error);
	}
};

export const decodeDrawingDocument = async (
	compressed: Uint8Array<ArrayBuffer>
): Promise<DrawingDocumentV2> => {
	try {
		return toEditableV2(parseLegacyDocument(await decodeLegacyPayload(compressed)));
	} catch (error) {
		throw toArtworkFlowError(error);
	}
};
