import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	getViewerContentPreferences: vi.fn(),
	inlineAvatarFavicon: vi.fn()
}));

vi.mock('#lib/server/moderation/service.js', () => ({
	getViewerContentPreferences: mocked.getViewerContentPreferences
}));

vi.mock('#lib/server/user/inline-favicon.js', () => ({
	inlineAvatarFavicon: mocked.inlineAvatarFavicon
}));

const url = new URL('https://museum.test/');
const artist = {
	avatarOnboardingCompletedAt: new Date('2026-03-29T10:00:00.000Z'),
	avatarUrl: 'avatars/product-user-1.avif',
	id: 'product-user-1',
	updatedAt: new Date('2026-03-29T11:00:00.000Z')
};

describe('root layout favicon data', () => {
	beforeEach(() => {
		mocked.getViewerContentPreferences.mockReset();
		mocked.inlineAvatarFavicon.mockReset();
		mocked.inlineAvatarFavicon.mockResolvedValue(null);
	});

	it('returns the sketch favicon for signed-out requests', async () => {
		const { load } = await import('./+layout.server');

		await expect(load({ locals: {}, url } as never)).resolves.toMatchObject({
			adultContentEnabled: false,
			ambientAudioEnabled: null,
			favicon: {
				kind: 'sketch'
			}
		});
		expect(mocked.getViewerContentPreferences).not.toHaveBeenCalled();
	});

	it('links the avatar favicon where it cannot be written into the page', async () => {
		mocked.getViewerContentPreferences.mockResolvedValue({
			adultContentConsentedAt: null,
			adultContentEnabled: true,
			ambientAudioEnabled: false,
			adultContentRevokedAt: null
		});

		const { load } = await import('./+layout.server');

		await expect(load({ locals: { user: artist }, url } as never)).resolves.toMatchObject({
			// The whole preference row is resolved once here so the home and
			// gallery loads can read it from `parent()` instead of re-querying.
			adultContentEnabled: true,
			ambientAudioEnabled: false,
			favicon: {
				href: '/api/users/product-user-1/favicon?v=1774782000000',
				kind: 'avatar'
			}
		});
		expect(mocked.getViewerContentPreferences).toHaveBeenCalledOnce();
	});

	// Safari shows an icon written into the page at once, and an icon at an
	// address only when it gets round to fetching it.
	it('writes the avatar favicon into the page when it has been drawn for it', async () => {
		mocked.getViewerContentPreferences.mockResolvedValue({
			adultContentEnabled: false,
			ambientAudioEnabled: null
		});
		mocked.inlineAvatarFavicon.mockResolvedValue('data:image/png;base64,AAAA');

		const { load } = await import('./+layout.server');

		await expect(load({ locals: { user: artist }, url } as never)).resolves.toMatchObject({
			favicon: { href: 'data:image/png;base64,AAAA', kind: 'avatar', sizes: '32x32' }
		});
		expect(mocked.inlineAvatarFavicon).toHaveBeenCalledWith(artist, 'https://museum.test');
	});
});
