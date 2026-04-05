import {
	createServerStrokeJsonRuntime,
	StrokeJsonRuntimeError,
	type StrokeJsonStorageDocument
} from '@not-the-louvre/stroke-json-runtime/server';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	parseDrawingDocumentV2,
	parseEditableDrawingDocumentV2,
	type DrawingDocumentV2
} from './document';

export const strokeJsonServerRuntime = createServerStrokeJsonRuntime();

export type PreparedServerStorageDrawingDocument = StrokeJsonStorageDocument & {
	document: DrawingDocumentV2;
};

export const toArtworkFlowError = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return error;
	}

	if (error instanceof StrokeJsonRuntimeError) {
		switch (error.code) {
			case 'document_limits_exceeded':
				return new ArtworkFlowError(
					413,
					'Drawing document is too large',
					'DRAWING_DOCUMENT_TOO_LARGE'
				);
			case 'invalid_document':
			case 'invalid_options':
			case 'invalid_payload':
				return new ArtworkFlowError(400, 'Invalid drawing document', 'INVALID_DRAWING_DOCUMENT');
			default:
				return new ArtworkFlowError(500, 'Drawing runtime failed', 'DRAWING_RUNTIME_FAILED');
		}
	}

	return new ArtworkFlowError(500, 'Drawing runtime failed', 'DRAWING_RUNTIME_FAILED');
};

export const decodeCompressedDrawingDocumentToEditableDocument = async (payloadBase64: string) =>
	parseEditableDrawingDocumentV2(
		await strokeJsonServerRuntime.decodeEditableDocument(payloadBase64)
	);

export const prepareDrawingDocumentForStorage = async (
	documentJson: string
): Promise<PreparedServerStorageDrawingDocument> => {
	try {
		const prepared = await strokeJsonServerRuntime.prepareStorageDocument(documentJson);

		return {
			...prepared,
			document: parseDrawingDocumentV2(prepared.canonicalDocumentJson)
		};
	} catch (error) {
		throw toArtworkFlowError(error);
	}
};
