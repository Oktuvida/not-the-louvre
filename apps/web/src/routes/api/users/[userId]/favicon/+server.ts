import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { renderAvatarFaviconPng } from '$lib/server/user/favicon';
import { userRepository } from '$lib/server/user/repository';
import { streamAvatarStorageObject } from '$lib/server/user/storage';

const toErrorResponse = (error: unknown, fallback: { code: string; message: string }) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json(fallback, { status: 500 });
};

export const GET: RequestHandler = async (event) => {
	try {
		const user = await userRepository.findUserById(event.params.userId);

		if (!user || !user.avatarUrl) {
			return json({ code: 'NOT_FOUND', message: 'Avatar not found' }, { status: 404 });
		}

		const upstream = await streamAvatarStorageObject(user.avatarUrl);
		const sourceBuffer = Buffer.from(await upstream.arrayBuffer());
		const faviconBuffer = await renderAvatarFaviconPng(sourceBuffer);
		const headers = new Headers();

		headers.set('cache-control', 'public, max-age=300');
		headers.set('content-type', 'image/png');

		return new Response(new Uint8Array(faviconBuffer), { headers, status: 200 });
	} catch (error) {
		return toErrorResponse(error, {
			code: 'AVATAR_READ_FAILED',
			message: 'Avatar media read failed'
		});
	}
};
