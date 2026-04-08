import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
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

	it('requests willReadFrequently for sticker canvases', async () => {
		const originalGetContext = HTMLCanvasElement.prototype.getContext;
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(function (this: HTMLCanvasElement, ...args: unknown[]) {
				return originalGetContext.apply(this, args as Parameters<HTMLCanvasElement['getContext']>);
			} as HTMLCanvasElement['getContext']);

		render(GameControlsHarness);
		await expect.element(page.getByRole('button', { name: 'Create Art' })).toBeVisible();

		expect(
			getContextSpy.mock.calls.some((call) => {
				const [contextId, options] = call as [string, CanvasRenderingContext2DSettings?];

				return (
					contextId === '2d' &&
					typeof options === 'object' &&
					options !== null &&
					'willReadFrequently' in options &&
					options.willReadFrequently === true
				);
			})
		).toBe(true);
	});
});
