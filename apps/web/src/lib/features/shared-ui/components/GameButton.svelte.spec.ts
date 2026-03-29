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
	});
});
