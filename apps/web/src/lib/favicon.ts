import type { CanonicalUser } from '$lib/server/auth/types';

export type FaviconState = {
	href: string;
	kind: 'avatar' | 'sketch';
};

type FaviconUser = Pick<
	CanonicalUser,
	'id' | 'avatarOnboardingCompletedAt' | 'avatarUrl' | 'updatedAt'
>;

export const faviconUpdateEventName = 'ntl:favicon:update';

const sketchFaviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<rect width="64" height="64" rx="18" fill="#f5f0e1" />
	<g fill="none" stroke="#2d2a26" stroke-linecap="round" stroke-linejoin="round" stroke-width="4">
		<circle cx="32" cy="20" r="12" stroke-dasharray="6 4" opacity="0.95" />
		<path d="M13 51v-3c0-7.732 8.507-14 19-14s19 6.268 19 14v3" stroke-dasharray="6 4" opacity="0.95" />
		<path d="M21 46c3.167-2.667 6.833-4 11-4s7.833 1.333 11 4" opacity="0.3" />
	</g>
</svg>`.trim();

export const sketchFaviconHref = `data:image/svg+xml,${encodeURIComponent(sketchFaviconSvg)}`;

export const resolveAvatarFaviconHref = (userId: string, version: number | string) =>
	`/api/users/${userId}/favicon?v=${encodeURIComponent(String(version))}`;

export const resolveFaviconState = (user: FaviconUser | null | undefined): FaviconState => {
	if (!user?.avatarUrl || !user.avatarOnboardingCompletedAt) {
		return {
			href: sketchFaviconHref,
			kind: 'sketch'
		};
	}

	return {
		href: resolveAvatarFaviconHref(user.id, user.updatedAt.getTime()),
		kind: 'avatar'
	};
};

export const dispatchAvatarFaviconUpdate = (userId: string, version = Date.now()) => {
	if (typeof window === 'undefined') {
		return;
	}

	window.dispatchEvent(
		new CustomEvent<{ href: string }>(faviconUpdateEventName, {
			detail: {
				href: resolveAvatarFaviconHref(userId, version)
			}
		})
	);
};
