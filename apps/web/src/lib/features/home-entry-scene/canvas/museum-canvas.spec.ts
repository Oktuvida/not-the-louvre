import { describe, expect, it } from 'vitest';
import {
	createMuseumWallPatternUrl,
	createMuseumWindowFrameUrl,
	createStickerBackgroundUrl
} from './museum-canvas';

describe('createMuseumWallPatternUrl', () => {
	it('returns a deterministic inline SVG data URL without relying on document', () => {
		const firstUrl = createMuseumWallPatternUrl();
		const secondUrl = createMuseumWallPatternUrl();

		expect(firstUrl).toMatch(/^data:image\/svg\+xml,/);
		expect(secondUrl).toBe(firstUrl);
		expect(firstUrl).toContain('%3Csvg');
		expect(firstUrl).toContain('%3Crect%20width%3D%22512%22%20height%3D%22512%22');
		expect(firstUrl).toContain('%236c5e4b');
	});
});

describe('createMuseumWindowFrameUrl', () => {
	it('returns a deterministic image data URL without relying on component mount work', () => {
		const firstUrl = createMuseumWindowFrameUrl();
		const secondUrl = createMuseumWindowFrameUrl();

		expect(firstUrl).toMatch(/^data:image\/(png|svg\+xml)/);
		expect(secondUrl).toBe(firstUrl);
		expect(firstUrl.length).toBeGreaterThan(1000);
	});
});

describe('createStickerBackgroundUrl', () => {
	it('returns a deterministic inline image URL without relying on document', () => {
		const firstUrl = createStickerBackgroundUrl(200, 56, { variant: 'primary' });
		const secondUrl = createStickerBackgroundUrl(200, 56, { variant: 'primary' });

		expect(firstUrl).toMatch(/^data:image\/(png|svg\+xml)/);
		expect(secondUrl).toBe(firstUrl);
		expect(firstUrl).toContain('%3Csvg');
	});
});
