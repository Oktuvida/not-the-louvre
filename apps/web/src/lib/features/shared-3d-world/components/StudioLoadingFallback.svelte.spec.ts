import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StudioLoadingFallback from './StudioLoadingFallback.svelte';

// Where the 3D studio will stand, the room is drawn in pencil while it is on
// its way; if it never comes, the drawing stays and offers to try again.

describe('StudioLoadingFallback', () => {
	it('tells the visitor the studio is being set up, with nothing to press', async () => {
		await render(StudioLoadingFallback);

		await expect.element(page.getByRole('status')).toMatchTextContent(/setting up the studio/i);
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});

	it('offers to try the real room again when the studio could not come', async () => {
		const onRetry = vi.fn();
		await render(StudioLoadingFallback, { failed: true, onRetry });

		await expect.element(page.getByRole('status')).toMatchTextContent(/only the sketch/i);
		await page.getByRole('button', { name: /try the real room/i }).click();

		expect(onRetry).toHaveBeenCalledOnce();
	});
});
