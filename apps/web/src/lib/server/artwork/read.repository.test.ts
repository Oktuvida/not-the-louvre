import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { SQL } from 'drizzle-orm';

type QueryCall = { args: unknown[]; method: string };

type RecordedQuery = {
	calls: QueryCall[];
	fields: Record<string, unknown>;
};

const state = vi.hoisted(() => ({
	queries: [] as RecordedQuery[],
	rows: [] as unknown[][]
}));

const createQueryBuilder = (recorded: RecordedQuery) => {
	const builder: Record<string, unknown> = {};

	for (const method of [
		'from',
		'innerJoin',
		'leftJoin',
		'where',
		'groupBy',
		'having',
		'orderBy',
		'limit'
	]) {
		builder[method] = (...args: unknown[]) => {
			recorded.calls.push({ args, method });
			return builder;
		};
	}

	builder.then = (
		onFulfilled?: (value: unknown[]) => unknown,
		onRejected?: (reason: unknown) => unknown
	) => Promise.resolve(state.rows.shift() ?? []).then(onFulfilled, onRejected);

	return builder;
};

vi.mock('$lib/server/db', () => ({
	db: {
		select: (fields: Record<string, unknown>) => {
			const recorded: RecordedQuery = { calls: [], fields };
			state.queries.push(recorded);
			return createQueryBuilder(recorded);
		}
	}
}));

const dialect = new PgDialect();

const renderSql = (value: unknown) =>
	value instanceof SQL ? dialect.sqlToQuery(value).sql : String(value);

const argumentAt = (query: RecordedQuery, method: string, index = 0) =>
	query.calls.filter((call) => call.method === method)[index]?.args ?? [];

const createdAt = new Date('2026-03-28T10:00:00.000Z');

const artworkRow = (overrides: Record<string, unknown> = {}) => ({
	authorAvatarUrl: null,
	authorId: 'author-1',
	authorNickname: 'painter',
	commentCount: 0,
	createdAt,
	forkCount: 0,
	hiddenAt: null,
	id: 'artwork-1',
	isHidden: false,
	isNsfw: false,
	mediaContentType: 'image/avif',
	mediaPlaceholder: null,
	mediaSizeBytes: 128,
	parentId: null,
	score: 7,
	storageKey: 'artworks/artwork-1.avif',
	title: 'Study',
	updatedAt: createdAt,
	...overrides
});

