import type { DrawingDocumentV2 } from '#lib/features/stroke-json/document.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { contentHash } from '#lib/server/media/content-hash.js';
import { requireAppBucket } from '#lib/server/media/object-storage.js';
import { decodeDrawingDocument } from './storage';

/*
 * Drawings live in the app's bucket as gzipped canonical JSON, named after
 * their SHA-256: the same drawing always gets the same key, so a retried save
 * rewrites identical bytes and a fork that changes nothing shares its parent's
 * object. A row only holds the key, which it gets in the same statement that
 * creates it, so a drawing is never half written; and Supavisor, which drops
 * sessions whose Bind carries a whole drawing, never sees one.
 */

export type DrawingDocumentStore = {
	put(compressed: Uint8Array<ArrayBuffer>): Promise<string>;
	read(key: string): Promise<Uint8Array<ArrayBuffer>>;
};

export const drawingDocumentStore: DrawingDocumentStore = {
	async put(compressed) {
		const key = `documents/${await contentHash(compressed)}.json.gz`;
		await requireAppBucket().put(key, compressed.slice().buffer, {
			httpMetadata: { contentType: 'application/gzip' }
		});
		return key;
	},

	async read(key) {
		const object = await requireAppBucket().get(key);
		if (!object) {
			throw new ArtworkFlowError(404, 'Drawing document not found', 'NOT_FOUND');
		}
		return new Uint8Array(await new Response(object.body).arrayBuffer());
	}
};

/** Where a row's drawing is: its storage key, or the inline column it predates. */
export type StoredDrawingDocumentRef = {
	key: string | null;
	legacyBase64: string | null;
	version: number | null;
};

/** The drawing a row names, ready to edit, or null when it has none. */
export const openStoredDrawingDocument = async (
	ref: StoredDrawingDocumentRef,
	store: DrawingDocumentStore = drawingDocumentStore
): Promise<DrawingDocumentV2 | null> => {
	if (ref.key) {
		return decodeDrawingDocument(await store.read(ref.key));
	}

	// Rows written before drawings moved to the bucket keep them inline until
	// the migration copies them across. Their version was written last, so a
	// drawing without one is a torn write and reads as no drawing.
	if (ref.legacyBase64 && ref.version !== null) {
		return decodeDrawingDocument(Uint8Array.from(Buffer.from(ref.legacyBase64, 'base64')));
	}

	return null;
};
