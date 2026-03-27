import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { avatarService } from '$lib/server/user/avatar.service';
import { userRepository } from '$lib/server/user/repository';
import { streamAvatarStorageObject } from '$lib/server/user/storage';

export const GET: RequestHandler = async (event) => {
	try {
		const user = await userRepository.findUserById(event.params.userId);

		if (!user || !user.avatarUrl) {
			return new Response('Avatar not found', { status: 404 });
		}

		const upstream = await streamAvatarStorageObject(user.avatarUrl);
		const headers = new Headers();
		headers.set('content-type', 'image/avif');
		headers.set('cache-control', 'public, max-age=300');

		return new Response(upstream.body, { headers, status: 200 });
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Avatar media read failed', { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const formData = await event.request.formData();
		const file = formData.get('file');

		if (!(file instanceof File)) {
			return new Response('Missing file field in form data', { status: 400 });
		}

		const updated = await avatarService.uploadAvatar(event.locals.user ?? null, file);

		return Response.json({ avatarUrl: updated.avatarUrl });
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Avatar upload failed', { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const updated = await avatarService.deleteAvatar(event.locals.user ?? null);

		return Response.json({ avatarUrl: updated.avatarUrl });
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return new Response(error.message, { status: error.status });
		}

		return new Response('Avatar deletion failed', { status: 500 });
	}
};
