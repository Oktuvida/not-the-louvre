import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import type { ArtworkStorage } from '#lib/server/artwork/types.js';
import { mediaBucket, type MediaBucket } from '#lib/server/platform.js';

/*
 * Artwork and avatar images live in the MEDIA R2 bucket, one key prefix each.
 * `wrangler dev` and the test suites emulate the bucket locally, so every
 * environment runs this same code.
 */

const requireBucket = (): MediaBucket => {
	const bucket = mediaBucket();

	if (!bucket) {
		throw new ArtworkFlowError(500, 'Media storage is not configured', 'STORAGE_FAILED');
	}

	return bucket;
};

export const createObjectStorage = (options: { notFoundMessage: string }) => {
	const storage: ArtworkStorage = {
		async upload(key, file) {
			await requireBucket().put(key, await file.arrayBuffer(), {
				httpMetadata: { contentType: file.type }
			});
		},

		async delete(key) {
			await requireBucket().delete(key);
		}
	};

	const stream = async (key: string) => {
		const object = await requireBucket().get(key);

		if (!object) {
			throw new ArtworkFlowError(404, options.notFoundMessage, 'NOT_FOUND');
		}

		return new Response(object.body, {
			headers: {
				'content-length': String(object.size),
				'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream'
			}
		});
	};

	return { storage, stream };
};

/** Empties the bucket. Only the e2e reset route calls it, against local R2. */
export const deleteAllMediaObjects = async () => {
	const bucket = requireBucket();
	let cursor: string | undefined;

	do {
		const page = await bucket.list({ cursor });
		if (page.objects.length > 0) {
			await bucket.delete(page.objects.map((object) => object.key));
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
};
