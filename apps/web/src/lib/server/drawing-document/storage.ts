import type { DrawingDocumentV2 } from '$lib/features/stroke-json/document';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	decodeLegacyPayload,
	encodeLegacyPayload,
	parseLegacyDocument,
	StrokeDocumentError,
	toCanonicalV2,
	toEditableV2
} from '$lib/stroke/legacy';

// Drawings are stored as canonical version 2 documents, gzipped and base64-encoded
// (chunked-write.ts explains why the text is written in pieces).
export type PreparedDrawingDocument = {
	compressedDocumentBase64: string;
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
		return {
			compressedDocumentBase64: Buffer.from(compressed).toString('base64'),
			document,
			version: 2
		};
	} catch (error) {
		throw toArtworkFlowError(error);
	}
};

export const decodeCompressedDrawingDocumentToEditableDocument = async (
	payloadBase64: string
): Promise<DrawingDocumentV2> => {
	try {
		const payload = Uint8Array.from(Buffer.from(payloadBase64, 'base64'));
		return toEditableV2(parseLegacyDocument(await decodeLegacyPayload(payload)));
	} catch (error) {
		throw toArtworkFlowError(error);
	}
};
