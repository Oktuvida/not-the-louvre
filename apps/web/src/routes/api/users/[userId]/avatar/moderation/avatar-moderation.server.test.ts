import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';

const mocked = vi.hoisted(() => ({
	moderateAvatar: vi.fn()
}));

vi.mock('#lib/server/user/avatar.service.js', async () => {
	const actual = await vi.importActual<object>('#lib/server/user/avatar.service.js');
	return {
		...actual,
		avatarService: {
			...((actual as { avatarService?: object }).avatarService ?? {}),
			moderateAvatar: mocked.moderateAvatar
		}
	};
});

const makeModerator = () => ({
	user: {
		avatarUrl: null,
		avatarOnboardingCompletedAt: null,
		authUserId: 'auth-mod-1',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		email: 'mod@not-the-louvre.local',
		emailVerified: false,
		id: 'mod-1',
		image: null,
		isBanned: false,
		name: 'moderator',
		nickname: 'moderator',
		role: 'moderator' as const,
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

describe('PATCH /api/users/[userId]/avatar/moderation', () => {
	beforeEach(() => {
		mocked.moderateAvatar.mockReset();
	});

	it('allows moderators to mark an avatar as NSFW', async () => {
		mocked.moderateAvatar.mockResolvedValue({
			avatarIsHidden: true,
			avatarIsNsfw: true,
			id: 'user-1'
		});

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: makeModerator(),
			params: { userId: 'user-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'mark_nsfw' })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(mocked.moderateAvatar).toHaveBeenCalledWith(makeModerator().user, 'user-1', 'mark_nsfw');
	});

	it('returns only the moderated avatar flags, never the raw user record', async () => {
		mocked.moderateAvatar.mockResolvedValue({
			avatarDocument: 'a'.repeat(2048),
			avatarDocumentVersion: 2,
			avatarIsHidden: true,
			avatarIsNsfw: true,
			avatarUrl: 'avatars/user-1.avif',
			id: 'user-1',
			nickname: 'artist'
		});

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: makeModerator(),
			params: { userId: 'user-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'hide' })
			})
		} as never);

		expect(await response.json()).toEqual({
			user: {
				avatarIsHidden: true,
				avatarIsNsfw: true,
				avatarUrl: 'avatars/user-1.avif',
				id: 'user-1'
			}
		});
	});

	it('returns domain errors for forbidden access', async () => {
		mocked.moderateAvatar.mockRejectedValue(
			new ArtworkFlowError(403, 'Moderator access required', 'FORBIDDEN')
		);

		const { PATCH } = await import('./+server');
		const response = await PATCH({
			locals: { user: { ...makeModerator().user, role: 'user' } },
			params: { userId: 'user-1' },
			request: new Request('http://localhost', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'hide' })
			})
		} as never);

		expect(response.status).toBe(403);
	});
});
