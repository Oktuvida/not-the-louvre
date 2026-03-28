import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

type DbClient = Sql<Record<string, unknown>>;
type ProductRole = 'admin' | 'moderator' | 'user';
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

		const moderatorDetail = await getArtworkDetail('artwork-service', {
			user: createCanonicalUser('moderator-1', 'moderator')
		});
		expect(moderatorDetail.id).toBe('artwork-service');

		await moderateArtwork(
			{ action: 'unhide', artworkId: 'artwork-service' },
			{ user: createCanonicalUser('moderator-1', 'moderator') }
		);

		publicDetail = await getArtworkDetail('artwork-service');
		expect(publicDetail.id).toBe('artwork-service');
	});
});
