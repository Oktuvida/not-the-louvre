import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toApiErrorResponse } from '$lib/server/http/errors';
import { avatarService } from '$lib/server/user/avatar.service';

const AVATAR_MODERATION_ERROR = {
	fallbackCode: 'AVATAR_MODERATION_FAILED',
	fallbackMessage: 'Avatar moderation failed',
	scope: 'avatar moderation'
};

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

		// The admin UI refreshes its own list from this call, so the response only
		// needs the moderated flags — never the target's avatar drawing document.
		return json({
			user: {
				avatarIsHidden: user.avatarIsHidden,
				avatarIsNsfw: user.avatarIsNsfw,
				avatarUrl: user.avatarUrl,
				id: user.id
			}
		});
	} catch (error) {
		return toApiErrorResponse(error, AVATAR_MODERATION_ERROR);
	}
};
