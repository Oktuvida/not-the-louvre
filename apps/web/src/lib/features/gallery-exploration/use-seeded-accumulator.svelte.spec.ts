import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const { beforeNavigate, navigate, resetNavigationCallbacks } = vi.hoisted(() => {
	type Navigation = { shallow: boolean; type: string };
	const callbacks = new Set<(navigation: Navigation) => void>();

	return {
		beforeNavigate: (callback: (navigation: Navigation) => void) => {
			callbacks.add(callback);
		},
		// A room tab is a full link navigation, not a shallow goto.
		navigate: () => {
			for (const callback of callbacks) callback({ shallow: false, type: 'link' });
		},
		resetNavigationCallbacks: () => {
			callbacks.clear();
		}
	};
});

vi.mock('$app/navigation', async () => ({
	...(await import('#lib/testing/fake-navigation.js')).fakeNavigation,
	beforeNavigate
}));

import { makeArtworks } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import {
	clearRoomFeedCache,
	readRoomFeedSnapshot
} from '#lib/features/gallery-exploration/model/feed-cache.js';
import HotWallRoom from './rooms/HotWallRoom.svelte';
import RoomHarness from './rooms/RoomHarness.svelte';

const stubScrollY = (value: number) => {
	Object.defineProperty(window, 'scrollY', { configurable: true, value });
};

describe('createSeededAccumulator feed memory', () => {
	beforeEach(() => {
		clearRoomFeedCache();
		resetNavigationCallbacks();
		stubScrollY(0);

		return () => {
			// Hand `scrollY` back to the browser so a later spec reads the real one.
			Reflect.deleteProperty(window, 'scrollY');
		};
	});

	it('remembers where the reader was, not where the navigation left them', async () => {
		const artworks = makeArtworks(6, { prefix: 'hot-' });

		const room = await render(RoomHarness, {
			props: {
				component: HotWallRoom,
				roomProps: {
					artworks,
					feedCacheKey: 'hot-wall',
					pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
				}
			}
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		stubScrollY(5200);
		// The room tab is a push navigation: SvelteKit scrolls the window back to
		// the top as it lands, and the room is destroyed only once the next one
		// has replaced it. The offset has to be captured here, before either.
		navigate();
		stubScrollY(0);

		room.unmount();

		expect(readRoomFeedSnapshot('hot-wall')?.scrollY).toBe(5200);
	});

	it('hands over the first page it was drawing along with its feed', async () => {
		const artworks = makeArtworks(6, { prefix: 'hot-' });

		const room = await render(RoomHarness, {
			props: {
				component: HotWallRoom,
				roomProps: {
					artworks,
					feedCacheKey: 'hot-wall',
					pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
				}
			}
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		navigate();
		room.unmount();

		// The room goes back up from this before the server's fresh page lands.
		expect(readRoomFeedSnapshot('hot-wall')?.seed).toEqual({
			artworks,
			pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
		});
	});

	it('stores no offset for a room the reader never scrolled', async () => {
		const artworks = makeArtworks(6, { prefix: 'hot-' });

		const room = await render(RoomHarness, {
			props: {
				component: HotWallRoom,
				roomProps: {
					artworks,
					feedCacheKey: 'hot-wall',
					pageInfo: { hasMore: true, nextCursor: 'cursor-1' }
				}
			}
		});

		await expect.element(page.getByTestId('hot-wall-room')).toBeVisible();

		navigate();
		room.unmount();

		expect(readRoomFeedSnapshot('hot-wall')?.scrollY).toBe(0);
	});
});
