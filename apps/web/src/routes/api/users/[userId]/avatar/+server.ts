import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { avatarService } from '$lib/server/user/avatar.service';
import { userRepository } from '$lib/server/user/repository';
import { streamAvatarStorageObject } from '$lib/server/user/storage';
import { resolveUserAvatarUrl } from '$lib/user/avatar-url';

const toErrorResponse = (error: unknown, fallback: { code: string; message: string }) => {
	if (error instanceof ArtworkFlowError) {
		return json({ code: error.code, message: error.message }, { status: error.status });
	}

	return json(fallback, { status: 500 });
};

export const GET: RequestHandler = async (event) => {
	try {
		const user = await userRepository.findUserById(event.params.userId);

		if (!user || !user.avatarUrl || user.avatarIsHidden) {
			return json({ code: 'NOT_FOUND', message: 'Avatar not found' }, { status: 404 });
		}

		const upstream = await streamAvatarStorageObject(user.avatarUrl);
		const headers = new Headers();
		headers.set('content-type', 'image/avif');
		headers.set('cache-control', 'public, max-age=300');

		return new Response(upstream.body, { headers, status: 200 });
	} catch (error) {
		return toErrorResponse(error, {
			code: 'AVATAR_READ_FAILED',
			message: 'Avatar media read failed'
		});
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const formData = await event.request.formData();
		const drawingDocument = formData.get('drawingDocument')?.toString() ?? '';

		if (!drawingDocument.trim()) {
			return json(
				{ code: 'INVALID_MEDIA_FORMAT', message: 'Avatar drawing document must be provided' },
				{ status: 400 }
			);
		}

		const updated = await avatarService.uploadAvatar(event.locals.user ?? null, drawingDocument);

		return json({
			avatarUrl: resolveUserAvatarUrl(updated.id, updated.avatarUrl, updated.updatedAt.getTime())
		});
	} catch (error) {
		return toErrorResponse(error, {
			code: 'PUBLISH_FAILED',
			message: 'Avatar upload failed'
		});
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const updated = await avatarService.deleteAvatar(event.locals.user ?? null);

		return json({ avatarUrl: updated.avatarUrl });
	} catch (error) {
		return toErrorResponse(error, {
			code: 'PUBLISH_FAILED',
			message: 'Avatar deletion failed'
		});
	}
};
