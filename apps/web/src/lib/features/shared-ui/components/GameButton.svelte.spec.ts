import { page } from 'vitest/browser';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GameButton from './GameButton.svelte';
import GameControlsHarness from './GameControlsHarness.svelte';

// The shared harness covers the size/variant presets; the toggle cases below
// need one button at a time, so they supply their own label snippet instead.
const stickerLabel = (text: string) =>
	createRawSnippet<[]>(() => ({ render: () => `<span>${text}</span>` }));

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

	it('announces a pressed toggle through aria-pressed', async () => {
		render(GameButton, { ariaPressed: true, children: stickerLabel('Upvote') });

		await expect
			.element(page.getByRole('button', { name: 'Upvote' }))
			.toHaveAttribute('aria-pressed', 'true');
	});

	it('announces the unpressed half of a toggle rather than dropping the attribute', async () => {
		render(GameButton, { ariaPressed: false, children: stickerLabel('Downvote') });

		await expect
			.element(page.getByRole('button', { name: 'Downvote' }))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('never claims a toggle state on a plain sticker button', async () => {
		render(GameButton, { children: stickerLabel('Fork') });

		await expect
			.element(page.getByRole('button', { name: 'Fork' }))
			.not.toHaveAttribute('aria-pressed');
	});
});
