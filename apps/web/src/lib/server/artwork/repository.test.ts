import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
	type ReportRecord = {
		artworkId: string | null;
		commentId: string | null;
		createdAt: Date;
		details: string | null;
		id: string;
		reason: string;
		reporterId: string;
		reviewedAt: Date | null;
		reviewedBy: string | null;
		status: 'actioned' | 'pending' | 'reviewed';
		updatedAt: Date;
	};

	type ArtworkRecord = {
		authorId: string;
		commentCount: number;
		createdAt: Date;
		forkCount: number;
		hiddenAt: Date | null;
		id: string;
		isHidden: boolean;
		mediaContentType: string;
		mediaSizeBytes: number;
		parentId: string | null;
		score: number;
		storageKey: string;
		title: string;
		updatedAt: Date;
	};

	type CommentRecord = {
		authorId: string;
		artworkId: string;
		body: string;
		createdAt: Date;
		hiddenAt: Date | null;
		id: string;
		isHidden: boolean;
		updatedAt: Date;
	};

	const state = {
		artworks: new Map<string, ArtworkRecord>(),
		comments: new Map<string, CommentRecord>(),
		reports: new Map<string, ReportRecord>(),
		reset() {
			this.artworks.clear();
			this.comments.clear();
			this.reports.clear();
		}
	};

	const schema = {
		artworks: { id: 'artworks.id' },
		artworkComments: { id: 'artwork_comments.id' },
		contentReports: {
			artworkId: 'content_reports.artwork_id',
			commentId: 'content_reports.comment_id',
			id: 'content_reports.id',
			reviewedAt: 'content_reports.reviewed_at',
			reviewedBy: 'content_reports.reviewed_by',
			status: 'content_reports.status',
			updatedAt: 'content_reports.updated_at'
		}
	};

	const getEqValue = (condition: unknown, column: string): unknown => {
		if (!condition || typeof condition !== 'object') return undefined;
		const candidate = condition as {
			column?: string;
			conditions?: unknown[];
			type?: string;
			value?: unknown;
		};
		if (candidate.type === 'eq' && candidate.column === column) {
			return candidate.value;
		}
		if (candidate.type === 'and' && Array.isArray(candidate.conditions)) {
			for (const nested of candidate.conditions) {
				const value: unknown = getEqValue(nested, column);
				if (value !== undefined) return value;
			}
		}

		return undefined;
	};

	const db = {
		insert: vi.fn((table: unknown) => ({
			values: (values: ReportRecord) => ({
				returning: async () => {
					if (table !== schema.contentReports) return [];
					state.reports.set(values.id, values);
					return [values];
				}
			})
		})),
		select: vi.fn(() => ({
			from: (table: unknown) => ({
				where: async (condition: unknown) => {
					if (table !== schema.contentReports) return [];

					const artworkId = getEqValue(condition, schema.contentReports.artworkId);
					if (typeof artworkId === 'string') {
						return [
							{
								value: Array.from(state.reports.values()).filter(
									(report) => report.artworkId === artworkId && report.status === 'pending'
								).length
							}
						];
					}

					const commentId = getEqValue(condition, schema.contentReports.commentId);
					if (typeof commentId === 'string') {
						return [
							{
								value: Array.from(state.reports.values()).filter(
									(report) => report.commentId === commentId && report.status === 'pending'
								).length
							}
						];
					}

					return [{ value: 0 }];
				}
			})
		})),
		update: vi.fn((table: unknown) => ({
			set: (values: Record<string, unknown>) => ({
				where: (condition: unknown) => ({
					returning: async () => {
						if (table === schema.contentReports) {
							const artworkId = getEqValue(condition, schema.contentReports.artworkId);
							const commentId = getEqValue(condition, schema.contentReports.commentId);
							const nextReports = Array.from(state.reports.values())
								.filter((report) => {
									if (report.status !== 'pending') return false;
									if (typeof artworkId === 'string') return report.artworkId === artworkId;
									if (typeof commentId === 'string') return report.commentId === commentId;
									return false;
								})
								.map((report) => {
									const next = { ...report, ...values } as ReportRecord;
									state.reports.set(next.id, next);
									return { id: next.id };
								});

							return nextReports;
						}

						if (table === schema.artworks) {
							const id = getEqValue(condition, schema.artworks.id);
							if (typeof id !== 'string') return [];
							const current = state.artworks.get(id);
							if (!current) return [];
							const next = { ...current, ...values };
							state.artworks.set(id, next);
							return [next];
						}

						if (table === schema.artworkComments) {
							const id = getEqValue(condition, schema.artworkComments.id);
							if (typeof id !== 'string') return [];
							const current = state.comments.get(id);
							if (!current) return [];
							const next = { ...current, ...values };
							state.comments.set(id, next);
							return [next];
						}

						return [];
					}
				})
			})
		})),
		query: {},
		transaction: vi.fn()
	};

	return { db, schema, state };
});

