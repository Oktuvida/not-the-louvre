import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GameControlsHarness from './GameControlsHarness.svelte';

describe('GameButton', () => {
	it('supports reference-aligned size and variant presets', async () => {
		render(GameControlsHarness);

		const cta = page.getByRole('button', { name: 'Create Art' });
		const cancel = page.getByRole('button', { name: 'Cancel' });

		await expect.element(cta).toHaveAttribute('data-sticker-size', 'lg');
		await expect.element(cta).toHaveAttribute('data-sticker-variant', 'accent');
		await expect.element(cancel).toHaveAttribute('data-sticker-size', 'sm');
		await expect.element(cancel).toHaveAttribute('data-sticker-variant', 'ghost');
		await expect.element(cancel).toBeDisabled();

		const ctaBackground = document.querySelector('[data-testid="game-button-bg"]');
		expect(ctaBackground?.getAttribute('src')).toMatch(
			/^\/generated\/sticker-lg-accent\.v\d+\.svg$/
		);
	});

	it('paints the sticker from a cached static asset instead of a per-instance canvas', async () => {
		render(GameControlsHarness);

		const cta = page.getByRole('button', { name: 'Create Art' });
		await expect.element(cta).toBeVisible();

		// The background used to be painted twice: an <img> before hydration and
		// a per-pixel canvas repaint after it, on a ResizeObserver. One shared,
		// cacheable file replaces both.
		expect(document.querySelectorAll('canvas')).toHaveLength(0);
	});
});
