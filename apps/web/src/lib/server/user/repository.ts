import { and, desc, eq, lt, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { ListUsersInput, UserRecord, UserRepository } from './types';

const mapRow = (row: typeof users.$inferSelect): UserRecord => ({
	avatarDocument: row.avatarDocument ?? null,
	avatarDocumentVersion: row.avatarDocumentVersion ?? null,
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

export const userRepository: UserRepository = {
	async findUserById(id) {
		const row = await db.query.users.findFirst({ where: eq(users.id, id) });
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
			.select()
			.from(users)
			.where(cursorWhere)
			.orderBy(desc(users.createdAt), desc(users.id))
			.limit(input.limit);

		return rows.map(mapRow);
	},

	async updateUserAvatar(id, input) {
		const rows = await db
			.update(users)
			.set({
				avatarDocument: input.avatarDocument,
				avatarDocumentVersion: input.avatarDocumentVersion,
				avatarOnboardingCompletedAt: input.avatarOnboardingCompletedAt,
				avatarUrl: input.avatarUrl,
				updatedAt: input.updatedAt
			})
			.where(eq(users.id, id))
			.returning();
		return rows[0] ? mapRow(rows[0]) : null;
	},

	async updateUserAvatarUrl(id, avatarUrl, avatarOnboardingCompletedAt, updatedAt) {
		const rows = await db
			.update(users)
			.set({ avatarOnboardingCompletedAt, avatarUrl, updatedAt })
			.where(eq(users.id, id))
			.returning();
		return rows[0] ? mapRow(rows[0]) : null;
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
			.returning();

		return rows[0] ? mapRow(rows[0]) : null;
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
			.returning();

		return rows[0] ? mapRow(rows[0]) : null;
	},

	async updateUserRole(id, role, updatedAt) {
		const rows = await db
			.update(users)
			.set({ role, updatedAt })
			.where(eq(users.id, id))
			.returning();
		return rows[0] ? mapRow(rows[0]) : null;
	}
};