vi.mock('drizzle-orm', () => ({
	and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
	asc: (value: unknown) => value,
	count: () => ({ type: 'count' }),
	eq: (column: string, value: unknown) => ({ type: 'eq', column, value }),
	isNotNull: (value: unknown) => value,
	sql: Object.assign(
		(strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
		{
			raw: (value: string) => value
		}
	)
}));

vi.mock('$lib/server/db', () => ({
	db: mocked.db
}));

vi.mock('$lib/server/db/schema', () => ({
	artworkComments: mocked.schema.artworkComments,
	artworkEngagementRateLimits: {},
	artworkPublishRateLimits: {},
	artworkVotes: {},
	artworks: mocked.schema.artworks,
	contentReports: mocked.schema.contentReports,
	users: {}
}));

describe('artwork repository reporting persistence', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.state.reset();
	});

	it('persists report records with exactly one target', async () => {
		const { artworkRepository } = await import('./repository');
		const now = new Date('2026-03-27T01:00:00.000Z');

		const report = await artworkRepository.createContentReport({
			artworkId: 'artwork-1',
			commentId: null,
			createdAt: now,
			details: 'spam link',
			id: 'report-1',
			reason: 'spam',
			reporterId: 'user-1',
			reviewedAt: null,
			reviewedBy: null,
			status: 'pending',
			updatedAt: now
		});

		expect(report).toMatchObject({
			artworkId: 'artwork-1',
			commentId: null,
			reason: 'spam',
			reporterId: 'user-1'
		});
	});

	it('counts active reports per artwork and comment target', async () => {
		const { artworkRepository } = await import('./repository');
		const now = new Date('2026-03-27T01:00:00.000Z');

		mocked.state.reports.set('report-1', {
			artworkId: 'artwork-1',
			commentId: null,
			createdAt: now,
			details: null,
			id: 'report-1',
			reason: 'spam',
			reporterId: 'user-1',
			reviewedAt: null,
			reviewedBy: null,
			status: 'pending',
			updatedAt: now
		});
		mocked.state.reports.set('report-2', {
			artworkId: 'artwork-1',
			commentId: null,
			createdAt: now,
			details: null,
			id: 'report-2',
			reason: 'harassment',
			reporterId: 'user-2',
			reviewedAt: null,
			reviewedBy: null,
			status: 'reviewed',
			updatedAt: now
		});
		mocked.state.reports.set('report-3', {
			artworkId: null,
			commentId: 'comment-1',
			createdAt: now,
			details: null,
			id: 'report-3',
			reason: 'hate',
			reporterId: 'user-3',
			reviewedAt: null,
			reviewedBy: null,
			status: 'pending',
			updatedAt: now
		});

		await expect(artworkRepository.findArtworkReportCount('artwork-1')).resolves.toBe(1);
		await expect(artworkRepository.findCommentReportCount('comment-1')).resolves.toBe(1);
	});

	it('resolves pending reports for a moderation target with reviewer attribution', async () => {
		const { artworkRepository } = await import('./repository');
		const now = new Date('2026-03-27T03:00:00.000Z');

		mocked.state.reports.set('report-1', {
			artworkId: 'artwork-1',
			commentId: null,
			createdAt: now,
			details: null,
			id: 'report-1',
			reason: 'spam',
			reporterId: 'user-1',
			reviewedAt: null,
			reviewedBy: null,
			status: 'pending',
			updatedAt: now
		});
		mocked.state.reports.set('report-2', {
			artworkId: 'artwork-1',
			commentId: null,
			createdAt: now,
			details: null,
			id: 'report-2',
			reason: 'spam',
			reporterId: 'user-2',
			reviewedAt: null,
			reviewedBy: null,
			status: 'pending',
			updatedAt: now
		});

		const resolvedCount = await artworkRepository.resolveArtworkReports({
			resolvedAt: now,
			resolvedBy: 'moderator-1',
			status: 'reviewed',
			targetId: 'artwork-1'
		});

		expect(resolvedCount).toBe(2);
		expect(Array.from(mocked.state.reports.values())).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ reviewedBy: 'moderator-1', status: 'reviewed' })
			])
		);
	});

	it('persists hidden-state transitions for artworks and comments', async () => {
		const { artworkRepository } = await import('./repository');
		const now = new Date('2026-03-27T02:00:00.000Z');

		mocked.state.artworks.set('artwork-1', {
			authorId: 'author-1',
			commentCount: 0,
			createdAt: now,
			forkCount: 0,
			hiddenAt: null,
			id: 'artwork-1',
			isHidden: false,
			mediaContentType: 'image/avif',
			mediaSizeBytes: 128,
			parentId: null,
			score: 0,
			storageKey: 'artworks/author-1/artwork-1.avif',
			title: 'Artwork 1',
			updatedAt: now
		});
		mocked.state.comments.set('comment-1', {
			authorId: 'author-2',
			artworkId: 'artwork-1',
			body: 'Comment 1',
			createdAt: now,
			hiddenAt: null,
			id: 'comment-1',
			isHidden: false,
			updatedAt: now
		});

		const hiddenAt = new Date('2026-03-27T02:05:00.000Z');

		const hiddenArtwork = await artworkRepository.setArtworkHiddenState('artwork-1', {
			hiddenAt,
			isHidden: true,
			updatedAt: hiddenAt
		});
		const hiddenComment = await artworkRepository.setCommentHiddenState('comment-1', {
			hiddenAt,
			isHidden: true,
			updatedAt: hiddenAt
		});

		expect(hiddenArtwork).toMatchObject({ hiddenAt, id: 'artwork-1', isHidden: true });
		expect(hiddenComment).toMatchObject({ hiddenAt, id: 'comment-1', isHidden: true });
	});
});