describe('artwork read repository statements', () => {
	beforeEach(() => {
		state.queries.length = 0;
		state.rows.length = 0;
	});

	it('resolves fork parents inside the feed statement instead of a second round trip', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([
			artworkRow({
				parentAuthorAvatarUrl: 'avatars/author-2.avif',
				parentAuthorId: 'author-2',
				parentAuthorNickname: 'origin',
				parentId: 'artwork-0',
				parentTitle: 'Origin'
			})
		]);

		const records = await artworkReadRepository.listRecentArtworks({
			cursor: null,
			limit: 24
		});

		expect(state.queries).toHaveLength(1);
		expect(records[0]).toMatchObject({
			parentAuthorId: 'author-2',
			parentAuthorNickname: 'origin',
			parentTitle: 'Origin'
		});
	});

	it('keeps the hidden-parent predicate in the join condition so forks of hidden parents survive', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([artworkRow({ parentId: 'artwork-0' })]);

		await artworkReadRepository.listRecentArtworks({ cursor: null, limit: 24 });

		const [query] = state.queries;
		const [, parentJoinCondition] = argumentAt(query!, 'leftJoin', 0);
		const [whereCondition] = argumentAt(query!, 'where', 0);

		expect(renderSql(parentJoinCondition)).toContain('"is_hidden"');
		expect(renderSql(whereCondition)).not.toContain('parent_artwork');
	});

	it('compares the raw score column against the top cursor so a btree on score stays usable', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([]);

		await artworkReadRepository.listTopArtworks({
			cursor: {
				createdAt,
				id: 'artwork-9',
				rankingValue: 12,
				snapshotAt: createdAt,
				sort: 'top',
				window: 'all'
			},
			limit: 24,
			now: createdAt,
			window: 'all'
		});

		const [whereCondition] = argumentAt(state.queries[0]!, 'where', 0);
		const rendered = renderSql(whereCondition);

		expect(rendered).toContain('"artworks"."score" <');
		expect(rendered).not.toContain('"artworks"."score"::double precision <');
	});

	it('draws a random artwork id before paying for the join and the vote subqueries', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([{ id: 'artwork-7' }]);
		state.rows.push([artworkRow({ id: 'artwork-7' })]);

		const record = await artworkReadRepository.findRandomArtwork();

		expect(record).toMatchObject({ id: 'artwork-7' });
		expect(state.queries).toHaveLength(2);
		expect(Object.keys(state.queries[0]!.fields)).toEqual(['id']);
		expect(state.queries[0]!.calls.some((call) => call.method === 'innerJoin')).toBe(false);
		expect(renderSql(argumentAt(state.queries[0]!, 'orderBy', 0)[0])).toContain('random()');
		expect(renderSql(argumentAt(state.queries[1]!, 'where', 0)[0])).toContain('"artworks"."id" =');
	});

	it('returns null without a second statement when the random draw finds nothing', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([]);

		await expect(artworkReadRepository.findRandomArtwork()).resolves.toBeNull();
		expect(state.queries).toHaveLength(1);
	});

	it('drops the drawing document from the detail select unless the fork loader asks for it', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([artworkRow()]);
		state.rows.push([]);

		await artworkReadRepository.findArtworkDetailById('artwork-1');

		expect(state.queries[0]!.fields).not.toHaveProperty('drawingDocument');

		state.queries.length = 0;
		state.rows.push([artworkRow()]);
		state.rows.push([]);

		await artworkReadRepository.findArtworkDetailById('artwork-1', undefined, {
			withDrawingDocument: true
		});

		expect(state.queries[0]!.fields).toHaveProperty('drawingDocument');
	});

	it('bounds both moderation queue aggregates in SQL instead of paginating the whole backlog', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([]);
		state.rows.push([]);

		await artworkReadRepository.listModerationQueue({ cursor: null, limit: 21 });

		expect(state.queries).toHaveLength(2);
		for (const query of state.queries) {
			expect(argumentAt(query, 'limit', 0)).toEqual([21]);
			expect(argumentAt(query, 'orderBy', 0).length).toBeGreaterThan(0);
		}
	});

	it('pushes the moderation queue cursor into each aggregate having clause', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([]);
		state.rows.push([]);

		await artworkReadRepository.listModerationQueue({
			cursor: { id: 'artwork-3', reportCount: 4, targetType: 'artwork' },
			limit: 21
		});

		const [artworkQuery, commentQuery] = state.queries;
		const artworkHaving = renderSql(argumentAt(artworkQuery!, 'having', 0)[0]);
		const commentHaving = renderSql(argumentAt(commentQuery!, 'having', 0)[0]);

		// Same target type as the cursor: ties break on the id.
		expect(artworkHaving).toContain('"artworks"."id" >');
		// 'comment' sorts after 'artwork', so an equal report count still qualifies.
		expect(commentHaving).toContain('<=');
	});

	it('keeps the moderation queue ordering stable across the two bounded aggregates', async () => {
		const { artworkReadRepository } = await import('./read.repository');

		state.rows.push([
			{
				artworkId: 'artwork-1',
				authorId: 'author-1',
				authorNickname: 'painter',
				contentSummary: 'Study',
				isHidden: false,
				reportCount: 2
			}
		]);
		state.rows.push([
			{
				artworkId: 'artwork-2',
				authorId: 'author-2',
				authorNickname: 'sketcher',
				commentId: 'comment-1',
				contentSummary: 'rude',
				isHidden: false,
				reportCount: 5
			}
		]);

		const items = await artworkReadRepository.listModerationQueue({ cursor: null, limit: 1 });

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ commentId: 'comment-1', targetType: 'comment' });
	});
});
