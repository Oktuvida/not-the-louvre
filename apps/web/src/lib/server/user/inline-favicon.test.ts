import { describe, expect, it, vi } from 'vitest';
import { createInlineAvatarFavicon } from './inline-favicon';

// Safari shows an icon written into the page straight away, but takes an icon
// at an address only when it gets round to fetching it, and never in a
// private window. So a signed-in artist's avatar goes into the page itself:
// drawn once per avatar at the size a tab shows, then served from the cache.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const asDataUri = `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`;

const artist = {
	avatarOnboardingCompletedAt: new Date('2026-11-01T10:00:00Z'),
	avatarUrl: 'avatars/user-1/abc.webp',
	id: 'user-1',
	updatedAt: new Date('2026-11-02T10:00:00Z')
};

/** A Cache API with nothing in it yet. */
const emptyCache = () => {
	const stored = new Map<string, Response>();
	return {
		match: vi.fn(async (key: string) => stored.get(key)?.clone()),
		put: vi.fn(async (key: string, response: Response) => {
			stored.set(key, response);
		})
	};
};

const setup = () => {
	const cache = emptyCache();
	const readAvatar = vi.fn(async () => new Uint8Array([1, 2, 3]));
	const renderFavicon = vi.fn(async () => PNG);
	const keep = vi.fn((promise: Promise<unknown>) => promise);
	const inline = createInlineAvatarFavicon({
		cache: () => cache,
		keep,
		readAvatar,
		renderFavicon
	});
	return { cache, inline, keep, readAvatar, renderFavicon };
};

describe('the avatar favicon written into the page', () => {
	it('draws a 32-pixel icon from the avatar the first time and keeps it', async () => {
		const { cache, inline, readAvatar, renderFavicon } = setup();

		expect(await inline(artist, 'https://museum.test')).toBe(asDataUri);
		expect(readAvatar).toHaveBeenCalledWith('avatars/user-1/abc.webp');
		expect(renderFavicon).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 32);
		expect(cache.put).toHaveBeenCalledTimes(1);
	});

	it('serves the kept icon after that, without drawing it again', async () => {
		const { inline, renderFavicon } = setup();
		await inline(artist, 'https://museum.test');

		expect(await inline(artist, 'https://museum.test')).toBe(asDataUri);
		expect(renderFavicon).toHaveBeenCalledTimes(1);
	});

	it('draws a new icon when the artist draws a new avatar', async () => {
		const { inline, renderFavicon } = setup();
		await inline(artist, 'https://museum.test');

		await inline({ ...artist, updatedAt: new Date('2026-11-03T10:00:00Z') }, 'https://museum.test');
		expect(renderFavicon).toHaveBeenCalledTimes(2);
	});

	it('leaves the tab to the link for a visitor with no finished avatar', async () => {
		const { inline, readAvatar } = setup();

		expect(await inline(null, 'https://museum.test')).toBeNull();
		expect(
			await inline({ ...artist, avatarOnboardingCompletedAt: null }, 'https://x.test')
		).toBeNull();
		expect(await inline({ ...artist, avatarUrl: null }, 'https://x.test')).toBeNull();
		expect(readAvatar).not.toHaveBeenCalled();
	});

	it('leaves the tab to the link when the icon cannot be drawn', async () => {
		const { inline, renderFavicon } = setup();
		renderFavicon.mockRejectedValueOnce(new Error('renderer down'));

		expect(await inline(artist, 'https://museum.test')).toBeNull();
	});

	it('leaves the tab to the link where there is no cache to keep the icon in', async () => {
		const renderFavicon = vi.fn(async () => PNG);
		const inline = createInlineAvatarFavicon({
			cache: () => undefined,
			keep: (promise) => promise,
			readAvatar: async () => new Uint8Array([1]),
			renderFavicon
		});

		expect(await inline(artist, 'https://museum.test')).toBeNull();
		expect(renderFavicon).not.toHaveBeenCalled();
	});
});
