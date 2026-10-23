import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import type { ProductRole } from '$lib/shared/viewer';
import type { RateLimitPolicy } from '$lib/server/db/rate-limit';

const DATABASE_URL = process.env.DATABASE_URL;
// Same opt-in flag as the other integration suites: `bun run test:integration`.
const describeWithDatabase = process.env.RUN_INTEGRATION === '1' ? describe : describe.skip;

type DbClient = Sql<Record<string, unknown>>;
type TransactionContext = {
	unsafe: DbClient['unsafe'];
};

const createCanonicalUser = (id: string, role: ProductRole = 'user') => {
	const now = new Date('2026-03-27T10:00:00.000Z');

	return {
		id,
		authUserId: id,
		nickname: `${id}_nick`,
		role,
		avatarUrl: null,
		name: id,
		email: `${id}@not-the-louvre.local`,
		emailVerified: true,
		image: null,
		createdAt: now,
		updatedAt: now
	};
};

const createDbClient = () => {
	if (!DATABASE_URL) {
		throw new Error('DATABASE_URL is required for DB integration tests');
	}

	return postgres(DATABASE_URL, { max: 1 });
};

const truncateDatabase = async (sql: DbClient) => {
	await sql.unsafe(`
		truncate table
			app.artwork_engagement_rate_limits,
			app.artwork_publish_rate_limits,
			app.auth_rate_limits,
			app.content_reports,
			app.artwork_votes,
			app.artwork_vote_realtime,
			app.artwork_comments,
			app.artwork_comment_realtime,
			app.artworks,
			app.users,
			better_auth.account,
			better_auth.session,
			better_auth.verification,
			better_auth.user
		restart identity cascade
	`);
};

const insertUser = async (sql: DbClient, id: string, role: ProductRole = 'user') => {
	const now = new Date('2026-03-27T10:00:00.000Z');

	await sql`
		insert into better_auth.user (
			id,
			name,
			email,
			email_verified,
			image,
			created_at,
			updated_at,
			username,
			display_username,
			nickname
		)
		values (
			${id},
			${id},
			${`${id}@not-the-louvre.local`},
			true,
			null,
			${now},
			${now},
			null,
			null,
			${`${id}_nick`}
		)
	`;

	await sql`
		insert into app.users (
			id,
			nickname,
			recovery_hash,
			avatar_url,
			role,
			created_at,
			updated_at
		)
		values (
			${id},
			${`${id}_nick`},
			${`recovery-${id}`},
			null,
			${role},
			${now},
			${now}
		)
	`;
};

const insertArtwork = async (
	sql: DbClient,
	input: {
		authorId: string;
		id: string;
		isHidden?: boolean;
		parentId?: string | null;
		updatedAt?: Date;
	}
) => {
	const createdAt = new Date('2026-03-27T10:05:00.000Z');
	const updatedAt = input.updatedAt ?? createdAt;

	await sql`
		insert into app.artworks (
			id,
			author_id,
			parent_id,
			title,
			storage_key,
			media_content_type,
			media_size_bytes,
			is_hidden,
			hidden_at,
			score,
			comment_count,
			fork_count,
			created_at,
			updated_at
		)
		values (
			${input.id},
			${input.authorId},
			${input.parentId ?? null},
			${`Artwork ${input.id}`},
			${`artworks/${input.authorId}/${input.id}.avif`},
			'image/avif',
			128,
			${input.isHidden ?? false},
			${input.isHidden ? createdAt : null},
			0,
			0,
			0,
			${createdAt},
			${updatedAt}
		)
	`;
};

const insertComment = async (
	sql: DbClient,
	input: {
		authorId: string;
		artworkId: string;
		body?: string;
		id: string;
		isHidden?: boolean;
	}
) => {
	const createdAt = new Date('2026-03-27T10:10:00.000Z');

	await sql`
		insert into app.artwork_comments (
			id,
			artwork_id,
			author_id,
			body,
			is_hidden,
			hidden_at,
			created_at,
			updated_at
		)
		values (
			${input.id},
			${input.artworkId},
			${input.authorId},
			${input.body ?? `Comment ${input.id}`},
			${input.isHidden ?? false},
			${input.isHidden ? createdAt : null},
			${createdAt},
			${createdAt}
		)
	`;
};

const insertReport = async (
	sql: DbClient,
	input: {
		artworkId?: string | null;
		commentId?: string | null;
		id: string;
		reporterId: string;
	}
) => {
	const createdAt = new Date('2026-03-27T10:15:00.000Z');

	await sql`
		insert into app.content_reports (
			id,
			reporter_id,
			artwork_id,
			comment_id,
			reason,
			details,
			created_at,
			updated_at
		)
		values (
			${input.id},
			${input.reporterId},
			${input.artworkId ?? null},
			${input.commentId ?? null},
			'spam',
			null,
			${createdAt},
			${createdAt}
		)
	`;
};

