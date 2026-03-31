import { describe, expect, it, vi } from 'vitest';
import { banUser, listUsers, unbanUser, updateUserRole } from './admin.service';
import type { CanonicalUser } from '$lib/server/auth/types';
import type { UserRecord, UserRepository } from './types';

const createAdmin = (overrides: Partial<CanonicalUser> = {}): CanonicalUser => ({
	avatarUrl: null,
	avatarOnboardingCompletedAt: null,
	authUserId: 'auth-admin-1',
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	email: 'admin@not-the-louvre.local',
	emailVerified: false,
	id: 'admin-1',
	image: null,
	isBanned: false,
	name: 'admin',
	nickname: 'admin',
	role: 'admin',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

const createUserRecord = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	avatarIsHidden: false,
	avatarIsNsfw: false,
	avatarOnboardingCompletedAt: null,
	avatarUrl: null,
	banReason: null,
	bannedAt: null,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	id: 'user-1',
	isBanned: false,
	nickname: 'artist',
	role: 'user',
	updatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

const createRepository = (record = createUserRecord()): UserRepository => {
	let stored = record;

	return {
		findUserById: vi.fn(async (id) => (stored.id === id ? stored : null)),
		listUsers: vi.fn(async () => [stored]),
		updateAvatarModeration: vi.fn(async () => null),
		updateBanState: vi.fn(async (id, input) => {
			if (stored.id !== id) return null;
			stored = {
				...stored,
				banReason: input.banReason,
				bannedAt: input.bannedAt,
				isBanned: input.isBanned,
				updatedAt: input.updatedAt
			};
			return stored;
		}),
		updateUserAvatarUrl: vi.fn(async () => null),
		updateUserRole: vi.fn(async (id, role, updatedAt) => {
			if (stored.id !== id) return null;
			stored = { ...stored, role, updatedAt };
			return stored;
		})
	};
};

describe('admin service', () => {
	it('includes ban and avatar moderation state in the user list projection', async () => {
		const repository = createRepository(
			createUserRecord({
				avatarIsHidden: true,
				avatarIsNsfw: true,
				banReason: 'spam ring',
				bannedAt: new Date('2026-03-30T10:00:00.000Z'),
				isBanned: true
			})
		);

		const result = await listUsers({}, { user: createAdmin() }, { repository });

		expect(result.items[0]).toMatchObject({
			avatarIsHidden: true,
			avatarIsNsfw: true,
			banReason: 'spam ring',
			isBanned: true
		});
	});

	it('allows an active admin to ban and unban a user', async () => {
		const repository = createRepository();

		const banned = await banUser(
			{ reason: 'harassment', userId: 'user-1' },
			{ user: createAdmin() },
			{ repository }
		);

		expect(banned).toMatchObject({
			banReason: 'harassment',
			isBanned: true
		});
		expect(banned.bannedAt).toBeInstanceOf(Date);

		const unbanned = await unbanUser({ userId: 'user-1' }, { user: createAdmin() }, { repository });

		expect(unbanned).toMatchObject({
			banReason: null,
			bannedAt: null,
			isBanned: false
		});
	});

	it('rejects self-ban and banned admins from admin actions', async () => {
		const repository = createRepository();

		await expect(
			banUser({ reason: 'oops', userId: 'admin-1' }, { user: createAdmin() }, { repository })
		).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

		await expect(
			updateUserRole(
				{ role: 'moderator', userId: 'user-1' },
				{ user: createAdmin({ isBanned: true }) },
				{ repository }
			)
		).rejects.toMatchObject({ code: 'BANNED_USER', status: 403 });
	});
});
