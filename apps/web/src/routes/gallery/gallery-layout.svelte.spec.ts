import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakePage } from '#lib/testing/fake-page-state.svelte.js';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

type HarnessPageData = {
	roomId: string;
	viewer: { id: string; role: 'user' } | null;
};

const { beforeNavigate, goto, leavingFor, refreshAll } = vi.hoisted(() => {
	type Navigation = { from: { url: URL }; shallow: boolean; type: string };
	const callbacks = new Set<(navigation: Navigation) => void>();

	return {
		beforeNavigate: (callback: (navigation: Navigation) => void) => {
			callbacks.add(callback);
		},
		goto: vi.fn(),
		// A room tab is a link navigation away from the page the visitor is on.
		leavingFor: (from: URL) => {
			for (const callback of callbacks)
				callback({ from: { url: from }, shallow: false, type: 'link' });
		},
		refreshAll: vi.fn(async () => {})
	};
});

type GalleryPageData = {
	roomId: string;
	viewer: { id: string; role: 'user' } | null;
};

const setPageData = (data: GalleryPageData) => fakePage.set({ data, state: {} });

setPageData({ roomId: 'hall-of-fame', viewer: { id: 'user-1', role: 'user' } });
fakePage.set({ url: 'http://localhost/gallery' });

vi.mock(
	'$app/state',
	async () => (await import('#lib/testing/fake-page-state.svelte.js')).fakeAppState
);

vi.mock('$app/navigation', async () => ({
	...(await import('#lib/testing/fake-navigation.js')).fakeNavigation,
	beforeNavigate,
	goto,
	refreshAll
}));

vi.mock('#lib/features/home-entry-scene/canvas/museum-canvas.js', () => ({
	museumWindowOpening: { x: 0, y: 0, width: 100, height: 100 },
	museumWindowAspectRatio: '16/9'
}));

import { makeArtwork, makeArtworks } from '#lib/features/gallery-exploration/fixtures/artworks.js';
import { clearRoomFeedCache } from '#lib/features/gallery-exploration/model/feed-cache.js';
import GalleryRoomSwitchHarness from './GalleryRoomSwitchHarness.svelte';
import GalleryRouteLayoutHarness from './GalleryRouteLayoutHarness.svelte';

const setRoom = (data: HarnessPageData) => setPageData(data);

