import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DrawingCanvas from './DrawingCanvas.svelte';

describe('DrawingCanvas', () => {
	it('renders product-facing status messaging below the canvas', async () => {
		render(DrawingCanvas, {
			statusMessage: 'Artwork published as Untitled #0001',
			statusTone: 'success'
		});

		await expect.element(page.getByText('Artwork published as Untitled #0001')).toBeVisible();
	});
});
