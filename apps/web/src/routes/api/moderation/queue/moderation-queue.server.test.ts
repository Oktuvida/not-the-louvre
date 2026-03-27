import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { ModerationQueueItem, ModerationQueuePage } from '$lib/server/artwork/types';

const mocked = vi.hoisted(() => ({
	listModerationQueue: vi.fn()
}));

vi.mock('$lib/server/artwork/read.service', () => ({
	listModerationQueue: mocked.listModerationQueue
}));

const makeItem = (overrides: Partial<ModerationQueueItem> = {}): ModerationQueueItem => ({
	artworkId: 'artwork-1',
	authorId: 'user-1',
	authorNickname: 'artist',
	commentId: null,
	contentSummary: 'Sunset painting',
	isHidden: false,
	reportCount: 5,
	targetType: 'artwork',
	...overrides
});

const makeModerationPage = (
	items: ModerationQueueItem[],
	hasMore = false,
	nextCursor: string | null = null
): ModerationQueuePage => ({
	items,
	pageInfo: { hasMore, nextCursor }
});

const makeModeratorLocals = () => ({
	user: {
		avatarUrl: null,
		authUserId: 'auth-mod',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		email: 'mod@not-the-louvre.local',
		emailVerified: false,
		id: 'mod-1',
		image: null,
		name: 'moderator',
		nickname: 'moderator',
		role: 'moderator' as const,
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

const makeUserLocals = () => ({
	user: {
		avatarUrl: null,
		authUserId: 'auth-user',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		email: 'user@not-the-louvre.local',
		emailVerified: false,
		id: 'user-1',
		image: null,
		name: 'artist',
		nickname: 'artist',
		role: 'user' as const,
		updatedAt: new Date('2026-01-01T00:00:00.000Z')
	}
});

describe('GET /api/moderation/queue', () => {
	beforeEach(() => {
		mocked.listModerationQueue.mockReset();
	});

	it('returns the moderation queue for an authenticated moderator', async () => {
		const items = [
			makeItem({ reportCount: 5, targetType: 'artwork' }),
			makeItem({
				artworkId: 'artwork-2',
				commentId: 'comment-1',
				reportCount: 3,
				targetType: 'comment',
				contentSummary: 'Inappropriate comment'
			})
		];
		mocked.listModerationQueue.mockResolvedValue(makeModerationPage(items));

		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/moderation/queue');
		const response = await GET({
			locals: makeModeratorLocals(),
			url
		} as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.items).toHaveLength(2);
		expect(json.items[0]).toMatchObject({ reportCount: 5, targetType: 'artwork' });
		expect(json.items[1]).toMatchObject({ reportCount: 3, targetType: 'comment' });
	});

	it('rejects non-moderator access', async () => {
		mocked.listModerationQueue.mockRejectedValue(
			new ArtworkFlowError(403, 'Moderator access required', 'FORBIDDEN')
		);

		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/moderation/queue');
		const response = await GET({
			locals: makeUserLocals(),
			url
		} as never);

		expect(response.status).toBe(403);
	});

	it('rejects unauthenticated access', async () => {
		mocked.listModerationQueue.mockRejectedValue(
			new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED')
		);

		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/moderation/queue');
		const response = await GET({
			locals: { user: null },
			url
		} as never);

		expect(response.status).toBe(401);
	});

	it('passes pagination cursor from query parameter', async () => {
		mocked.listModerationQueue.mockResolvedValue(makeModerationPage([]));

		const cursor = Buffer.from(
			JSON.stringify({ reportCount: 5, targetType: 'artwork', id: 'artwork-1' }),
			'utf8'
		).toString('base64url');

		const { GET } = await import('./+server');
		const url = new URL(`http://localhost/api/moderation/queue?cursor=${cursor}`);
		await GET({ locals: makeModeratorLocals(), url } as never);

		expect(mocked.listModerationQueue).toHaveBeenCalledWith(
			expect.objectContaining({ cursor }),
			expect.anything()
		);
	});

	it('includes pagination info in the response', async () => {
		const nextCursor = Buffer.from(
			JSON.stringify({ reportCount: 2, targetType: 'comment', id: 'comment-5' }),
			'utf8'
		).toString('base64url');
		mocked.listModerationQueue.mockResolvedValue(
			makeModerationPage([makeItem()], true, nextCursor)
		);

		const { GET } = await import('./+server');
		const url = new URL('http://localhost/api/moderation/queue');
		const response = await GET({ locals: makeModeratorLocals(), url } as never);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.pageInfo.hasMore).toBe(true);
		expect(json.pageInfo.nextCursor).toBeTruthy();
	});
});
