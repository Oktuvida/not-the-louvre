import { json } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { listArtworkDiscovery } from '$lib/server/artwork/read.service';
import { publishArtwork } from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork publish failed' }, { status: 500 });
};

export const POST: RequestHandler = async (event) => {
	const formData = await event.request.formData();
	const media = formData.get('media');

	if (!(media instanceof File)) {
		return json(
			{ code: 'INVALID_MEDIA_FORMAT', message: 'Artwork media must be provided' },
			{ status: 400 }
		);
	}

	try {
		const artwork = await publishArtwork(
			{
				media,
				parentArtworkId: formData.get('parentArtworkId')?.toString(),
				title: formData.get('title')?.toString()
			},
			{
				ipAddress: getIp(event.request, auth.options),
				user: event.locals.user
			}
		);

		return json({ artwork }, { status: 201 });
	} catch (error) {
		return toErrorResponse(error);
	}
};

export const GET: RequestHandler = async (event) => {
	const sort = event.url.searchParams.get('sort') ?? 'recent';
	const window = event.url.searchParams.get('window');
	const cursor = event.url.searchParams.get('cursor');
	const limitValue = event.url.searchParams.get('limit');
	const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

	try {
		const discovery = await listArtworkDiscovery(
			{ cursor, limit, sort: sort as never, window },
			{ user: event.locals.user }
		);
		return json(discovery);
	} catch (error) {
		return toErrorResponse(error);
	}
};
