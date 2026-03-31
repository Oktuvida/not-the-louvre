import { gunzipSync, gzipSync } from 'node:zlib';
import {
	DEFAULT_DRAWING_DOCUMENT_LIMITS,
	assertDrawingDocumentWithinLimits,
	serializeDrawingDocument,
	type DrawingDocumentLimits,
	type DrawingDocumentV1
} from './document';

type DecompressOptions = {
	maxCompressedBytes?: number;
	maxOutputBytes?: number;
};

export const compressDrawingDocument = (
	document: DrawingDocumentV1,
	limits: DrawingDocumentLimits = DEFAULT_DRAWING_DOCUMENT_LIMITS
) => {
	const parsedDocument = assertDrawingDocumentWithinLimits(document, limits);
	const compressed = gzipSync(serializeDrawingDocument(parsedDocument));

	assertDrawingDocumentWithinLimits(parsedDocument, {
		...limits,
		compressedBytes: compressed.byteLength
	});

	return new Uint8Array(compressed);
};

export const encodeCompressedDrawingDocument = (
	document: DrawingDocumentV1,
	limits: DrawingDocumentLimits = DEFAULT_DRAWING_DOCUMENT_LIMITS
) => Buffer.from(compressDrawingDocument(document, limits)).toString('base64');

export const decompressDrawingDocument = (payload: Uint8Array, options: DecompressOptions = {}) => {
	const maxCompressedBytes =
		options.maxCompressedBytes ?? DEFAULT_DRAWING_DOCUMENT_LIMITS.maxCompressedBytes;
	const maxOutputBytes =
		options.maxOutputBytes ?? DEFAULT_DRAWING_DOCUMENT_LIMITS.maxDecompressedBytes;

	if (payload.byteLength > maxCompressedBytes) {
		throw new Error(`Drawing document exceeds max compressed bytes of ${maxCompressedBytes}`);
	}

	let decompressed: Buffer;

	try {
		decompressed = gunzipSync(payload);
	} catch {
		throw new Error('Failed to decompress drawing document');
	}

	if (decompressed.byteLength > maxOutputBytes) {
		throw new Error(`Drawing document exceeds max output bytes of ${maxOutputBytes}`);
	}

	return decompressed.toString('utf-8');
};

export const decodeCompressedDrawingDocument = (
	payload: string,
	options: DecompressOptions = {}
) => {
	if (!payload.trim()) {
		throw new Error('Drawing document payload is required');
	}

	return decompressDrawingDocument(new Uint8Array(Buffer.from(payload, 'base64')), options);
};