const getArtworkSummary = async (sql: DbClient, artworkId: string) => {
	const [row] = await sql<
		Array<{
			comment_count: number;
			fork_count: number;
			is_hidden: boolean;
			score: number;
		}>
	>`
		select comment_count, fork_count, is_hidden, score
		from app.artworks
		where id = ${artworkId}
	`;

	return row;
};

const getCommentSummary = async (sql: DbClient, commentId: string) => {
	const [row] = await sql<Array<{ is_hidden: boolean }>>`
		select is_hidden
		from app.artwork_comments
		where id = ${commentId}
	`;

	return row;
};

const getReportRows = async (sql: DbClient, target: { artworkId?: string; commentId?: string }) => {
	if (target.artworkId) {
		return sql<
			Array<{
				comment_id: string | null;
				reviewed_at: Date | null;
				reviewed_by: string | null;
				status: 'actioned' | 'pending' | 'reviewed';
			}>
		>`
			select comment_id, reviewed_at, reviewed_by, status
			from app.content_reports
			where artwork_id = ${target.artworkId}
			order by id
		`;
	}

	return sql<
		Array<{
			comment_id: string | null;
			reviewed_at: Date | null;
			reviewed_by: string | null;
			status: 'actioned' | 'pending' | 'reviewed';
		}>
	>`
		select comment_id, reviewed_at, reviewed_by, status
		from app.content_reports
		where comment_id = ${target.commentId ?? null}
		order by id
	`;
};

const asAuthenticated = async <T>(
	sql: DbClient,
	userId: string,
	callback: (tx: TransactionContext) => Promise<T>
) =>
	sql.begin(async (tx) => {
		await tx.unsafe('set local role authenticated');
		await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [
			JSON.stringify({ role: 'authenticated', sub: userId })
		]);

		return callback({ unsafe: tx.unsafe.bind(tx) });
	});

const asAnonymous = async <T>(sql: DbClient, callback: (tx: TransactionContext) => Promise<T>) =>
	sql.begin(async (tx) => {
		await tx.unsafe('set local role anon');
		await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [
			JSON.stringify({ role: 'anon' })
		]);

		return callback({ unsafe: tx.unsafe.bind(tx) });
	});

