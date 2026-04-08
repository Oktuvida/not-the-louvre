import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

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

vi.mock('$app/environment', () => ({
	browser: true
}));

import GalleryShellHarness from './GalleryShellHarness.svelte';

describe('GalleryShell', () => {
	it('renders header with room navigation and background pattern', async () => {
		render(GalleryShellHarness, {
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' as const }
		});

		// Wait for children to render first (most reliable indicator the component mounted)
		await expect.element(page.getByTestId('shell-content')).toBeVisible();

		// Then verify structural elements
		const shell = document.querySelector('[data-testid="gallery-room-shell"]');
		expect(shell).not.toBeNull();

		const bricks = document.querySelector('[data-testid="gallery-wall-bricks"]');
		expect(bricks).not.toBeNull();

		const header = document.querySelector('[data-testid="gallery-room-header"]');
		expect(header).not.toBeNull();

		const nav = document.querySelector('nav');
		expect(nav).not.toBeNull();
	});

	it('renders back button and action buttons for authenticated viewers', async () => {
		render(GalleryShellHarness, {
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' as const }
		});

		await expect.element(page.getByTestId('shell-content')).toBeVisible();

		const backLink = page.getByRole('link', { name: /back/i });
		await expect.element(backLink).toBeVisible();

		const createLink = page.getByRole('link', { name: /create art/i });
		await expect.element(createLink).toBeVisible();

		const refreshButton = page.getByRole('button', { name: /refresh/i });
		await expect.element(refreshButton).toBeVisible();
	});

	it('hides action buttons when viewer is null (logged out)', async () => {
		render(GalleryShellHarness, {
			roomId: 'hall-of-fame',
			viewer: null
		});

		await expect.element(page.getByTestId('shell-content')).toBeVisible();

		// Navigation should still render
		const nav = document.querySelector('nav');
		expect(nav).not.toBeNull();

		// Create Art and Refresh should not render when logged out
		const createLinks = document.querySelectorAll('a[href*="/draw"]');
		expect(createLinks.length).toBe(0);
	});
});
