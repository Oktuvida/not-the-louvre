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
import {
	decodeDrawingV3,
	encodeDrawingV3,
	type InkDocument,
	type ParentReference
} from '#lib/stroke/v3.js';
import { fromInkDocument, toInkDocument } from '#lib/features/stroke-json/ink-document.js';

// Drawings are stored gzipped (document-store.ts keeps the bytes): a v3
// drawing as v3, with its time and pressure, and an older one as the canonical
// version 2 document it always was.
export type PreparedDrawingDocument = {
	compressed: Uint8Array<ArrayBuffer>;
	document: DrawingDocumentV2;
	version: 2 | 3;
};

const isVersion3 = (json: string) => {
	try {
		const value: unknown = JSON.parse(json);
		return typeof value === 'object' && value !== null && 'version' in value && value.version === 3;
	} catch {
		return false;
	}
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
	documentJson: string,
	options: { parent?: ParentReference } = {}
): Promise<PreparedDrawingDocument> => {
	try {
		if (isVersion3(documentJson)) {
			// The parent is the server's to name: a client only says which artwork.
			const decoded = decodeDrawingV3(JSON.parse(documentJson));
			delete decoded.parent;
			const drawing = options.parent ? { ...decoded, parent: options.parent } : decoded;
			const compressed = await encodeLegacyPayload(JSON.stringify(encodeDrawingV3(drawing)));
			return { compressed, document: fromInkDocument(drawing), version: 3 };
		}

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
		const json = await decodeLegacyPayload(compressed);
		return isVersion3(json)
			? fromInkDocument(decodeDrawingV3(JSON.parse(json)))
			: toEditableV2(parseLegacyDocument(json));
	} catch (error) {
		throw toArtworkFlowError(error);
	}
};

/** A stored drawing as it was drawn: v3 with its timing, or an older one without. */
export const decodeInkDocument = async (
	compressed: Uint8Array<ArrayBuffer>
): Promise<InkDocument> => {
	try {
		const json = await decodeLegacyPayload(compressed);
		return isVersion3(json)
			? decodeDrawingV3(JSON.parse(json))
			: toInkDocument(toEditableV2(parseLegacyDocument(json)));
	} catch (error) {
		throw toArtworkFlowError(error);
	}
};
