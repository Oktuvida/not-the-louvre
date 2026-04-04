import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import {
	compactDrawingDocumentLosslessly,
	resolveSafeRasterGuardPreset,
	type LosslessCompactionOptions,
	type SafeRasterGuardPresetId
} from './compaction';
import {
	DEFAULT_DRAWING_DOCUMENT_LIMITS,
	assertDrawingDocumentWithinLimits,
	normalizeDrawingDocumentToEditableV2,
	serializeEditableDrawingDocument,
	type DrawingDocument,
	type DrawingDocumentLimits
} from './document';

type DecompressOptions = {
	maxCompressedBytes?: number;
	maxOutputBytes?: number;
};

export type CompressDrawingDocumentOptions = {
	compaction?: LosslessCompactionOptions;
	rasterGuardPresetId?: SafeRasterGuardPresetId;
};

const encodeBase64 = (payload: Uint8Array) => {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(payload).toString('base64');
	}

	let binary = '';
	for (const byte of payload) {
		binary += String.fromCharCode(byte);
	}

	return globalThis.btoa(binary);
};

const decodeBase64 = (payload: string) => {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(payload, 'base64'));
	}

	const binary = globalThis.atob(payload);
	const decoded = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		decoded[index] = binary.charCodeAt(index);
	}

	return decoded;
};

export const compressDrawingDocument = (
	document: DrawingDocument,
	limits: DrawingDocumentLimits = DEFAULT_DRAWING_DOCUMENT_LIMITS,
	options: CompressDrawingDocumentOptions = {}
) => {
	const parsedDocument = assertDrawingDocumentWithinLimits(document, limits);
	const editableDocument = normalizeDrawingDocumentToEditableV2(parsedDocument);
	const compactionOptions = options.compaction
		? {
				maxStrokeCoveragePixels: options.compaction.maxStrokeCoveragePixels ?? null
			}
		: options.rasterGuardPresetId
			? {
					maxStrokeCoveragePixels: resolveSafeRasterGuardPreset(options.rasterGuardPresetId, {
						height: editableDocument.height,
						width: editableDocument.width
					}).maxStrokeCoveragePixels
				}
			: null;
	const documentToPersist = compactionOptions
		? compactDrawingDocumentLosslessly(editableDocument, compactionOptions)
		: editableDocument;
	const compressed = gzipSync(strToU8(serializeEditableDrawingDocument(documentToPersist)));

	assertDrawingDocumentWithinLimits(documentToPersist, {
		...limits,
		compressedBytes: compressed.byteLength
	});

	return new Uint8Array(compressed);
};

export const encodeCompressedDrawingDocument = (
	document: DrawingDocument,
	limits: DrawingDocumentLimits = DEFAULT_DRAWING_DOCUMENT_LIMITS,
	options: CompressDrawingDocumentOptions = {}
) => encodeBase64(compressDrawingDocument(document, limits, options));

export const decompressDrawingDocument = (payload: Uint8Array, options: DecompressOptions = {}) => {
	const maxCompressedBytes =
		options.maxCompressedBytes ?? DEFAULT_DRAWING_DOCUMENT_LIMITS.maxCompressedBytes;
	const maxOutputBytes =
		options.maxOutputBytes ?? DEFAULT_DRAWING_DOCUMENT_LIMITS.maxDecompressedBytes;

	if (payload.byteLength > maxCompressedBytes) {
		throw new Error(`Drawing document exceeds max compressed bytes of ${maxCompressedBytes}`);
	}

	let decompressed: Uint8Array;

	try {
		decompressed = gunzipSync(payload);
	} catch {
		throw new Error('Failed to decompress drawing document');
	}

	if (decompressed.byteLength > maxOutputBytes) {
		throw new Error(`Drawing document exceeds max output bytes of ${maxOutputBytes}`);
	}

	return strFromU8(decompressed);
};

export const decodeCompressedDrawingDocument = (
	payload: string,
	options: DecompressOptions = {}
) => {
	if (!payload.trim()) {
		throw new Error('Drawing document payload is required');
	}

	return decompressDrawingDocument(decodeBase64(payload), options);
};
