import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MuseumWindowFrame from './MuseumWindowFrame.svelte';

describe('MuseumWindowFrame', () => {
	it('renders an SSR-ready image instead of a mount-only canvas', () => {
		render(MuseumWindowFrame);

		const frameImage = document.querySelector('[data-testid="museum-window-frame"]');

		expect(frameImage?.tagName).toBe('IMG');
		expect(frameImage?.getAttribute('src')).toMatch(/^data:image\/(png|svg\+xml)/);
		expect(document.querySelector('canvas')).toBeNull();
	});
});
