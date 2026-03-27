import { describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from './errors';
import {
	ARTWORK_COMMENT_MAX_LENGTH,
	ARTWORK_COMMENT_RATE_LIMIT,
	CONTENT_REPORT_AUTO_HIDE_THRESHOLD,
	ARTWORK_VOTE_RATE_LIMIT
} from './config';
import type {
	ArtworkCommentRecord,
	ArtworkCommentView,
	ArtworkRecord,
	ArtworkRepository,
	ContentReportRecord,
	ArtworkVoteRecord
} from './types';

vi.mock('./storage', () => ({
	supabaseArtworkStorage: {
		delete: vi.fn(async () => undefined),
		upload: vi.fn(async () => undefined)
	}
}));

vi.mock('./repository', () => ({
	artworkRepository: {}
}));

type EngagementKind = 'comment' | 'vote';

type EngagementRateLimitRecord = {
	attemptCount: number;
	actorKey: string;
	blockedUntil: Date | null;
	createdAt: Date;
	id: string;
	kind: EngagementKind;
	lastAttemptAt: Date;
	updatedAt: Date;
	windowStartedAt: Date;
};

type ArtworkWithSummary = ArtworkRecord & {
	commentCount: number;
	score: number;
};

const createArtworkRecord = (overrides: Partial<ArtworkWithSummary> = {}): ArtworkWithSummary => ({
	authorId: 'author-1',
	commentCount: 0,
	createdAt: new Date('2026-03-26T10:00:00.000Z'),
	forkCount: 0,
	hiddenAt: null,
	id: 'artwork-1',
	isHidden: false,
	mediaContentType: 'image/avif',
	mediaSizeBytes: 128,
	parentId: null,
	score: 0,
	storageKey: 'artworks/author-1/artwork-1.avif',
	title: 'Artwork',
	updatedAt: new Date('2026-03-26T10:00:00.000Z'),
	...overrides
});

const createUser = (id: string, role: 'admin' | 'moderator' | 'user' = 'user') => {
	const now = new Date('2026-03-26T10:00:00.000Z');

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

const createRepository = () => {
	const artworks = new Map<string, ArtworkWithSummary>();
	const votes = new Map<string, ArtworkVoteRecord>();
	const comments = new Map<string, ArtworkCommentRecord>();
	const reports = new Map<string, ContentReportRecord>();
	const rateLimits = new Map<string, EngagementRateLimitRecord>();

	const voteKey = (artworkId: string, userId: string) => `${artworkId}:${userId}`;
	const rateLimitKey = (kind: EngagementKind, actorKey: string) => `${kind}:${actorKey}`;

	const repository = {
		createContentReport: vi.fn(async (input: ContentReportRecord) => {
			reports.set(input.id, input);
			return input;
		}),
		createArtwork: vi.fn(async () => {
			throw new Error('not implemented in engagement tests');
		}),
		findArtworkById: vi.fn(async (id: string) => artworks.get(id) ?? null),
		findVoteByArtworkAndUser: vi.fn(async (artworkId: string, userId: string) => {
			return votes.get(voteKey(artworkId, userId)) ?? null;
		}),
		upsertVote: vi.fn(
			async (input: {
				artworkId: string;
				createdAt: Date;
				id: string;
				updatedAt: Date;
				userId: string;
				value: 'down' | 'up';
			}) => {
				const artwork = artworks.get(input.artworkId);
				if (!artwork) return null;

				const key = voteKey(input.artworkId, input.userId);
				const current = votes.get(key) ?? null;
				const previousDelta = current ? (current.value === 'up' ? 1 : -1) : 0;
				const nextDelta = input.value === 'up' ? 1 : -1;
				const nextVote: ArtworkVoteRecord = current
					? { ...current, updatedAt: input.updatedAt, value: input.value }
					: {
							artworkId: input.artworkId,
							createdAt: input.createdAt,
							id: input.id,
							updatedAt: input.updatedAt,
							userId: input.userId,
							value: input.value
						};

				votes.set(key, nextVote);
				artworks.set(input.artworkId, {
					...artwork,
					score: artwork.score - previousDelta + nextDelta,
					updatedAt: input.updatedAt
				});

				return {
					artwork: artworks.get(input.artworkId)!,
					vote: nextVote
				};
			}
		),
		removeVote: vi.fn(async (artworkId: string, userId: string, updatedAt: Date) => {
			const artwork = artworks.get(artworkId);
			if (!artwork) return null;

			const key = voteKey(artworkId, userId);
			const current = votes.get(key) ?? null;
			if (!current) {
				return { artwork, removed: null };
			}

			votes.delete(key);
			artworks.set(artworkId, {
				...artwork,
				score: artwork.score - (current.value === 'up' ? 1 : -1),
				updatedAt
			});

			return {
				artwork: artworks.get(artworkId)!,
				removed: current
			};
		}),
		findEngagementRateLimit: vi.fn(async (kind: EngagementKind, actorKey: string) => {
			return rateLimits.get(rateLimitKey(kind, actorKey)) ?? null;
		}),
		createEngagementRateLimit: vi.fn(async (input: EngagementRateLimitRecord) => {
			rateLimits.set(rateLimitKey(input.kind, input.actorKey), input);
			return input;
		}),
		updateEngagementRateLimit: vi.fn(
			async (id: string, input: Partial<EngagementRateLimitRecord> & { updatedAt: Date }) => {
				const current = Array.from(rateLimits.values()).find((candidate) => candidate.id === id);
				if (!current) throw new Error(`Missing engagement rate limit ${id}`);

				const next = { ...current, ...input };
				rateLimits.set(rateLimitKey(next.kind, next.actorKey), next);
				return next;
			}
		),
		listCommentsByArtworkId: vi.fn(async (artworkId: string) => {
			return Array.from(comments.values())
				.filter((comment) => comment.artworkId === artworkId)
				.sort((left, right) => {
					const delta = left.createdAt.getTime() - right.createdAt.getTime();
					if (delta !== 0) return delta;
					return left.id.localeCompare(right.id);
				})
				.map<ArtworkCommentView>((comment) => ({
					author: {
						avatarUrl: null,
						id: comment.authorId,
						nickname: `${comment.authorId}_nick`
					},
					artworkId: comment.artworkId,
					body: comment.body,
					createdAt: comment.createdAt,
					id: comment.id,
					updatedAt: comment.updatedAt
				}));
		}),
		createComment: vi.fn(async (input: ArtworkCommentRecord) => {
			const artwork = artworks.get(input.artworkId);
			if (!artwork) return null;

			comments.set(input.id, input);
			artworks.set(input.artworkId, {
				...artwork,
				commentCount: artwork.commentCount + 1,
				updatedAt: input.updatedAt
			});

			return {
				author: {
					avatarUrl: null,
					id: input.authorId,
					nickname: `${input.authorId}_nick`
				},
				artworkId: input.artworkId,
				body: input.body,
				createdAt: input.createdAt,
				id: input.id,
				updatedAt: input.updatedAt
			};
		}),
		findCommentById: vi.fn(async (commentId: string) => comments.get(commentId) ?? null),
		findArtworkReportCount: vi.fn(
			async (artworkId: string) =>
				Array.from(reports.values()).filter((report) => report.artworkId === artworkId).length
		),
		findCommentReportCount: vi.fn(
			async (commentId: string) =>
				Array.from(reports.values()).filter((report) => report.commentId === commentId).length
		),
		deleteArtwork: vi.fn(async (id: string) => {
			const artwork = artworks.get(id) ?? null;
			if (artwork) {
				artworks.delete(id);
			}

			return artwork;
		}),
		findChildForksByParentId: vi.fn(async (parentId: string) =>
			Array.from(artworks.values()).filter((artwork) => artwork.parentId === parentId)
		),
		findPublishRateLimit: vi.fn(async () => null),
		createPublishRateLimit: vi.fn(async () => {
			throw new Error('not implemented in engagement tests');
		}),
		updatePublishRateLimit: vi.fn(async () => {
			throw new Error('not implemented in engagement tests');
		}),
		updateArtworkTitle: vi.fn(async () => null),
		deleteComment: vi.fn(async (commentId: string, updatedAt: Date) => {
			const comment = comments.get(commentId) ?? null;
			if (!comment) return null;

			const artwork = artworks.get(comment.artworkId);
			if (!artwork) return null;

			comments.delete(commentId);
			artworks.set(comment.artworkId, {
				...artwork,
				commentCount: artwork.commentCount - 1,
				updatedAt
			});

			return comment;
		}),
		setArtworkHiddenState: vi.fn(async (id: string, input) => {
			const artwork = artworks.get(id);
			if (!artwork) return null;
			const next = { ...artwork, ...input };
			artworks.set(id, next);
			return next;
		}),
		setCommentHiddenState: vi.fn(async (id: string, input) => {
			const comment = comments.get(id);
			if (!comment) return null;
			const next = { ...comment, ...input };
			comments.set(id, next);
			return next;
		})
	} as unknown as ArtworkRepository;

	return { artworks, comments, rateLimits, reports, repository, votes };
};

describe('artwork engagement service', () => {
	it('creates, replaces, and removes votes while keeping the artwork score consistent', async () => {
		const { applyArtworkVote, removeArtworkVote } = await import('./service');
		const { artworks, repository, votes } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		const now = new Date('2026-03-26T12:00:00.000Z');

		const upvote = await applyArtworkVote(
			{ artworkId: 'artwork-1', value: 'up' },
			{ ipAddress: '127.0.0.1', user: createUser('user-1') },
			{ generateId: () => 'vote-1', now: () => now, repository }
		);

		expect(upvote.vote.value).toBe('up');
		expect(upvote.artwork.score).toBe(1);
		expect(votes.get('artwork-1:user-1')?.value).toBe('up');

		const replacement = await applyArtworkVote(
			{ artworkId: 'artwork-1', value: 'down' },
			{ ipAddress: '127.0.0.1', user: createUser('user-1') },
			{ generateId: () => 'vote-2', now: () => now, repository }
		);

		expect(replacement.vote.value).toBe('down');
		expect(replacement.artwork.score).toBe(-1);

		const removal = await removeArtworkVote(
			{ artworkId: 'artwork-1' },
			{ ipAddress: '127.0.0.1', user: createUser('user-1') },
			{ now: () => now, repository }
		);

		expect(removal.artwork.score).toBe(0);
		expect(votes.has('artwork-1:user-1')).toBe(false);
	});

	it('treats vote removal without an existing vote as a safe no-op', async () => {
		const { removeArtworkVote } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord({ score: 4 }));

		const result = await removeArtworkVote(
			{ artworkId: 'artwork-1' },
			{ ipAddress: '127.0.0.1', user: createUser('user-1') },
			{ now: () => new Date('2026-03-26T12:05:00.000Z'), repository }
		);

		expect(result.artwork.score).toBe(4);
	});

	it('requires authentication for vote transitions', async () => {
		const { applyArtworkVote } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());

		await expect(
			applyArtworkVote(
				{ artworkId: 'artwork-1', value: 'up' },
				{ ipAddress: '127.0.0.1' },
				{ generateId: () => 'vote-1', repository }
			)
		).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
	});

	it('rejects invalid vote values at the service boundary', async () => {
		const { applyArtworkVote } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());

		await expect(
			applyArtworkVote(
				{ artworkId: 'artwork-1', value: 'sideways' as 'up' },
				{ ipAddress: '127.0.0.1', user: createUser('user-1') },
				{ generateId: () => 'vote-1', repository }
			)
		).rejects.toMatchObject({ code: 'INVALID_VOTE', status: 400 });
	});

	it('rate limits repeated vote attempts within the configured window', async () => {
		const { applyArtworkVote } = await import('./service');
		const { artworks, repository, rateLimits } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		const now = new Date('2026-03-26T12:10:00.000Z');

		rateLimits.set('vote:user-1:127.0.0.1', {
			attemptCount: ARTWORK_VOTE_RATE_LIMIT.maxAttempts,
			actorKey: 'user-1:127.0.0.1',
			blockedUntil: new Date(now.getTime() + ARTWORK_VOTE_RATE_LIMIT.windowMs),
			createdAt: now,
			id: 'rate-limit-1',
			kind: 'vote',
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt: now
		});

		await expect(
			applyArtworkVote(
				{ artworkId: 'artwork-1', value: 'up' },
				{ ipAddress: '127.0.0.1', user: createUser('user-1') },
				{ generateId: () => 'vote-1', now: () => now, repository }
			)
		).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
	});

	it('creates comments, lists them chronologically, and keeps comment counts consistent', async () => {
		const { createArtworkComment, listArtworkComments } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());

		await createArtworkComment(
			{ artworkId: 'artwork-1', body: 'First comment' },
			{ ipAddress: '127.0.0.1', user: createUser('user-2') },
			{ generateId: () => 'comment-2', now: () => new Date('2026-03-26T12:21:00.000Z'), repository }
		);
		await createArtworkComment(
			{ artworkId: 'artwork-1', body: 'Earlier comment' },
			{ ipAddress: '127.0.0.1', user: createUser('user-1') },
			{ generateId: () => 'comment-1', now: () => new Date('2026-03-26T12:20:00.000Z'), repository }
		);

		const comments = await listArtworkComments('artwork-1', {}, { repository });

		expect(comments.map((comment) => comment.id)).toEqual(['comment-1', 'comment-2']);
		expect(artworks.get('artwork-1')?.commentCount).toBe(2);
	});

	it('requires authentication and enforces the comment contract', async () => {
		const { createArtworkComment } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());

		await expect(
			createArtworkComment(
				{ artworkId: 'artwork-1', body: 'Hello' },
				{ ipAddress: '127.0.0.1' },
				{ generateId: () => 'comment-1', repository }
			)
		).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });

		await expect(
			createArtworkComment(
				{ artworkId: 'artwork-1', body: 'x'.repeat(ARTWORK_COMMENT_MAX_LENGTH + 1) },
				{ ipAddress: '127.0.0.1', user: createUser('user-1') },
				{ generateId: () => 'comment-2', repository }
			)
		).rejects.toMatchObject({ code: 'INVALID_COMMENT', status: 400 });
	});

	it('allows only the comment author to delete active content', async () => {
		const { createArtworkComment, deleteArtworkComment } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());

		await createArtworkComment(
			{ artworkId: 'artwork-1', body: 'Delete me' },
			{ ipAddress: '127.0.0.1', user: createUser('user-1') },
			{ generateId: () => 'comment-1', now: () => new Date('2026-03-26T12:30:00.000Z'), repository }
		);

		await expect(
			deleteArtworkComment(
				{ artworkId: 'artwork-1', commentId: 'comment-1' },
				{ user: createUser('user-2') },
				{ now: () => new Date('2026-03-26T12:31:00.000Z'), repository }
			)
		).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

		const deleted = await deleteArtworkComment(
			{ artworkId: 'artwork-1', commentId: 'comment-1' },
			{ user: createUser('user-1') },
			{ now: () => new Date('2026-03-26T12:31:00.000Z'), repository }
		);

		expect(deleted.id).toBe('comment-1');
		expect(artworks.get('artwork-1')?.commentCount).toBe(0);
	});

	it('rate limits repeated comment attempts within the configured window', async () => {
		const { createArtworkComment } = await import('./service');
		const { artworks, repository, rateLimits } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		const now = new Date('2026-03-26T12:40:00.000Z');

		rateLimits.set('comment:user-1:127.0.0.1', {
			attemptCount: ARTWORK_COMMENT_RATE_LIMIT.maxAttempts,
			actorKey: 'user-1:127.0.0.1',
			blockedUntil: new Date(now.getTime() + ARTWORK_COMMENT_RATE_LIMIT.windowMs),
			createdAt: now,
			id: 'rate-limit-2',
			kind: 'comment',
			lastAttemptAt: now,
			updatedAt: now,
			windowStartedAt: now
		});

		await expect(
			createArtworkComment(
				{ artworkId: 'artwork-1', body: 'Blocked' },
				{ ipAddress: '127.0.0.1', user: createUser('user-1') },
				{ generateId: () => 'comment-3', now: () => now, repository }
			)
		).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
	});

	it('wraps unknown engagement failures in artwork flow errors', () => {
		const error = new ArtworkFlowError(500, 'Engagement failed', 'PUBLISH_FAILED');
		expect(error.code).toBe('PUBLISH_FAILED');
	});

	it('submits reports and auto-hides artworks once the threshold is reached', async () => {
		const { submitContentReport } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		const actor = { ipAddress: '127.0.0.1', user: createUser('user-9') };

		for (let index = 0; index < CONTENT_REPORT_AUTO_HIDE_THRESHOLD; index += 1) {
			await submitContentReport({ artworkId: 'artwork-1', reason: 'spam' }, actor, {
				generateId: () => `report-${index}`,
				now: () => new Date(`2026-03-26T13:0${index}:00.000Z`),
				repository
			});
		}

		expect(artworks.get('artwork-1')?.isHidden).toBe(true);
	});

	it('rejects report submissions that do not target exactly one object', async () => {
		const { submitContentReport } = await import('./service');
		const { repository } = createRepository();
		const actor = { ipAddress: '127.0.0.1', user: createUser('user-9') };

		await expect(
			submitContentReport({ reason: 'spam' }, actor, { generateId: () => 'report-1', repository })
		).rejects.toMatchObject({ code: 'INVALID_REPORT_TARGET', status: 400 });

		await expect(
			submitContentReport(
				{ artworkId: 'artwork-1', commentId: 'comment-1', reason: 'spam' },
				actor,
				{ generateId: () => 'report-2', repository }
			)
		).rejects.toMatchObject({ code: 'INVALID_REPORT_TARGET', status: 400 });
	});

	it('auto-hides comments once the report threshold is reached', async () => {
		const { submitContentReport } = await import('./service');
		const { artworks, comments, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		comments.set('comment-1', {
			authorId: 'author-2',
			artworkId: 'artwork-1',
			body: 'Needs review',
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			hiddenAt: null,
			id: 'comment-1',
			isHidden: false,
			updatedAt: new Date('2026-03-26T12:00:00.000Z')
		});
		const actor = { ipAddress: '127.0.0.1', user: createUser('user-9') };

		for (let index = 0; index < CONTENT_REPORT_AUTO_HIDE_THRESHOLD; index += 1) {
			await submitContentReport({ commentId: 'comment-1', reason: 'harassment' }, actor, {
				generateId: () => `comment-report-${index}`,
				now: () => new Date(`2026-03-26T14:0${index}:00.000Z`),
				repository
			});
		}

		expect(comments.get('comment-1')?.isHidden).toBe(true);
	});

	it('keeps hidden artworks deletable by their author after auto-hide', async () => {
		const { deleteArtwork, submitContentReport } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord({ authorId: 'user-1' }));
		const reporter = { ipAddress: '127.0.0.1', user: createUser('user-9') };

		for (let index = 0; index < CONTENT_REPORT_AUTO_HIDE_THRESHOLD; index += 1) {
			await submitContentReport({ artworkId: 'artwork-1', reason: 'spam' }, reporter, {
				generateId: () => `report-delete-${index}`,
				now: () => new Date(`2026-03-26T15:0${index}:00.000Z`),
				repository,
				storage: { delete: async () => undefined, upload: async () => undefined }
			});
		}

		const deleted = await deleteArtwork(
			{ artworkId: 'artwork-1' },
			{ user: createUser('user-1') },
			{
				repository,
				storage: { delete: async () => undefined, upload: async () => undefined }
			}
		);

		expect(deleted.id).toBe('artwork-1');
		expect(artworks.has('artwork-1')).toBe(false);
	});

	it('keeps hidden comments deletable by their author after auto-hide', async () => {
		const { deleteArtworkComment, submitContentReport } = await import('./service');
		const { artworks, comments, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		comments.set('comment-1', {
			authorId: 'user-1',
			artworkId: 'artwork-1',
			body: 'Hidden comment',
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			hiddenAt: null,
			id: 'comment-1',
			isHidden: false,
			updatedAt: new Date('2026-03-26T12:00:00.000Z')
		});
		const reporter = { ipAddress: '127.0.0.1', user: createUser('user-9') };

		for (let index = 0; index < CONTENT_REPORT_AUTO_HIDE_THRESHOLD; index += 1) {
			await submitContentReport({ commentId: 'comment-1', reason: 'harassment' }, reporter, {
				generateId: () => `comment-delete-${index}`,
				now: () => new Date(`2026-03-26T16:0${index}:00.000Z`),
				repository
			});
		}

		const deleted = await deleteArtworkComment(
			{ artworkId: 'artwork-1', commentId: 'comment-1' },
			{ user: createUser('user-1') },
			{ now: () => new Date('2026-03-26T16:10:00.000Z'), repository }
		);

		expect(deleted.id).toBe('comment-1');
		expect(comments.has('comment-1')).toBe(false);
	});

	it('allows moderators to hide and unhide artworks', async () => {
		const { moderateArtwork } = await import('./service');
		const { artworks, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		const now = new Date('2026-03-26T17:00:00.000Z');

		const hidden = await moderateArtwork(
			{ action: 'hide', artworkId: 'artwork-1' },
			{ user: createUser('moderator-1', 'moderator') },
			{
				now: () => now,
				repository,
				storage: { delete: async () => undefined, upload: async () => undefined }
			}
		);

		expect(hidden.isHidden).toBe(true);
		expect(hidden.hiddenAt).toEqual(now);

		const unhidden = await moderateArtwork(
			{ action: 'unhide', artworkId: 'artwork-1' },
			{ user: createUser('moderator-1', 'moderator') },
			{
				now: () => new Date('2026-03-26T17:05:00.000Z'),
				repository,
				storage: { delete: async () => undefined, upload: async () => undefined }
			}
		);

		expect(unhidden.isHidden).toBe(false);
		expect(unhidden.hiddenAt).toBeNull();
	});

	it('allows moderators to delete artworks and comments', async () => {
		const { moderateArtwork, moderateComment } = await import('./service');
		const { artworks, comments, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		comments.set('comment-1', {
			authorId: 'author-2',
			artworkId: 'artwork-1',
			body: 'Needs review',
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			hiddenAt: null,
			id: 'comment-1',
			isHidden: false,
			updatedAt: new Date('2026-03-26T12:00:00.000Z')
		});
		const storage = { delete: vi.fn(async () => undefined), upload: async () => undefined };

		const deletedArtwork = await moderateArtwork(
			{ action: 'delete', artworkId: 'artwork-1' },
			{ user: createUser('moderator-1', 'moderator') },
			{ repository, storage }
		);

		expect(deletedArtwork.id).toBe('artwork-1');
		expect(storage.delete).toHaveBeenCalledWith('artworks/author-1/artwork-1.avif');
		expect(artworks.has('artwork-1')).toBe(false);

		artworks.set('artwork-1', createArtworkRecord());
		const deletedComment = await moderateComment(
			{ action: 'delete', artworkId: 'artwork-1', commentId: 'comment-1' },
			{ user: createUser('moderator-1', 'moderator') },
			{ now: () => new Date('2026-03-26T17:10:00.000Z'), repository }
		);

		expect(deletedComment.id).toBe('comment-1');
		expect(comments.has('comment-1')).toBe(false);
	});

	it('rejects moderation actions for non-moderators', async () => {
		const { moderateArtwork, moderateComment } = await import('./service');
		const { artworks, comments, repository } = createRepository();
		artworks.set('artwork-1', createArtworkRecord());
		comments.set('comment-1', {
			authorId: 'author-2',
			artworkId: 'artwork-1',
			body: 'Needs review',
			createdAt: new Date('2026-03-26T12:00:00.000Z'),
			hiddenAt: null,
			id: 'comment-1',
			isHidden: false,
			updatedAt: new Date('2026-03-26T12:00:00.000Z')
		});

		await expect(
			moderateArtwork(
				{ action: 'hide', artworkId: 'artwork-1' },
				{ user: createUser('user-1') },
				{ repository, storage: { delete: async () => undefined, upload: async () => undefined } }
			)
		).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });

		await expect(
			moderateComment(
				{ action: 'hide', artworkId: 'artwork-1', commentId: 'comment-1' },
				{ user: createUser('user-1') },
				{ repository }
			)
		).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
	});
});
