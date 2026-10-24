import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { drawingDocumentKey } from './document-key';
import type { DrawingDocumentStore } from './document-store';

/** An in-memory DrawingDocumentStore for service unit tests, keyed like the real one. */
export const createMemoryDrawingDocumentStore = () => {
	const objects = new Map<string, Uint8Array<ArrayBuffer>>();

	const store: DrawingDocumentStore = {
		async put(compressed) {
			const key = await drawingDocumentKey(compressed);
			objects.set(key, compressed);
			return key;
		},
		async read(key) {
			const object = objects.get(key);
			if (!object) {
				throw new ArtworkFlowError(404, 'Drawing document not found', 'NOT_FOUND');
			}
			return object;
		}
	};

	return { objects, store };
};
