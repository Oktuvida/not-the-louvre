import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GameControlsHarness from './GameControlsHarness.svelte';

describe('GameLink', () => {
	it('matches the shared sticker control API for links', async () => {
		render(GameControlsHarness);

		const gallery = page.getByRole('link', { name: 'Gallery' });
		const back = page.getByRole('link', { name: 'Back' });

		await expect.element(gallery).toHaveAttribute('data-sticker-size', 'md');
		await expect.element(gallery).toHaveAttribute('data-sticker-variant', 'secondary');
		await expect.element(back).toHaveAttribute('data-sticker-size', 'sm');
		await expect.element(back).toHaveAttribute('data-sticker-variant', 'ghost');
		await expect.element(back).toHaveAttribute('href', '/draw');
	});
});
