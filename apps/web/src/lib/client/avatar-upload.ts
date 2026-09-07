/*
 * The two viewer-owned write flows that every signed-in surface shares: saving
 * a hand-drawn avatar and flipping the 18+ preference. Both used to live as
 * byte-identical copies inside PersistentNav, AuthOverlay and
 * GalleryExplorationPage, which meant the avatar upload — the flow still
 * exposed to the CONNECTION_CLOSED failure — had no single place to fix.
 *
 * These helpers stay pure: no DOM side effects, no component state. Callers
 * keep their own busy flag, error sink, favicon dispatch and onAvatarSaved
 * callback.
 */

import { ApiError, apiErrorMessage, requestJson } from '$lib/client/api';
import { resolveUserAvatarPath } from '$lib/user/avatar-url';

export type AvatarUploadResult =
	| { avatarUrl: string; success: true }
	| { code?: string; message: string; success: false };

const AVATAR_SESSION_MESSAGE = 'Your session is not ready for avatar upload. Please sign in again.';
const AVATAR_MISSING_URL_MESSAGE = 'Avatar save succeeded but no avatar URL was returned.';
const AVATAR_FAILURE_MESSAGE = 'Avatar save failed. Please try again.';
const ADULT_CONTENT_FAILURE_MESSAGE = '18+ artwork preference could not be updated.';

export const uploadViewerAvatar = async (
	userId: string | null | undefined,
	drawingDocument: string
): Promise<AvatarUploadResult> => {
	if (!userId) {
		return { message: AVATAR_SESSION_MESSAGE, success: false };
	}

	const formData = new FormData();
	formData.set('drawingDocument', drawingDocument);

	try {
		const data = await requestJson<{ avatarUrl?: string }>(resolveUserAvatarPath(userId), {
			formData,
			method: 'PUT'
		});

		if (!data.avatarUrl) {
			return { message: AVATAR_MISSING_URL_MESSAGE, success: false };
		}

		return { avatarUrl: data.avatarUrl, success: true };
	} catch (error) {
		// A dropped connection is still the caller's to handle; only an answer
		// the API actually wrote becomes a rendered failure here.
		if (!(error instanceof ApiError)) throw error;

		return {
			...(error.code ? { code: error.code } : {}),
			message: apiErrorMessage(error, AVATAR_FAILURE_MESSAGE),
			success: false
		};
	}
};

export const setAdultContentEnabled = async (enabled: boolean): Promise<void> => {
	try {
		await requestJson('/api/viewer/content-preferences', {
			json: { adultContentEnabled: enabled },
			method: 'PATCH'
		});
	} catch (error) {
		throw new Error(apiErrorMessage(error, ADULT_CONTENT_FAILURE_MESSAGE), { cause: error });
	}
};
