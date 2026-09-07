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

	const response = await fetch(`/api/users/${userId}/avatar`, {
		body: formData,
		method: 'PUT'
	});

	if (response.ok) {
		const data = (await response.json()) as { avatarUrl?: string };

		if (!data.avatarUrl) {
			return { message: AVATAR_MISSING_URL_MESSAGE, success: false };
		}

		return { avatarUrl: data.avatarUrl, success: true };
	}

	try {
		const data = (await response.json()) as { code?: string; message?: string };

		return {
			code: data.code,
			message: data.message ?? AVATAR_FAILURE_MESSAGE,
			success: false
		};
	} catch {
		// Ignore invalid error bodies and fall back to a generic message.
	}

	return { message: AVATAR_FAILURE_MESSAGE, success: false };
};

export const setAdultContentEnabled = async (enabled: boolean): Promise<void> => {
	const response = await fetch('/api/viewer/content-preferences', {
		body: JSON.stringify({ adultContentEnabled: enabled }),
		headers: { 'content-type': 'application/json' },
		method: 'PATCH'
	});

	if (!response.ok) {
		throw new Error(ADULT_CONTENT_FAILURE_MESSAGE);
	}
};
