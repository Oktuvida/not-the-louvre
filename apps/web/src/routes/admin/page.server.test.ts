import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
	getTextModerationSnapshot: vi.fn(),
	listModerationQueue: vi.fn(),
	listUsers: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', async () => {
	const actual = await vi.importActual<object>('$lib/server/artwork/read.service');
	return {
		...actual,
		listModerationQueue: mocked.listModerationQueue
	};
});

vi.mock('$lib/server/moderation/service', async () => {
	const actual = await vi.importActual<object>('$lib/server/moderation/service');
	return {
		...actual,
		getTextModerationSnapshot: mocked.getTextModerationSnapshot
	};
});

vi.mock('$lib/server/user/admin.service', async () => {
	const actual = await vi.importActual<object>('$lib/server/user/admin.service');
	return {
		...actual,
		listUsers: mocked.listUsers
	};
});

const makeUser = (role: 'admin' | 'moderator' | 'user') => ({
	avatarUrl: null,
	avatarOnboardingCompletedAt: null,
	authUserId: `auth-${role}-1`,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	email: `${role}@not-the-louvre.local`,
	emailVerified: false,
	id: `${role}-1`,
	image: null,
	isBanned: false,
	name: role,
	nickname: role,
	role,
	updatedAt: new Date('2026-01-01T00:00:00.000Z')
});

describe('admin dashboard load', () => {
	beforeEach(() => {
		mocked.getTextModerationSnapshot.mockReset();
		mocked.listModerationQueue.mockReset();
		mocked.listUsers.mockReset();
	});

	it('loads all tabs data for admins', async () => {
		mocked.listUsers.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});
		mocked.listModerationQueue.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});
		mocked.getTextModerationSnapshot.mockResolvedValue({ policies: {} });

		const { load } = await import('./+page.server');
		const result = (await load({ locals: { user: makeUser('admin') } } as never)) as Exclude<
			Awaited<ReturnType<typeof load>>,
			void
		>;

		expect(result.viewer).toMatchObject({ role: 'admin' });
		expect(result.usersPage).toBeTruthy();
		expect(result.moderationPage).toBeTruthy();
		expect(result.textPolicy).toBeTruthy();
	});

	it('loads only moderation data for moderators', async () => {
		mocked.listModerationQueue.mockResolvedValue({
			items: [],
			pageInfo: { hasMore: false, nextCursor: null }
		});

		const { load } = await import('./+page.server');
		const result = (await load({ locals: { user: makeUser('moderator') } } as never)) as Exclude<
			Awaited<ReturnType<typeof load>>,
			void
		>;

		expect(result.viewer).toMatchObject({ role: 'moderator' });
		expect(result.usersPage).toBeNull();
		expect(result.textPolicy).toBeNull();
		expect(result.moderationPage).toBeTruthy();
	});

	it('rejects non-privileged users', async () => {
		const { load } = await import('./+page.server');

		await expect(load({ locals: { user: makeUser('user') } } as never)).rejects.toMatchObject({
			status: 403
		});
	});
});
