import { and, desc, eq, lt, or } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import type { ListUsersInput, UserRecord, UserRepository } from './types';

// Every UserRecord column except the avatar drawing document. `recovery_hash`
// is never in UserRecord, so naming the columns explicitly also stops it
// leaving Postgres on routine profile reads.
const userProfileColumns = {
	avatarIsHidden: true,
	avatarIsNsfw: true,
	avatarOnboardingCompletedAt: true,
	avatarUrl: true,
	banReason: true,
	bannedAt: true,
	createdAt: true,
	id: true,
	isBanned: true,
	nickname: true,
	role: true,
	updatedAt: true
} as const;

const userProfileProjection = {
	avatarIsHidden: users.avatarIsHidden,
	avatarIsNsfw: users.avatarIsNsfw,
	avatarOnboardingCompletedAt: users.avatarOnboardingCompletedAt,
	avatarUrl: users.avatarUrl,
	banReason: users.banReason,
	bannedAt: users.bannedAt,
	createdAt: users.createdAt,
	id: users.id,
	isBanned: users.isBanned,
	nickname: users.nickname,
	role: users.role,
	updatedAt: users.updatedAt
};

const userAvatarRefProjection = {
	avatarIsHidden: users.avatarIsHidden,
	avatarIsNsfw: users.avatarIsNsfw,
	avatarUrl: users.avatarUrl,
	createdAt: users.createdAt,
	id: users.id,
	nickname: users.nickname,
	role: users.role,
	updatedAt: users.updatedAt
};

type UserProfileRow = {
	[Key in keyof typeof userProfileColumns]: (typeof users.$inferSelect)[Key];
};

const mapProfileRow = (row: UserProfileRow): UserRecord => ({
	avatarIsHidden: row.avatarIsHidden,
	avatarIsNsfw: row.avatarIsNsfw,
	avatarUrl: row.avatarUrl ?? null,
	avatarOnboardingCompletedAt: row.avatarOnboardingCompletedAt ?? null,
	banReason: row.banReason ?? null,
	bannedAt: row.bannedAt ?? null,
	createdAt: row.createdAt,
	id: row.id,
	isBanned: row.isBanned,
	nickname: row.nickname,
	role: row.role,
	updatedAt: row.updatedAt
});

const mapRow = (
	row: UserProfileRow &
		Pick<
			typeof users.$inferSelect,
			'avatarDocument' | 'avatarDocumentKey' | 'avatarDocumentVersion'
		>
): UserRecord => ({
	...mapProfileRow(row),
	avatarDocument: row.avatarDocument ?? null,
	avatarDocumentKey: row.avatarDocumentKey ?? null,
	avatarDocumentVersion: row.avatarDocumentVersion ?? null
});

export const userRepository: UserRepository = {
	async findUserAvatarRefById(id) {
		const [row] = await db.select(userAvatarRefProjection).from(users).where(eq(users.id, id));

		return row ?? null;
	},

	// Keeps where the avatar drawing is: the home loader hydrates the avatar
	// editor from it. Every other caller should use findUserAvatarRefById.
	async findUserById(id) {
		const row = await db.query.users.findFirst({
			columns: {
				...userProfileColumns,
				avatarDocument: true,
				avatarDocumentKey: true,
				avatarDocumentVersion: true
			},
			where: eq(users.id, id)
		});
		return row ? mapRow(row) : null;
	},

	async listUsers(input: ListUsersInput) {
		const cursorWhere = input.cursor
			? or(
					lt(users.createdAt, input.cursor.createdAt),
					and(eq(users.createdAt, input.cursor.createdAt), lt(users.id, input.cursor.id))
				)
			: undefined;

		const rows = await db
			.select(userProfileProjection)
			.from(users)
			.where(cursorWhere)
			.orderBy(desc(users.createdAt), desc(users.id))
			.limit(input.limit);

		return rows.map(mapProfileRow);
	},

	async updateUserAvatar(id, input) {
		const rows = await db
			.update(users)
			.set({
				avatarDocument: input.avatarDocument,
				avatarDocumentKey: input.avatarDocumentKey,
				avatarDocumentVersion: input.avatarDocumentVersion,
				avatarOnboardingCompletedAt: input.avatarOnboardingCompletedAt,
				avatarUrl: input.avatarUrl,
				updatedAt: input.updatedAt
			})
			.where(eq(users.id, id))
			.returning(userProfileProjection);
		return rows[0] ? mapProfileRow(rows[0]) : null;
	},

	async updateAvatarModeration(id, input) {
		const rows = await db
			.update(users)
			.set({
				avatarIsHidden: input.avatarIsHidden,
				avatarIsNsfw: input.avatarIsNsfw,
				updatedAt: input.updatedAt
			})
			.where(eq(users.id, id))
			.returning(userProfileProjection);

		return rows[0] ? mapProfileRow(rows[0]) : null;
	},

	async updateBanState(id, input) {
		const rows = await db
			.update(users)
			.set({
				banReason: input.banReason,
				bannedAt: input.bannedAt,
				isBanned: input.isBanned,
				updatedAt: input.updatedAt
			})
			.where(eq(users.id, id))
			.returning(userProfileProjection);

		return rows[0] ? mapProfileRow(rows[0]) : null;
	},

	async updateUserRole(id, role, updatedAt) {
		const rows = await db
			.update(users)
			.set({ role, updatedAt })
			.where(eq(users.id, id))
			.returning(userProfileProjection);
		return rows[0] ? mapProfileRow(rows[0]) : null;
	}
};