describeWithDatabase('artwork DB contract', () => {
	let sql: DbClient;

	beforeAll(() => {
		sql = createDbClient();
	});

	afterAll(async () => {
		await sql?.end({ timeout: 1 });
	});

	beforeEach(async () => {
		await truncateDatabase(sql);
		await insertUser(sql, 'author-1');
		await insertUser(sql, 'viewer-1');
		await insertUser(sql, 'viewer-2');
		await insertUser(sql, 'moderator-1', 'moderator');
		await insertUser(sql, 'reporter-1');
		await insertUser(sql, 'reporter-2');
		await insertUser(sql, 'reporter-3');
	});

	it('maintains canonical score under concurrent vote insert, update, and delete mutations', async () => {
		const voteClientA = createDbClient();
		const voteClientB = createDbClient();

		try {
			await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-score' });

			await Promise.all([
				voteClientA`
					insert into app.artwork_votes (id, artwork_id, user_id, value, created_at, updated_at)
					values ('vote-1', 'artwork-score', 'viewer-1', 'up', now(), now())
				`,
				voteClientB`
					insert into app.artwork_votes (id, artwork_id, user_id, value, created_at, updated_at)
					values ('vote-2', 'artwork-score', 'viewer-2', 'down', now(), now())
				`
			]);

			let artwork = await getArtworkSummary(sql, 'artwork-score');
			expect(artwork?.score).toBe(0);

			await Promise.all([
				voteClientA`
					update app.artwork_votes
					set value = 'up', updated_at = now()
					where id = 'vote-2'
				`,
				voteClientB`
					delete from app.artwork_votes
					where id = 'vote-1'
				`
			]);

			artwork = await getArtworkSummary(sql, 'artwork-score');
			expect(artwork?.score).toBe(1);
		} finally {
			await voteClientA.end({ timeout: 1 });
			await voteClientB.end({ timeout: 1 });
		}
	});

	it('maintains canonical public comment counts across create, hide, unhide, and delete transitions', async () => {
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-comments' });
		await insertComment(sql, {
			authorId: 'viewer-1',
			artworkId: 'artwork-comments',
			id: 'comment-1'
		});

		let artwork = await getArtworkSummary(sql, 'artwork-comments');
		expect(artwork?.comment_count).toBe(1);

		await sql`
			update app.artwork_comments
			set is_hidden = true, hidden_at = now(), updated_at = now()
			where id = 'comment-1'
		`;

		artwork = await getArtworkSummary(sql, 'artwork-comments');
		expect(artwork?.comment_count).toBe(0);

		await sql`
			update app.artwork_comments
			set is_hidden = false, hidden_at = null, updated_at = now()
			where id = 'comment-1'
		`;

		artwork = await getArtworkSummary(sql, 'artwork-comments');
		expect(artwork?.comment_count).toBe(1);

		await sql`delete from app.artwork_comments where id = 'comment-1'`;

		artwork = await getArtworkSummary(sql, 'artwork-comments');
		expect(artwork?.comment_count).toBe(0);
	});

	it('maintains canonical public fork counts across create, hide, unhide, and delete transitions', async () => {
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-parent' });
		await insertArtwork(sql, {
			authorId: 'viewer-1',
			id: 'artwork-child',
			parentId: 'artwork-parent'
		});

		let artwork = await getArtworkSummary(sql, 'artwork-parent');
		expect(artwork?.fork_count).toBe(1);

		await sql`
			update app.artworks
			set is_hidden = true, hidden_at = now(), updated_at = now()
			where id = 'artwork-child'
		`;

		artwork = await getArtworkSummary(sql, 'artwork-parent');
		expect(artwork?.fork_count).toBe(0);

		await sql`
			update app.artworks
			set is_hidden = false, hidden_at = null, updated_at = now()
			where id = 'artwork-child'
		`;

		artwork = await getArtworkSummary(sql, 'artwork-parent');
		expect(artwork?.fork_count).toBe(1);

		await sql`delete from app.artworks where id = 'artwork-child'`;

		artwork = await getArtworkSummary(sql, 'artwork-parent');
		expect(artwork?.fork_count).toBe(0);
	});

	it('applies one correct auto-hide transition when concurrent reports cross the threshold for artwork and comment targets', async () => {
		const reportClientA = createDbClient();
		const reportClientB = createDbClient();

		try {
			await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-reported' });
			await insertComment(sql, {
				authorId: 'viewer-1',
				artworkId: 'artwork-reported',
				id: 'comment-reported'
			});

			await insertReport(sql, {
				artworkId: 'artwork-reported',
				id: 'report-artwork-1',
				reporterId: 'reporter-1'
			});
			await Promise.all([
				reportClientA`
					insert into app.content_reports (id, reporter_id, artwork_id, reason, created_at, updated_at)
					values ('report-artwork-2', 'reporter-2', 'artwork-reported', 'spam', now(), now())
				`,
				reportClientB`
					insert into app.content_reports (id, reporter_id, artwork_id, reason, created_at, updated_at)
					values ('report-artwork-3', 'reporter-3', 'artwork-reported', 'spam', now(), now())
				`
			]);

			const artworkAfterThreshold = await getArtworkSummary(sql, 'artwork-reported');
			expect(artworkAfterThreshold?.is_hidden).toBe(true);

			await insertReport(sql, {
				commentId: 'comment-reported',
				id: 'report-comment-1',
				reporterId: 'reporter-1'
			});
			await Promise.all([
				reportClientA`
					insert into app.content_reports (id, reporter_id, comment_id, reason, created_at, updated_at)
					values ('report-comment-2', 'reporter-2', 'comment-reported', 'spam', now(), now())
				`,
				reportClientB`
					insert into app.content_reports (id, reporter_id, comment_id, reason, created_at, updated_at)
					values ('report-comment-3', 'reporter-3', 'comment-reported', 'spam', now(), now())
				`
			]);

			const comment = await getCommentSummary(sql, 'comment-reported');
			expect(comment?.is_hidden).toBe(true);
		} finally {
			await reportClientA.end({ timeout: 1 });
			await reportClientB.end({ timeout: 1 });
		}
	});

	it('enforces one pending report per reporter and target while allowing a new report after resolution', async () => {
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-unique' });
		await insertComment(sql, {
			authorId: 'viewer-1',
			artworkId: 'artwork-unique',
			id: 'comment-unique'
		});

		await insertReport(sql, {
			artworkId: 'artwork-unique',
			id: 'report-artwork-1',
			reporterId: 'reporter-1'
		});

		await expect(
			insertReport(sql, {
				artworkId: 'artwork-unique',
				id: 'report-artwork-2',
				reporterId: 'reporter-1'
			})
		).rejects.toThrow();

		await sql`
			update app.content_reports
			set status = 'reviewed', reviewed_by = 'moderator-1', reviewed_at = now(), updated_at = now()
			where id = 'report-artwork-1'
		`;

		await expect(
			insertReport(sql, {
				artworkId: 'artwork-unique',
				id: 'report-artwork-3',
				reporterId: 'reporter-1'
			})
		).resolves.toBeUndefined();

		await insertReport(sql, {
			commentId: 'comment-unique',
			id: 'report-comment-1',
			reporterId: 'reporter-2'
		});

		await expect(
			insertReport(sql, {
				commentId: 'comment-unique',
				id: 'report-comment-2',
				reporterId: 'reporter-2'
			})
		).rejects.toThrow();
	});

	it('counts only pending reports for auto-hide and moderation queue membership', async () => {
		const { listModerationQueue } = await import('./read.service');

		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-pending-only' });
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-reopens' });
		await insertComment(sql, {
			authorId: 'viewer-1',
			artworkId: 'artwork-pending-only',
			id: 'comment-pending-only'
		});

		await sql`
			insert into app.content_reports (id, reporter_id, artwork_id, reason, status, reviewed_by, reviewed_at, created_at, updated_at)
			values
				('report-reviewed-1', 'reporter-1', 'artwork-pending-only', 'spam', 'reviewed', 'moderator-1', now(), now(), now()),
				('report-reviewed-2', 'reporter-2', 'artwork-pending-only', 'spam', 'reviewed', 'moderator-1', now(), now(), now())
		`;

		await insertReport(sql, {
			artworkId: 'artwork-pending-only',
			id: 'report-pending-1',
			reporterId: 'reporter-3'
		});
		await insertReport(sql, {
			artworkId: 'artwork-pending-only',
			id: 'report-pending-2',
			reporterId: 'viewer-1'
		});

		let artwork = await getArtworkSummary(sql, 'artwork-pending-only');
		expect(artwork?.is_hidden).toBe(false);

		await insertReport(sql, {
			artworkId: 'artwork-pending-only',
			id: 'report-pending-3',
			reporterId: 'viewer-2'
		});

		artwork = await getArtworkSummary(sql, 'artwork-pending-only');
		expect(artwork?.is_hidden).toBe(true);

		await insertReport(sql, {
			artworkId: 'artwork-reopens',
			id: 'report-reopen-1',
			reporterId: 'reporter-1'
		});
		await sql`
			update app.content_reports
			set status = 'reviewed', reviewed_by = 'moderator-1', reviewed_at = now(), updated_at = now()
			where id = 'report-reopen-1'
		`;

		let queue = await listModerationQueue(
			{},
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);
		expect(queue.items.map((item) => item.artworkId)).toEqual(['artwork-pending-only']);
		expect(queue.items[0]).toMatchObject({ reportCount: 3, targetType: 'artwork' });

		await insertReport(sql, {
			artworkId: 'artwork-reopens',
			id: 'report-reopen-2',
			reporterId: 'reporter-2'
		});

		queue = await listModerationQueue(
			{},
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);
		expect(queue.items.map((item) => item.artworkId)).toEqual([
			'artwork-pending-only',
			'artwork-reopens'
		]);
		expect(queue.items[1]).toMatchObject({ reportCount: 1, targetType: 'artwork' });
	});

	it('answers a repeated report from the same visitor as a duplicate, not a server error', async () => {
		const { submitContentReport } = await import('./service');
		const reporter = { ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-1') };

		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-reported-twice' });
		await submitContentReport({ artworkId: 'artwork-reported-twice', reason: 'spam' }, reporter);

		await expect(
			submitContentReport({ artworkId: 'artwork-reported-twice', reason: 'spam' }, reporter)
		).rejects.toMatchObject({ code: 'DUPLICATE_REPORT', status: 409 });
	});

	it('resolves reports with reviewer attribution for dismiss, hide, and delete moderation outcomes', async () => {
		const { createArtworkComment, moderateArtwork, moderateComment, submitContentReport } =
			await import('./service');

		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-review-lifecycle' });

		await submitContentReport(
			{ artworkId: 'artwork-review-lifecycle', reason: 'spam' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-1') }
		);
		await submitContentReport(
			{ artworkId: 'artwork-review-lifecycle', reason: 'spam' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-2') }
		);

		const dismissed = await moderateArtwork(
			{ action: 'dismiss', artworkId: 'artwork-review-lifecycle' },
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);

		expect(dismissed.id).toBe('artwork-review-lifecycle');
		expect((await getArtworkSummary(sql, 'artwork-review-lifecycle'))?.is_hidden).toBe(false);
		expect(await getReportRows(sql, { artworkId: 'artwork-review-lifecycle' })).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ reviewed_by: 'moderator-1', status: 'reviewed' })
			])
		);

		await submitContentReport(
			{ artworkId: 'artwork-review-lifecycle', reason: 'spam' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-3') }
		);

		const hidden = await moderateArtwork(
			{ action: 'hide', artworkId: 'artwork-review-lifecycle' },
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);

		expect(hidden.isHidden).toBe(true);
		expect(await getReportRows(sql, { artworkId: 'artwork-review-lifecycle' })).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ reviewed_by: 'moderator-1', status: 'actioned' })
			])
		);

		const comment = await createArtworkComment(
			{ artworkId: 'artwork-review-lifecycle', body: 'Reported comment' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('viewer-1') }
		);
		await submitContentReport(
			{ commentId: comment.id, reason: 'harassment' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-1') }
		);

		const deletedComment = await moderateComment(
			{ action: 'delete', artworkId: 'artwork-review-lifecycle', commentId: comment.id },
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);

		expect(deletedComment.id).toBe(comment.id);
		expect(await getReportRows(sql, { commentId: comment.id })).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					comment_id: comment.id,
					reviewed_by: 'moderator-1',
					status: 'actioned'
				})
			])
		);
	});

	it('exposes only realtime-safe artwork-scoped vote and comment relations with publication and RLS protection', async () => {
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-visible' });
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-hidden', isHidden: true });

		await sql`
			insert into app.artwork_votes (id, artwork_id, user_id, value, created_at, updated_at)
			values ('vote-visible', 'artwork-visible', 'viewer-1', 'up', now(), now())
		`;
		await insertComment(sql, {
			authorId: 'viewer-1',
			artworkId: 'artwork-visible',
			id: 'comment-visible',
			body: 'Visible comment'
		});
		await insertComment(sql, {
			authorId: 'viewer-1',
			artworkId: 'artwork-hidden',
			id: 'comment-hidden',
			body: 'Hidden comment'
		});

		const publicationRows = await sql<Array<{ tablename: string }>>`
			select tablename
			from pg_publication_tables
			where pubname = 'supabase_realtime' and schemaname = 'app'
			order by tablename
		`;

		expect(publicationRows.map((row) => row.tablename)).toEqual([
			'artwork_comment_realtime',
			'artwork_vote_realtime'
		]);

		const voteColumns = await sql<Array<{ column_name: string }>>`
			select column_name
			from information_schema.columns
			where table_schema = 'app' and table_name = 'artwork_vote_realtime'
			order by ordinal_position
		`;
		const commentColumns = await sql<Array<{ column_name: string }>>`
			select column_name
			from information_schema.columns
			where table_schema = 'app' and table_name = 'artwork_comment_realtime'
			order by ordinal_position
		`;

		expect(voteColumns.map((row) => row.column_name)).toEqual([
			'id',
			'artwork_id',
			'value',
			'created_at',
			'updated_at'
		]);
		expect(commentColumns.map((row) => row.column_name)).toEqual([
			'id',
			'artwork_id',
			'author_id',
			'body',
			'is_visible',
			'created_at',
			'updated_at'
		]);

		const visibleVoteRows = await asAuthenticated(sql, 'viewer-1', async (tx) =>
			tx.unsafe<Array<{ artwork_id: string; id: string }>>(
				"select id, artwork_id from app.artwork_vote_realtime where artwork_id = 'artwork-visible' order by id"
			)
		);
		const hiddenCommentRows = await asAuthenticated(sql, 'viewer-1', async (tx) =>
			tx.unsafe<Array<{ id: string }>>(
				"select id from app.artwork_comment_realtime where artwork_id = 'artwork-hidden'"
			)
		);
		const moderatorHiddenCommentRows = await asAuthenticated(sql, 'moderator-1', async (tx) =>
			tx.unsafe<Array<{ id: string }>>(
				"select id from app.artwork_comment_realtime where artwork_id = 'artwork-hidden'"
			)
		);

		expect(visibleVoteRows).toEqual([{ artwork_id: 'artwork-visible', id: 'vote-visible' }]);
		expect(hiddenCommentRows).toEqual([]);
		expect(moderatorHiddenCommentRows).toEqual([{ id: 'comment-hidden' }]);

		await expect(
			asAnonymous(sql, async (tx) =>
				tx.unsafe<Array<{ id: string }>>(
					"select id from app.artwork_vote_realtime where artwork_id = 'artwork-visible'"
				)
			)
		).rejects.toThrow();
	});

	it('keeps comment realtime rows in sync for create, hide, unhide, and delete transitions', async () => {
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-comment-events' });
		await insertComment(sql, {
			authorId: 'viewer-1',
			artworkId: 'artwork-comment-events',
			id: 'comment-event',
			body: 'Initial body'
		});

		let [realtimeComment] = await sql<
			Array<{ body: string | null; id: string; is_visible: boolean }>
		>`
			select id, body, is_visible
			from app.artwork_comment_realtime
			where id = 'comment-event'
		`;
		expect(realtimeComment).toEqual({
			body: 'Initial body',
			id: 'comment-event',
			is_visible: true
		});

		await sql`
			update app.artwork_comments
			set is_hidden = true, hidden_at = now(), updated_at = now()
			where id = 'comment-event'
		`;

		[realtimeComment] = await sql<Array<{ body: string | null; id: string; is_visible: boolean }>>`
			select id, body, is_visible
			from app.artwork_comment_realtime
			where id = 'comment-event'
		`;
		expect(realtimeComment).toEqual({ body: null, id: 'comment-event', is_visible: false });

		await sql`
			update app.artwork_comments
			set is_hidden = false, hidden_at = null, body = 'Restored body', updated_at = now()
			where id = 'comment-event'
		`;

		[realtimeComment] = await sql<Array<{ body: string | null; id: string; is_visible: boolean }>>`
			select id, body, is_visible
			from app.artwork_comment_realtime
			where id = 'comment-event'
		`;
		expect(realtimeComment).toEqual({
			body: 'Restored body',
			id: 'comment-event',
			is_visible: true
		});

		await sql`delete from app.artwork_comments where id = 'comment-event'`;

		const deletedRows = await sql<Array<{ id: string }>>`
			select id
			from app.artwork_comment_realtime
			where id = 'comment-event'
		`;
		expect(deletedRows).toEqual([]);
	});

	it('keeps service and read boundaries consistent with DB-owned counters and visibility semantics', async () => {
		const {
			applyArtworkVote,
			createArtworkComment,
			moderateArtwork,
			moderateComment,
			removeArtworkVote,
			submitContentReport
		} = await import('./service');
		const { getArtworkDetail, listArtworkCommentsForViewer } = await import('./read.service');

		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-service' });

		await applyArtworkVote(
			{ artworkId: 'artwork-service', value: 'up' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('viewer-1') }
		);
		const comment = await createArtworkComment(
			{ artworkId: 'artwork-service', body: 'Live comment' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('viewer-1') }
		);

		let publicDetail = await getArtworkDetail('artwork-service');
		let publicComments = await listArtworkCommentsForViewer('artwork-service');
		expect(publicDetail.score).toBe(1);
		expect(publicDetail.commentCount).toBe(1);
		expect(publicComments.map((entry) => entry.id)).toEqual([comment.id]);

		await moderateComment(
			{ action: 'hide', artworkId: 'artwork-service', commentId: comment.id },
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);

		publicDetail = await getArtworkDetail('artwork-service');
		publicComments = await listArtworkCommentsForViewer('artwork-service');
		const moderatorComments = await listArtworkCommentsForViewer('artwork-service', {
			user: createCanonicalUser('moderator-1', 'moderator')
		});
		expect(publicDetail.commentCount).toBe(0);
		expect(publicComments).toEqual([]);
		expect(moderatorComments.map((entry) => entry.id)).toEqual([comment.id]);

		await moderateComment(
			{ action: 'unhide', artworkId: 'artwork-service', commentId: comment.id },
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);

		publicDetail = await getArtworkDetail('artwork-service');
		publicComments = await listArtworkCommentsForViewer('artwork-service');
		expect(publicDetail.commentCount).toBe(1);
		expect(publicComments.map((entry) => entry.id)).toEqual([comment.id]);

		await removeArtworkVote(
			{ artworkId: 'artwork-service' },
			{ ipAddress: '127.0.0.1', user: createCanonicalUser('viewer-1') }
		);

		publicDetail = await getArtworkDetail('artwork-service');
		expect(publicDetail.score).toBe(0);

		await Promise.all([
			submitContentReport(
				{ artworkId: 'artwork-service', reason: 'spam' },
				{ ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-1') }
			),
			submitContentReport(
				{ artworkId: 'artwork-service', reason: 'spam' },
				{ ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-2') }
			),
			submitContentReport(
				{ artworkId: 'artwork-service', reason: 'spam' },
				{ ipAddress: '127.0.0.1', user: createCanonicalUser('reporter-3') }
			)
		]);

		await expect(getArtworkDetail('artwork-service')).rejects.toMatchObject({
			code: 'NOT_FOUND',
			status: 404
		});

		// Detail reads are public-only for every viewer since 4bb1735 ("restrict
		// artwork reads to public items"): a moderator reaches hidden work through
		// the moderation queue, not the detail view. Whether moderators and
		// authors should open hidden detail again is an open remaster decision
		// (docs/remaster/README.md); until then this pins the shipped behavior.
		await expect(
			getArtworkDetail('artwork-service', {
				user: createCanonicalUser('moderator-1', 'moderator')
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });

		await moderateArtwork(
			{ action: 'unhide', artworkId: 'artwork-service' },
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);

		publicDetail = await getArtworkDetail('artwork-service');
		expect(publicDetail.id).toBe('artwork-service');
	});

	it('resolves feed lineage in one statement without dropping forks of hidden parents', async () => {
		const { listArtworkDiscovery } = await import('./read.service');

		await insertUser(sql, 'author-2');
		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-origin' });
		await insertArtwork(sql, {
			authorId: 'author-1',
			id: 'artwork-hidden-origin',
			isHidden: true
		});
		await insertArtwork(sql, {
			authorId: 'author-2',
			id: 'artwork-fork',
			parentId: 'artwork-origin'
		});
		await insertArtwork(sql, {
			authorId: 'author-2',
			id: 'artwork-orphan-fork',
			parentId: 'artwork-hidden-origin'
		});

		const discovery = await listArtworkDiscovery({ cursor: null, limit: 20, sort: 'recent' });
		const byId = new Map(discovery.items.map((item) => [item.id, item]));

		// A fork of a hidden parent must stay in the feed with the same
		// 'deleted' lineage the two-query hydration produced; the visibility
		// predicate lives in the join condition precisely so the LEFT JOIN does
		// not silently become an inner join.
		expect(byId.get('artwork-orphan-fork')?.lineage).toMatchObject({
			isFork: true,
			parent: null,
			parentStatus: 'deleted'
		});
		expect(byId.get('artwork-fork')?.lineage).toMatchObject({
			isFork: true,
			parent: { id: 'artwork-origin', title: 'Artwork artwork-origin' },
			parentStatus: 'available'
		});
		expect(byId.get('artwork-origin')?.lineage).toMatchObject({
			isFork: false,
			parent: null,
			parentStatus: 'none'
		});
		expect(byId.get('artwork-hidden-origin')).toBeUndefined();
	});

	it('pages the top feed with a keyset predicate on the raw score column', async () => {
		const { listArtworkDiscovery } = await import('./read.service');

		for (const [index, id] of ['artwork-top-a', 'artwork-top-b', 'artwork-top-c'].entries()) {
			await insertArtwork(sql, { authorId: 'author-1', id });
			await sql`update app.artworks set score = ${3 - index} where id = ${id}`;
		}

		const firstPage = await listArtworkDiscovery({
			cursor: null,
			limit: 2,
			sort: 'top',
			window: 'all'
		});

		expect(firstPage.items.map((item) => item.id)).toEqual(['artwork-top-a', 'artwork-top-b']);
		expect(firstPage.pageInfo.hasMore).toBe(true);

		const secondPage = await listArtworkDiscovery({
			cursor: firstPage.pageInfo.nextCursor,
			limit: 2,
			sort: 'top',
			window: 'all'
		});

		expect(secondPage.items.map((item) => item.id)).toEqual(['artwork-top-c']);
		expect(secondPage.pageInfo.hasMore).toBe(false);
	});

	it('counts artwork rate-limit attempts in one statement and freezes a blocked actor', async () => {
		const { artworkRepository } = await import('./repository');

		// Two attempts per hour so the limit trips on the second one; the block
		// runs from the start of the window, which is what the artwork limits do.
		const policy: RateLimitPolicy = {
			blockAnchor: 'window-start',
			blockMs: 60 * 60 * 1000,
			maxAttempts: 2,
			windowMs: 60 * 60 * 1000
		};
		const windowStart = new Date('2026-03-27T12:00:00.000Z');
		const trippingAttempt = new Date('2026-03-27T12:01:00.000Z');
		const blockedAttempt = new Date('2026-03-27T12:02:00.000Z');
		const expectedBlockedUntil = new Date(windowStart.getTime() + policy.blockMs);

		const opened = await artworkRepository.recordEngagementRateLimitAttempt({
			actorKey: 'viewer-1:127.0.0.1',
			id: 'engagement-limit-1',
			kind: 'vote',
			now: windowStart,
			policy
		});

		expect(opened).toMatchObject({ attemptCount: 1, blockedUntil: null, id: 'engagement-limit-1' });
		expect(opened.windowStartedAt.toISOString()).toBe(windowStart.toISOString());

		const tripped = await artworkRepository.recordEngagementRateLimitAttempt({
			actorKey: 'viewer-1:127.0.0.1',
			// The id only lands with the insert; on conflict the stored row keeps its own.
			id: 'engagement-limit-2',
			kind: 'vote',
			now: trippingAttempt,
			policy
		});

		expect(tripped).toMatchObject({ attemptCount: 2, id: 'engagement-limit-1' });
		expect(tripped.blockedUntil?.toISOString()).toBe(expectedBlockedUntil.toISOString());

		const hammered = await artworkRepository.recordEngagementRateLimitAttempt({
			actorKey: 'viewer-1:127.0.0.1',
			id: 'engagement-limit-3',
			kind: 'vote',
			now: blockedAttempt,
			policy
		});

		// Blocked means frozen: the attempt is recorded, but the counter does not
		// bump, the window does not roll forward and the block does not extend.
		expect(hammered.attemptCount).toBe(2);
		expect(hammered.windowStartedAt.toISOString()).toBe(windowStart.toISOString());
		expect(hammered.blockedUntil?.toISOString()).toBe(expectedBlockedUntil.toISOString());
		expect(hammered.lastAttemptAt.toISOString()).toBe(blockedAttempt.toISOString());

		// The other engagement kind is a different actor row, not the same counter.
		const otherKind = await artworkRepository.recordEngagementRateLimitAttempt({
			actorKey: 'viewer-1:127.0.0.1',
			id: 'engagement-limit-4',
			kind: 'comment',
			now: blockedAttempt,
			policy
		});

		expect(otherKind).toMatchObject({ attemptCount: 1, blockedUntil: null });

		// Same clause, second table: the publish limit is keyed by actor alone.
		const publishOpened = await artworkRepository.recordPublishRateLimitAttempt({
			actorKey: 'author-1:127.0.0.1',
			id: 'publish-limit-1',
			now: windowStart,
			policy
		});
		const publishTripped = await artworkRepository.recordPublishRateLimitAttempt({
			actorKey: 'author-1:127.0.0.1',
			id: 'publish-limit-2',
			now: trippingAttempt,
			policy
		});
		const publishHammered = await artworkRepository.recordPublishRateLimitAttempt({
			actorKey: 'author-1:127.0.0.1',
			id: 'publish-limit-3',
			now: blockedAttempt,
			policy
		});

		expect(publishOpened).toMatchObject({ attemptCount: 1, blockedUntil: null });
		expect(publishTripped.blockedUntil?.toISOString()).toBe(expectedBlockedUntil.toISOString());
		expect(publishHammered.attemptCount).toBe(2);
		expect(publishHammered.windowStartedAt.toISOString()).toBe(windowStart.toISOString());
		expect(publishHammered.blockedUntil?.toISOString()).toBe(expectedBlockedUntil.toISOString());
	});

	it('freezes a blocked auth actor without extending its block', async () => {
		const { AuthRateLimitError, recordFailure } = await import('$lib/server/auth/rate-limit');
		const { AUTH_RATE_LIMITS } = await import('$lib/server/auth/config');

		const readRow = async () => {
			const [row] = await sql`
				select attempt_count, blocked_until, window_started_at, last_attempt_at
				from app.auth_rate_limits
				where kind = 'login' and actor_key = ${'login:viewer-1_nick:127.0.0.1'}
			`;

			return row as {
				attempt_count: number;
				blocked_until: Date | null;
				last_attempt_at: Date;
				window_started_at: Date;
			};
		};

		for (let attempt = 1; attempt < AUTH_RATE_LIMITS.login.maxFailures; attempt += 1) {
			await recordFailure('login', 'viewer-1_nick', '127.0.0.1');
			expect((await readRow()).attempt_count).toBe(attempt);
		}

		await expect(recordFailure('login', 'viewer-1_nick', '127.0.0.1')).rejects.toBeInstanceOf(
			AuthRateLimitError
		);

		const blocked = await readRow();
		expect(blocked.attempt_count).toBe(AUTH_RATE_LIMITS.login.maxFailures);
		expect(blocked.blocked_until).not.toBeNull();

		await expect(recordFailure('login', 'viewer-1_nick', '127.0.0.1')).rejects.toBeInstanceOf(
			AuthRateLimitError
		);

		const hammered = await readRow();
		expect(hammered.attempt_count).toBe(blocked.attempt_count);
		expect(hammered.blocked_until?.getTime()).toBe(blocked.blocked_until?.getTime());
		expect(hammered.window_started_at.getTime()).toBe(blocked.window_started_at.getTime());
		expect(hammered.last_attempt_at.getTime()).toBeGreaterThanOrEqual(
			blocked.last_attempt_at.getTime()
		);
	});

	it('draws a random artwork only from visible rows', async () => {
		const { getRandomArtwork } = await import('./read.service');

		await insertArtwork(sql, { authorId: 'author-1', id: 'artwork-visible' });
		await insertArtwork(sql, {
			authorId: 'author-1',
			id: 'artwork-invisible',
			isHidden: true
		});

		await expect(getRandomArtwork()).resolves.toMatchObject({ id: 'artwork-visible' });
	});
});
