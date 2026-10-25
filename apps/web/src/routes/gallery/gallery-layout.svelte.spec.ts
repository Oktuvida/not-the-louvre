import { describe, expect, it, vi } from 'vitest';
import { fakePage } from '#lib/testing/fake-page-state.svelte.js';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

type HarnessPageData = {
	roomId: string;
	viewer: { id: string; role: 'user' } | null;
};

const { refreshAll, goto } = vi.hoisted(() => ({
	goto: vi.fn(),
	refreshAll: vi.fn(async () => {})
}));

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
	goto,
	refreshAll
}));

vi.mock('#lib/features/home-entry-scene/canvas/museum-canvas.js', () => ({
	museumWindowOpening: { x: 0, y: 0, width: 100, height: 100 },
	museumWindowAspectRatio: '16/9'
}));

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
		expect(document.querySelector('[data-testid="gallery-wall-bricks"]')).not.toBeNull();
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

	it('keeps the refresh action alive after two room changes', async () => {
		refreshAll.mockClear();

		setRoom({ roomId: 'hall-of-fame', viewer: { id: 'user-1', role: 'user' } });

		await render(GalleryRoomSwitchHarness);

		await expect.element(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

		setRoom({ roomId: 'hot-wall', viewer: { id: 'user-1', role: 'user' } });
		setRoom({ roomId: 'mystery', viewer: { id: 'user-1', role: 'user' } });

		// The outgoing room's effect teardown is deferred until the 225ms slide
		// outro finishes — long after the incoming room published its bindings.
		await new Promise((resolve) => setTimeout(resolve, 500));

		await page.getByRole('button', { name: 'Refresh' }).click();

		await vi.waitFor(() => {
			expect(refreshAll).toHaveBeenCalledTimes(1);
		});
	});
});
