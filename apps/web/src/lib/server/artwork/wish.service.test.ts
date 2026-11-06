import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTWORK_WISH_RATE_LIMIT } from './config';
import { WISH_MAX_LENGTH } from '#lib/shared/content/wishes.js';
import type { ArtworkRepository } from './types';

type ModerationCheckResult = { status: 'allowed' } | { message: string; status: 'blocked' };

const moderation = vi.hoisted(() => ({
	checkTextModeration: vi.fn<() => Promise<ModerationCheckResult>>(async () => ({
		status: 'allowed'
	}))
}));

vi.mock('./storage', () => ({ artworkStorage: {} }));
vi.mock('./repository', () => ({ artworkRepository: {} }));
vi.mock('#lib/server/moderation/service.js', () => ({
	checkTextModeration: moderation.checkTextModeration
}));

const actor = { user: { id: 'artist-1', role: 'user' as const } };

const createDependencies = (blockedUntil: Date | null = null) => {
	const created: Parameters<ArtworkRepository['createWish']>[0][] = [];
	const repository = {
		createWish: vi.fn(async (input: Parameters<ArtworkRepository['createWish']>[0]) => {
			created.push(input);
		}),
		listWishes: vi.fn(async () => []),
		recordEngagementRateLimitAttempt: vi.fn(async () => ({ blockedUntil }))
	} as unknown as ArtworkRepository;

	return {
		created,
		dependencies: {
			generateId: () => 'wish-1',
			now: () => new Date('2026-11-05T10:00:00.000Z'),
			repository
		},
		repository
	};
};

describe('leaving a slip in the mailbox', () => {
	beforeEach(() => {
		moderation.checkTextModeration.mockReset();
		moderation.checkTextModeration.mockResolvedValue({ status: 'allowed' });
	});

	it('takes what the artist wrote, tidied, under their name', async () => {
		const { createWish } = await import('./service');
		const { created, dependencies } = createDependencies();

		const wish = await createWish({ text: '  a very   tired sun ' }, actor, dependencies);

		expect(created).toMatchObject([{ authorId: 'artist-1', body: 'a very tired sun' }]);
		expect(wish).toMatchObject({ id: 'wish-1', text: 'a very tired sun' });
	});

	it('needs an artist', async () => {
		const { createWish } = await import('./service');
		const { dependencies } = createDependencies();

		await expect(createWish({ text: 'a sun' }, {}, dependencies)).rejects.toMatchObject({
			status: 401
		});
	});

	it.each([
		['an empty slip', '   '],
		['a slip too long for the paper', 'x'.repeat(WISH_MAX_LENGTH + 1)]
	])('refuses %s', async (_name, text) => {
		const { createWish } = await import('./service');
		const { created, dependencies } = createDependencies();

		await expect(createWish({ text }, actor, dependencies)).rejects.toMatchObject({
			code: 'INVALID_WISH',
			status: 400
		});
		expect(created).toEqual([]);
	});

	it('holds slips to the words comments are held to, and says why', async () => {
		const { createWish } = await import('./service');
		const { created, dependencies } = createDependencies();
		moderation.checkTextModeration.mockResolvedValue({
			message: 'That word is not welcome here',
			status: 'blocked'
		});

		await expect(createWish({ text: 'rude' }, actor, dependencies)).rejects.toMatchObject({
			code: 'INVALID_WISH',
			message: 'That word is not welcome here',
			status: 400
		});
		expect(moderation.checkTextModeration).toHaveBeenCalledWith('rude', 'comment');
		expect(created).toEqual([]);
	});

	it('counts every attempt against the hourly limit', async () => {
		const { createWish } = await import('./service');
		const { created, dependencies, repository } = createDependencies(
			new Date('2026-11-05T11:00:00.000Z')
		);

		await expect(createWish({ text: 'a sun' }, actor, dependencies)).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			status: 429
		});
		expect(repository.recordEngagementRateLimitAttempt).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'wish' })
		);
		expect(ARTWORK_WISH_RATE_LIMIT.maxAttempts).toBeGreaterThan(0);
		expect(created).toEqual([]);
	});
});

describe('reporting and moderating slips', () => {
	it('takes a report only from an artist, on a slip that is still in the box', async () => {
		const { submitContentReport } = await import('./service');
		const { dependencies, repository } = createDependencies();
		vi.mocked(repository).findWish = vi.fn(async () => null);

		await expect(
			submitContentReport({ reason: 'spam', wishId: 'wish-1' }, {}, dependencies)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			submitContentReport({ reason: 'spam', wishId: 'wish-gone' }, actor, dependencies)
		).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
	});

	it('names one target, whichever kind it is', async () => {
		const { submitContentReport } = await import('./service');
		const { dependencies } = createDependencies();

		await expect(
			submitContentReport(
				{ artworkId: 'artwork-1', reason: 'spam', wishId: 'wish-1' },
				actor,
				dependencies
			)
		).rejects.toMatchObject({ code: 'INVALID_REPORT_TARGET', status: 400 });
	});

	it('leaves moderating a slip to moderators', async () => {
		const { moderateWish } = await import('./service');
		const { dependencies } = createDependencies();

		await expect(
			moderateWish({ action: 'hide', wishId: 'wish-1' }, actor, dependencies)
		).rejects.toMatchObject({ status: 403 });
	});
});

describe('taking slips out of the mailbox', () => {
	it('hands out three, leaving out the artist who asks', async () => {
		const { listWishes } = await import('./service');
		const { dependencies, repository } = createDependencies();

		await listWishes({ seen: ['wish-9'] }, actor, dependencies);

		expect(repository.listWishes).toHaveBeenCalledWith({
			limit: 3,
			seen: ['wish-9'],
			viewerId: 'artist-1'
		});
	});

	it('keeps the list of slips already seen short', async () => {
		const { listWishes } = await import('./service');
		const { dependencies, repository } = createDependencies();

		await listWishes(
			{ seen: Array.from({ length: 100 }, (_, index) => `wish-${index}`) },
			{},
			dependencies
		);

		expect(vi.mocked(repository.listWishes).mock.calls[0]?.[0].seen).toHaveLength(30);
		expect(vi.mocked(repository.listWishes).mock.calls[0]?.[0].viewerId).toBeNull();
	});
});
