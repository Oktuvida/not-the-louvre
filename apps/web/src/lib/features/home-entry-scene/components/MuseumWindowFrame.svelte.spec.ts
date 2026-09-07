import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { museumWindowFrameAssetUrl } from '$lib/features/shared-ui/generated-art';
import MuseumWindowFrame from './MuseumWindowFrame.svelte';

describe('MuseumWindowFrame', () => {
	it('renders an SSR-ready image instead of a mount-only canvas', () => {
		render(MuseumWindowFrame);

		const frameImage = document.querySelector('[data-testid="museum-window-frame"]');

		expect(frameImage?.tagName).toBe('IMG');
		// The 29.7KB frame is a committed static file, not markup inlined into
		// every home document.
		expect(frameImage?.getAttribute('src')).toBe(museumWindowFrameAssetUrl);
		expect(document.querySelector('canvas')).toBeNull();
	});

	it('swaps the vector frame for a bitmap after mount so zooming never re-rasterizes svg', async () => {
		render(MuseumWindowFrame);

		const frameImage = document.querySelector('[data-testid="museum-window-frame"]');

		await expect.poll(() => frameImage?.getAttribute('src'), { timeout: 5000 }).toMatch(/^blob:/);
	});
});
