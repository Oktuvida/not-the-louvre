// Both the API routes and the read services hand out avatar URLs; building
// them here is what keeps the `?v=` version from appearing on one payload and
// not the other.
export const resolveUserAvatarPath = (userId: string) => `/api/users/${userId}/avatar`;

// Saved avatars live at `avatars/<userId>/<version>.webp`, the version being a
// hash of the image. Avatars saved before that keep their fixed legacy key and
// have no version.
export const avatarVersionFromStorageKey = (storageKey: string) =>
	/\/([0-9a-f]{16})\.webp$/.exec(storageKey)?.[1] ?? null;

export const resolveUserAvatarUrl = (userId: string, storageKey: string | null | undefined) => {
	if (!storageKey) {
		return null;
	}

	const path = resolveUserAvatarPath(userId);
	const version = avatarVersionFromStorageKey(storageKey);

	return version ? `${path}?v=${version}` : path;
};