describe('gallery route layout', () => {
	it('renders shared gallery shell background and navigation', async () => {
		setRoom({
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		await render(GalleryRouteLayoutHarness);

		await expect.element(page.getByTestId('gallery-layout-slot')).toBeVisible();
		await expect.element(page.getByTestId('ambient-particle-overlay')).toBeVisible();
		await expect.element(page.getByTestId('gallery-room-shell')).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).toBeVisible();
	});

	/*
	 * The room's light used to be four sibling `fixed inset-0` divs identical in
	 * every property but their gradient — four viewport-sized paint records over
	 * a window-scrolled virtualized grid. One element with a four-entry
	 * `background` paints the same pixels; the list order is reversed against
	 * the old DOM order because siblings paint last-on-top and a background list
	 * paints first-on-top.
	 */
	it('paints the room atmosphere with one layer, not four', async () => {
		setRoom({
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		await render(GalleryRouteLayoutHarness);

		await expect.element(page.getByTestId('gallery-room-shell')).toBeVisible();

		const atmosphere = document.querySelectorAll('.gallery-atmosphere');
		expect(atmosphere).toHaveLength(1);

		const background = getComputedStyle(atmosphere[0]).backgroundImage;
		const gradients = background.match(/radial-gradient|linear-gradient/g) ?? [];
		expect(gradients).toHaveLength(4);
		// Centre falloff first (formerly the topmost sibling), warm top-right
		// last (formerly the bottom one).
		expect(background.indexOf('at center')).toBeLessThan(background.indexOf('at 86%'));
	});

	it('hides viewer-only room link when no viewer is available', async () => {
		setRoom({
			roomId: 'hall-of-fame',
			viewer: null
		});

		await render(GalleryRouteLayoutHarness);

		await expect.element(page.getByTestId('gallery-layout-slot')).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).not.toBeInTheDocument();
	});

	it('offers anonymous visitors a way to join', async () => {
		setRoom({
			roomId: 'hall-of-fame',
			viewer: null
		});

		await render(GalleryRouteLayoutHarness);

		await expect.element(page.getByRole('link', { name: /join/i })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Create Art' })).not.toBeInTheDocument();
	});

	it('keeps the new-pieces notice wired to the live room after two room changes', async () => {
		refreshAll.mockClear();
		const checkForNewArtworks = vi.fn(async () => ({ count: 2, preview: null }));

		setRoom({ roomId: 'hall-of-fame', viewer: { id: 'user-1', role: 'user' } });

		await render(GalleryRoomSwitchHarness, { checkForNewArtworks });

		await expect.element(page.getByRole('button', { name: /2 new pieces/ })).toBeVisible();

		setRoom({ roomId: 'hot-wall', viewer: { id: 'user-1', role: 'user' } });
		setRoom({ roomId: 'your-studio', viewer: { id: 'user-1', role: 'user' } });

		// The outgoing room's effect teardown is deferred until the 225ms slide
		// outro finishes — long after the incoming room published its bindings.
		await new Promise((resolve) => setTimeout(resolve, 500));

		await page.getByRole('button', { name: /2 new pieces/ }).click();

		await vi.waitFor(() => {
			expect(refreshAll).toHaveBeenCalledTimes(1);
		});
	});

	describe('walking back into a room', () => {
		const viewer = { id: 'user-1', role: 'user' as const };
		const roomUrl = (roomId: string) =>
			new URL(roomId === 'hall-of-fame' ? '/gallery' : `/gallery/${roomId}`, 'http://localhost');
		// A navigation streams the room it lands on; these never land, so what
		// is on the wall can only have come from the gallery's memory.
		const streaming = () => new Promise<never>(() => {});
		const walkInto = (roomId: string) => {
			leavingFor(fakePage.page.url);
			fakePage.set({
				data: { roomContent: streaming(), roomId, viewer },
				url: roomUrl(roomId)
			});
		};
		const firstVisit = (roomId: string, artworks: ReturnType<typeof makeArtworks>) =>
			fakePage.set({ data: { artworks, roomId, viewer }, url: roomUrl(roomId) });

		beforeEach(() => {
			clearRoomFeedCache();
		});

		it('puts it back up whole when the visitor turns back before its slide is over', async () => {
			firstVisit('hot-wall', makeArtworks(6, { prefix: 'hot-' }));
			await render(GalleryRoomSwitchHarness, {});
			await expect.element(page.getByRole('button', { name: /Artwork hot-1/ })).toBeVisible();

			walkInto('hall-of-fame');
			await new Promise((resolve) => setTimeout(resolve, 60));
			// The Hot Wall is still sliding out (225ms) when the visitor turns back.
			walkInto('hot-wall');

			await expect.element(page.getByRole('button', { name: /Artwork hot-2/ })).toBeVisible();
			expect(document.querySelector('[data-room-skeleton="hot-wall"]')).toBeNull();
		});

		it('puts the Hall of Fame podium back up with it', async () => {
			firstVisit(
				'hall-of-fame',
				[1, 2, 3, 4, 5].map((rank) =>
					makeArtwork({ id: `ranked-${rank}`, rank, title: `Ranked Piece ${rank}` })
				)
			);
			await render(GalleryRoomSwitchHarness, {});
			await expect.element(page.getByTestId('podium-artwork-1')).toBeVisible();

			walkInto('hot-wall');
			// Long enough for the Hall of Fame to finish sliding out and be torn down.
			await new Promise((resolve) => setTimeout(resolve, 500));
			walkInto('hall-of-fame');

			await expect.element(page.getByText('Ranked Piece 1')).toBeVisible();
			await expect.element(page.getByText('Ranked Piece 5')).toBeVisible();
			expect(document.querySelector('[data-room-skeleton="hall-of-fame"]')).toBeNull();
		});
	});
});
