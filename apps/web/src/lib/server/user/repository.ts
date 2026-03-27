import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { UserRecord, UserRepository } from './types';

const mapRow = (row: typeof users.$inferSelect): UserRecord => ({
	avatarUrl: row.avatarUrl ?? null,
	createdAt: row.createdAt,
	id: row.id,
	nickname: row.nickname,
	role: row.role,
	updatedAt: row.updatedAt
});

export const userRepository: UserRepository = {
	async findUserById(id) {
		const row = await db.query.users.findFirst({ where: eq(users.id, id) });
		return row ? mapRow(row) : null;
	},

	async updateUserAvatarUrl(id, avatarUrl, updatedAt) {
		const rows = await db
			.update(users)
			.set({ avatarUrl, updatedAt })
			.where(eq(users.id, id))
			.returning();
		return rows[0] ? mapRow(rows[0]) : null;
	}
};
