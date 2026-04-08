import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

vi.mock('$lib/features/home-entry-scene/canvas/museum-canvas', () => ({
	museumWindowOpening: { x: 0, y: 0, width: 100, height: 100 },
	museumWindowAspectRatio: '16/9',
	drawMuseumWindowFrame: vi.fn(),
	createMuseumWallPatternUrl: () =>
		'data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20512%20512%22%3E%3C/svg%3E',
	drawArtworkFrame: vi.fn(),
	applyFrameWeathering: vi.fn(),
	createArtworkFrameUrl: () => 'data:image/png;base64,mock',
	drawStickerBackground: vi.fn(),
	createStickerBackgroundUrl: () => 'data:image/png;base64,mock'
}));

vi.mock('$app/environment', () => ({
	browser: false
}));

import GalleryShellHarness from './GalleryShellHarness.svelte';

describe('GalleryShell SSR wall pattern', () => {
	it('renders the wall pattern even when browser-only effects are unavailable', () => {
		render(GalleryShellHarness, {
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' as const }
		});

		const bricks = document.querySelector('[data-testid="gallery-wall-bricks"]');
		expect(bricks).not.toBeNull();
		expect(bricks?.getAttribute('style')).toContain('data:image/svg+xml');
	});
});
