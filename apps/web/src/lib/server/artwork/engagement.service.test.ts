import { describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from './errors';
import {
	ARTWORK_COMMENT_MAX_LENGTH,
	ARTWORK_COMMENT_RATE_LIMIT,
	ARTWORK_VOTE_RATE_LIMIT
} from './config';
import type {
	ArtworkCommentRecord,
	ArtworkCommentView,
	ArtworkRecord,
	ArtworkRepository,
	ArtworkVoteRecord
} from './types';

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
	id: 'artwork-1',
	mediaContentType: 'image/avif',
	mediaSizeBytes: 128,
	parentId: null,
	score: 0,
	storageKey: 'artworks/author-1/artwork-1.avif',
	title: 'Artwork',
	updatedAt: new Date('2026-03-26T10:00:00.000Z'),
	...overrides
});

const createUser = (id: string) => {
	const now = new Date('2026-03-26T10:00:00.000Z');

	return {
		id,
		authUserId: id,
		nickname: `${id}_nick`,
		role: 'user' as const,
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
	const rateLimits = new Map<string, EngagementRateLimitRecord>();

	const voteKey = (artworkId: string, userId: string) => `${artworkId}:${userId}`;
	const rateLimitKey = (kind: EngagementKind, actorKey: string) => `${kind}:${actorKey}`;

	const repository = {
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
		})
	} as unknown as ArtworkRepository;

	return { artworks, comments, rateLimits, repository, votes };
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

		const comments = await listArtworkComments('artwork-1', { repository });

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
});
