import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	pgSchema,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { account, session, user, verification } from './auth.schema';

const appSchema = pgSchema('app');

export const userRole = appSchema.enum('user_role', ['user', 'moderator', 'admin']);
export const authAttemptKind = appSchema.enum('auth_attempt_kind', ['login', 'recovery']);
export const artworkVoteValue = appSchema.enum('artwork_vote_value', ['up', 'down']);
export const artworkReportReason = appSchema.enum('artwork_report_reason', [
	'spam',
	'harassment',
	'hate',
	'sexual_content',
	'violence',
	'misinformation',
	'copyright',
	'other'
]);
export const contentReportStatus = appSchema.enum('content_report_status', [
	'pending',
	'reviewed',
	'actioned'
]);
export const engagementRateLimitKind = appSchema.enum('engagement_rate_limit_kind', [
	'vote',
	'comment'
]);

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

export const artworks = appSchema.table(
	'artworks',
	{
		id: text('id').primaryKey(),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		parentId: text('parent_id'),
		title: text('title').notNull(),
		storageKey: text('storage_key').notNull(),
		mediaContentType: text('media_content_type').notNull(),
		mediaSizeBytes: integer('media_size_bytes').notNull(),
		isHidden: boolean('is_hidden').notNull().default(false),
		hiddenAt: timestamp('hidden_at'),
		score: integer('score').notNull().default(0),
		commentCount: integer('comment_count').notNull().default(0),
		forkCount: integer('fork_count').notNull().default(0),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('artworks_author_id_idx').on(table.authorId),
		index('artworks_parent_id_idx').on(table.parentId),
		uniqueIndex('artworks_storage_key_unique').on(table.storageKey),
		check('artworks_media_size_positive_check', sql`${table.mediaSizeBytes} > 0`),
		check('artworks_fork_count_non_negative_check', sql`${table.forkCount} >= 0`)
	]
);

