import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedGalleryArtworks } from '#lib/server/e2e/seed.js';

// `__PLAYWRIGHT__` is a build-time constant: true only in the e2e build, so this
// route cannot write anything in a production Worker.
export const POST: RequestHandler = async ({ request }) => {
	if (!__PLAYWRIGHT__) throw error(404, 'Not found');

	const { count = 30 } = (await request.json()) as { count?: number };
	return Response.json(await seedGalleryArtworks(count));
};
