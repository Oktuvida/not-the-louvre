import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

type HarnessPageData = {
	roomId: string;
	viewer: { id: string; role: 'user' } | null;
};

const { pageStore, setPageData, invalidateAll, goto, pushState, replaceState } = vi.hoisted(() => {
	let currentValue = {
		data: {
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' as const } as { id: string; role: 'user' } | null
		},
		state: {},
		url: new URL('http://localhost/gallery')
	};

	const subscribers = new Set<(value: typeof currentValue) => void>();

	return {
		goto: vi.fn(),
		invalidateAll: vi.fn(async () => {}),
		pushState: vi.fn(),
		replaceState: vi.fn(),
		pageStore: {
			subscribe(callback: (value: typeof currentValue) => void) {
				subscribers.add(callback);
				callback(currentValue);

				return () => subscribers.delete(callback);
			}
		},
		setPageData(data: typeof currentValue.data) {
			currentValue = { data, state: {}, url: currentValue.url };
			for (const subscriber of subscribers) subscriber(currentValue);
		}
	};
});

vi.mock('$app/stores', () => ({
	navigating: { subscribe: (run: (value: null) => void) => (run(null), () => {}) },
	page: pageStore
}));

vi.mock('$app/navigation', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$app/navigation')>();
	return { ...actual, goto, invalidateAll, pushState, replaceState };
});

vi.mock('$lib/features/home-entry-scene/canvas/museum-canvas', () => ({
	museumWindowOpening: { x: 0, y: 0, width: 100, height: 100 },
	museumWindowAspectRatio: '16/9',
	createMuseumWallPatternUrl: () => 'data:image/png;base64,mock',
	drawStickerBackground: vi.fn(),
	createStickerBackgroundUrl: () => 'data:image/png;base64,mock'
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

		render(GalleryRouteLayoutHarness);

		await expect.element(page.getByTestId('gallery-layout-slot')).toBeVisible();
		await expect.element(page.getByTestId('ambient-particle-overlay')).toBeVisible();
		expect(document.querySelector('[data-testid="gallery-wall-bricks"]')).not.toBeNull();
		await expect.element(page.getByTestId('gallery-room-shell')).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).toBeVisible();
	});

	it('hides viewer-only room link when no viewer is available', async () => {
		setRoom({
			roomId: 'hall-of-fame',
			viewer: null
		});

		render(GalleryRouteLayoutHarness);

		await expect.element(page.getByTestId('gallery-layout-slot')).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).not.toBeInTheDocument();
	});

	it('offers anonymous visitors a way to join', async () => {
		setRoom({
			roomId: 'hall-of-fame',
			viewer: null
		});

		render(GalleryRouteLayoutHarness);

		await expect.element(page.getByRole('link', { name: /join/i })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Create Art' })).not.toBeInTheDocument();
	});

	it('keeps the refresh action alive after two room changes', async () => {
		invalidateAll.mockClear();

		setRoom({ roomId: 'hall-of-fame', viewer: { id: 'user-1', role: 'user' } });

		render(GalleryRoomSwitchHarness);

		await expect.element(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

		setRoom({ roomId: 'hot-wall', viewer: { id: 'user-1', role: 'user' } });
		setRoom({ roomId: 'mystery', viewer: { id: 'user-1', role: 'user' } });

		// The outgoing room's effect teardown is deferred until the 225ms slide
		// outro finishes — long after the incoming room published its bindings.
		await new Promise((resolve) => setTimeout(resolve, 500));

		await page.getByRole('button', { name: 'Refresh' }).click();

		await vi.waitFor(() => {
			expect(invalidateAll).toHaveBeenCalledTimes(1);
		});
	});
});
