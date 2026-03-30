import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import { avatarService } from '$lib/server/user/avatar.service';

export const PATCH: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as {
			action?: 'clear_nsfw' | 'hide' | 'mark_nsfw' | 'unhide';
		};

		const user = await avatarService.moderateAvatar(
			event.locals.user ?? null,
			event.params.userId,
			body.action ?? 'hide'
		);

		return json({ user });
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return json({ code: error.code, message: error.message }, { status: error.status });
		}

		return json({ code: 'PUBLISH_FAILED', message: 'Avatar moderation failed' }, { status: 500 });
	}
};
