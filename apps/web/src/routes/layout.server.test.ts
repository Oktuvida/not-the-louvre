import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	getViewerContentPreferences: vi.fn()
}));

vi.mock('$lib/server/moderation/service', () => ({
	getViewerContentPreferences: mocked.getViewerContentPreferences
}));

describe('root layout favicon data', () => {
	beforeEach(() => {
		mocked.getViewerContentPreferences.mockReset();
	});

	it('returns the sketch favicon for signed-out requests', async () => {
		const { load } = await import('./+layout.server');

		await expect(load({ locals: {} } as never)).resolves.toMatchObject({
			adultContentEnabled: false,
			ambientAudioEnabled: null,
			favicon: {
				kind: 'sketch'
			}
		});
		expect(mocked.getViewerContentPreferences).not.toHaveBeenCalled();
	});

	it('returns the avatar favicon for authenticated users with a completed avatar', async () => {
		mocked.getViewerContentPreferences.mockResolvedValue({
			adultContentConsentedAt: null,
			adultContentEnabled: true,
			ambientAudioEnabled: false,
			adultContentRevokedAt: null
		});

		const { load } = await import('./+layout.server');

		await expect(
			load({
				locals: {
					user: {
						avatarOnboardingCompletedAt: new Date('2026-03-29T10:00:00.000Z'),
						avatarUrl: 'avatars/product-user-1.avif',
						id: 'product-user-1',
						updatedAt: new Date('2026-03-29T11:00:00.000Z')
					}
				}
			} as never)
		).resolves.toMatchObject({
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
});
