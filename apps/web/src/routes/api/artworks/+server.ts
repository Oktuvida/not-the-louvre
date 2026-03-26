import { json } from '@sveltejs/kit';
import { getIp } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { publishArtwork } from '$lib/server/artwork/service';

const toErrorResponse = (error: unknown) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json({ code: 'PUBLISH_FAILED', message: 'Artwork publish failed' }, { status: 500 });
};

export const POST = async (event) => {
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
