import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

const { pageStore, setPageData } = vi.hoisted(() => {
	let currentValue = {
		data: {
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' as const } as { id: string; role: 'user' } | null
		}
	};

	const subscribers = new Set<(value: typeof currentValue) => void>();

	return {
		pageStore: {
			subscribe(callback: (value: typeof currentValue) => void) {
				subscribers.add(callback);
				callback(currentValue);

				return () => subscribers.delete(callback);
			}
		},
		setPageData(data: typeof currentValue.data) {
			currentValue = { data };
			for (const subscriber of subscribers) subscriber(currentValue);
		}
	};
});

vi.mock('$app/stores', () => ({
	page: pageStore
}));

vi.mock('$lib/features/home-entry-scene/canvas/museum-canvas', () => ({
	museumWindowOpening: { x: 0, y: 0, width: 100, height: 100 },
	museumWindowAspectRatio: '16/9',
	drawMuseumWindowFrame: vi.fn(),
	createMuseumWallPatternUrl: () => 'data:image/png;base64,mock',
	drawArtworkFrame: vi.fn(),
	applyFrameWeathering: vi.fn(),
	createArtworkFrameUrl: () => 'data:image/png;base64,mock',
	drawStickerBackground: vi.fn(),
	createStickerBackgroundUrl: () => 'data:image/png;base64,mock'
}));

import GalleryRouteLayoutHarness from './GalleryRouteLayoutHarness.svelte';

describe('gallery route layout', () => {
	it('renders shared gallery shell background and navigation', async () => {
		setPageData({
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
		setPageData({
			roomId: 'hall-of-fame',
			viewer: null
		});

		render(GalleryRouteLayoutHarness);

		await expect.element(page.getByTestId('gallery-layout-slot')).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).not.toBeInTheDocument();
	});
});
