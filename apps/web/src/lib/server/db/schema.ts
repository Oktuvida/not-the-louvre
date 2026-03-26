import { relations, sql } from 'drizzle-orm';
import { check, index, integer, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { account, session, user, verification } from './auth.schema';

const appSchema = pgSchema('app');

export const userRole = appSchema.enum('user_role', ['user', 'moderator', 'admin']);
export const authAttemptKind = appSchema.enum('auth_attempt_kind', ['login', 'recovery']);

export const users = appSchema.table(
	'users',
	{
		id: text('id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		nickname: text('nickname').notNull(),
		recoveryHash: text('recovery_hash').notNull(),
		avatarUrl: text('avatar_url'),
		role: userRole('role').notNull().default('user'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('users_nickname_unique').on(table.nickname),
		check('users_nickname_lowercase_check', sql`${table.nickname} = lower(${table.nickname})`)
	]
);

export const authRateLimits = appSchema.table(
	'auth_rate_limits',
	{
		id: text('id').primaryKey(),
		kind: authAttemptKind('kind').notNull(),
		actorKey: text('actor_key').notNull(),
		attemptCount: integer('attempt_count').notNull().default(0),
		windowStartedAt: timestamp('window_started_at').notNull(),
		lastAttemptAt: timestamp('last_attempt_at').notNull(),
		blockedUntil: timestamp('blocked_until'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('auth_rate_limits_kind_actor_unique').on(table.kind, table.actorKey),
		index('auth_rate_limits_blocked_until_idx').on(table.blockedUntil)
	]
);

export const authUsersRelations = relations(user, ({ one, many }) => ({
	profile: one(users, {
		fields: [user.id],
		references: [users.id]
	}),
	sessions: many(session),
	accounts: many(account)
}));

export const usersRelations = relations(users, ({ one }) => ({
	authUser: one(user, {
		fields: [users.id],
		references: [user.id]
	})
}));

export * from './auth.schema';
export { account, session, user, verification };
