export const resolveUserAvatarPath = (userId: string) => `/api/users/${userId}/avatar`;

export const resolveUserAvatarUrl = (
	userId: string,
	storageKey: string | null | undefined,
	version?: number | string | null
) => {
	if (!storageKey) {
		return null;
	}

	const path = resolveUserAvatarPath(userId);

	if (version === undefined || version === null) {
		return path;
	}

	return `${path}?v=${encodeURIComponent(String(version))}`;
};
