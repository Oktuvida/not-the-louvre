import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const { beforeNavigate, navigate, resetNavigationCallbacks } = vi.hoisted(() => {
	const callbacks = new Set<() => void>();

	return {
		beforeNavigate: (callback: () => void) => {
			callbacks.add(callback);
		},
		navigate: () => {
			for (const callback of callbacks) callback();
		},
		resetNavigationCallbacks: () => {
			callbacks.clear();
		}
	};
});

vi.mock('$app/navigation', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$app/navigation')>();
	return { ...actual, beforeNavigate };
});

import { makeArtworks } from '$lib/features/gallery-exploration/fixtures/artworks';
import {
	clearRoomFeedCache,
	readRoomFeedSnapshot
} from '$lib/features/gallery-exploration/model/feed-cache';
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

		const room = render(RoomHarness, {
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
		// the top two ticks after the DOM update, while the room itself is only
		// destroyed once the layout's keyed out-transition has played. The offset
		// has to be captured here, before either of those.
		navigate();
		stubScrollY(0);

		room.unmount();

		expect(readRoomFeedSnapshot('hot-wall')?.scrollY).toBe(5200);
	});

	it('stores no offset for a room the reader never scrolled', async () => {
		const artworks = makeArtworks(6, { prefix: 'hot-' });

		const room = render(RoomHarness, {
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
