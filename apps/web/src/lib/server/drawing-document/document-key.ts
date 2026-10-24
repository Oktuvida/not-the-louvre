import { contentHash } from '#lib/server/media/content-hash.js';

/** Where a gzipped drawing lives in the bucket: named after its own bytes. */
export const drawingDocumentKey = async (compressed: Uint8Array<ArrayBuffer>) =>
	`documents/${await contentHash(compressed)}.json.gz`;