export const artworkVotes = appSchema.table(
	'artwork_votes',
	{
		id: text('id').primaryKey(),
		artworkId: text('artwork_id')
			.notNull()
			.references(() => artworks.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		value: artworkVoteValue('value').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('artwork_votes_artwork_user_unique').on(table.artworkId, table.userId),
		index('artwork_votes_artwork_id_idx').on(table.artworkId),
		index('artwork_votes_user_id_idx').on(table.userId)
	]
);

export const artworkVoteRealtime = appSchema.table(
	'artwork_vote_realtime',
	{
		id: text('id').primaryKey(),
		artworkId: text('artwork_id')
			.notNull()
			.references(() => artworks.id, { onDelete: 'cascade' }),
		value: artworkVoteValue('value').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('artwork_vote_realtime_artwork_id_idx').on(table.artworkId)]
);

export const artworkComments = appSchema.table(
	'artwork_comments',
	{
		id: text('id').primaryKey(),
		artworkId: text('artwork_id')
			.notNull()
			.references(() => artworks.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		isHidden: boolean('is_hidden').notNull().default(false),
		hiddenAt: timestamp('hidden_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('artwork_comments_artwork_created_idx').on(table.artworkId, table.createdAt, table.id),
		index('artwork_comments_author_id_idx').on(table.authorId)
	]
);

export const artworkCommentRealtime = appSchema.table(
	'artwork_comment_realtime',
	{
		id: text('id').primaryKey(),
		artworkId: text('artwork_id')
			.notNull()
			.references(() => artworks.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body'),
		isVisible: boolean('is_visible').notNull().default(true),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('artwork_comment_realtime_artwork_id_idx').on(table.artworkId)]
);

export const contentReports = appSchema.table(
	'content_reports',
	{
		id: text('id').primaryKey(),
		reporterId: text('reporter_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		artworkId: text('artwork_id'),
		commentId: text('comment_id'),
		reason: artworkReportReason('reason').notNull(),
		status: contentReportStatus('status').notNull().default('pending'),
		reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
		reviewedAt: timestamp('reviewed_at'),
		details: text('details'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('content_reports_artwork_id_idx').on(table.artworkId),
		index('content_reports_comment_id_idx').on(table.commentId),
		index('content_reports_reporter_id_idx').on(table.reporterId),
		index('content_reports_status_idx').on(table.status),
		uniqueIndex('content_reports_pending_artwork_reporter_unique')
			.on(table.reporterId, table.artworkId)
			.where(sql`${table.artworkId} is not null and ${table.status} = 'pending'`),
		uniqueIndex('content_reports_pending_comment_reporter_unique')
			.on(table.reporterId, table.commentId)
			.where(sql`${table.commentId} is not null and ${table.status} = 'pending'`),
		check(
			'content_reports_single_target_check',
			sql`(case when ${table.artworkId} is null then 0 else 1 end + case when ${table.commentId} is null then 0 else 1 end) = 1`
		),
		check(
			'content_reports_review_resolution_check',
			sql`(${table.status} = 'pending' and ${table.reviewedBy} is null and ${table.reviewedAt} is null) or (${table.status} <> 'pending' and ${table.reviewedBy} is not null and ${table.reviewedAt} is not null)`
		)
	]
);

export const artworkEngagementRateLimits = appSchema.table(
	'artwork_engagement_rate_limits',
	{
		id: text('id').primaryKey(),
		kind: engagementRateLimitKind('kind').notNull(),
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
		uniqueIndex('artwork_engagement_rate_limits_kind_actor_unique').on(table.kind, table.actorKey),
		index('artwork_engagement_rate_limits_blocked_until_idx').on(table.blockedUntil)
	]
);

export const artworkPublishRateLimits = appSchema.table(
	'artwork_publish_rate_limits',
	{
		id: text('id').primaryKey(),
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
		uniqueIndex('artwork_publish_rate_limits_actor_key_unique').on(table.actorKey),
		index('artwork_publish_rate_limits_blocked_until_idx').on(table.blockedUntil)
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

export const usersRelations = relations(users, ({ many, one }) => ({
	authUser: one(user, {
		fields: [users.id],
		references: [user.id]
	}),
	artworks: many(artworks),
	votes: many(artworkVotes),
	comments: many(artworkComments),
	reports: many(contentReports)
}));

export const artworksRelations = relations(artworks, ({ many, one }) => ({
	author: one(users, {
		fields: [artworks.authorId],
		references: [users.id]
	}),
	parent: one(artworks, {
		fields: [artworks.parentId],
		references: [artworks.id]
	}),
	childForks: many(artworks),
	votes: many(artworkVotes),
	comments: many(artworkComments),
	reports: many(contentReports)
}));

export const artworkVotesRelations = relations(artworkVotes, ({ one }) => ({
	artwork: one(artworks, {
		fields: [artworkVotes.artworkId],
		references: [artworks.id]
	}),
	user: one(users, {
		fields: [artworkVotes.userId],
		references: [users.id]
	})
}));

export const artworkVoteRealtimeRelations = relations(artworkVoteRealtime, ({ one }) => ({
	artwork: one(artworks, {
		fields: [artworkVoteRealtime.artworkId],
		references: [artworks.id]
	})
}));

export const artworkCommentsRelations = relations(artworkComments, ({ one }) => ({
	artwork: one(artworks, {
		fields: [artworkComments.artworkId],
		references: [artworks.id]
	}),
	author: one(users, {
		fields: [artworkComments.authorId],
		references: [users.id]
	})
}));

export const artworkCommentRealtimeRelations = relations(artworkCommentRealtime, ({ one }) => ({
	artwork: one(artworks, {
		fields: [artworkCommentRealtime.artworkId],
		references: [artworks.id]
	}),
	author: one(users, {
		fields: [artworkCommentRealtime.authorId],
		references: [users.id]
	})
}));

export const contentReportsRelations = relations(contentReports, ({ one }) => ({
	reporter: one(users, {
		fields: [contentReports.reporterId],
		references: [users.id]
	}),
	reviewer: one(users, {
		fields: [contentReports.reviewedBy],
		references: [users.id]
	}),
	artwork: one(artworks, {
		fields: [contentReports.artworkId],
		references: [artworks.id]
	}),
	comment: one(artworkComments, {
		fields: [contentReports.commentId],
		references: [artworkComments.id]
	})
}));

export * from './auth.schema';
export { account, session, user, verification };
