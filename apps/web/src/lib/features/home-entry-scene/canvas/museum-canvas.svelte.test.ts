import { describe, expect, it } from 'vitest';
import {
	drawStickerBackground,
	createStickerBackgroundUrl,
	type StickerVariant
} from './museum-canvas';

function createTestCanvas(w: number, h: number) {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	return { canvas, ctx };
}

function getPixelData(ctx: CanvasRenderingContext2D, w: number, h: number) {
	return ctx.getImageData(0, 0, w, h).data;
}

function hasVisiblePixels(data: Uint8ClampedArray): boolean {
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] > 0) return true;
	}
	return false;
}

describe('drawStickerBackground', () => {
	it('renders visible pixels onto the canvas', () => {
		const { ctx } = createTestCanvas(200, 56);

		drawStickerBackground(ctx, 200, 56, { variant: 'primary' });

		const data = getPixelData(ctx, 200, 56);
		expect(hasVisiblePixels(data)).toBe(true);
	});

	it('produces deterministic output for the same inputs', () => {
		const { ctx: ctx1 } = createTestCanvas(200, 56);
		const { ctx: ctx2 } = createTestCanvas(200, 56);

		drawStickerBackground(ctx1, 200, 56, { variant: 'primary' });
		drawStickerBackground(ctx2, 200, 56, { variant: 'primary' });

		const data1 = getPixelData(ctx1, 200, 56);
		const data2 = getPixelData(ctx2, 200, 56);
		expect(data1).toEqual(data2);
	});

	it('produces different output for different variants', () => {
		const { ctx: ctx1 } = createTestCanvas(200, 56);
		const { ctx: ctx2 } = createTestCanvas(200, 56);

		drawStickerBackground(ctx1, 200, 56, { variant: 'primary' });
		drawStickerBackground(ctx2, 200, 56, { variant: 'secondary' });

		const data1 = getPixelData(ctx1, 200, 56);
		const data2 = getPixelData(ctx2, 200, 56);

		// At least some pixels should differ between variants
		let differences = 0;
		for (let i = 0; i < data1.length; i++) {
			if (data1[i] !== data2[i]) differences++;
		}
		expect(differences).toBeGreaterThan(0);
	});

	it('supports all five variants without error', () => {
		const variants: StickerVariant[] = ['primary', 'secondary', 'accent', 'danger', 'ghost'];

		for (const variant of variants) {
			const { ctx } = createTestCanvas(180, 48);
			expect(() => drawStickerBackground(ctx, 180, 48, { variant })).not.toThrow();

			const data = getPixelData(ctx, 180, 48);
			expect(hasVisiblePixels(data)).toBe(true);
		}
	});

	it('defaults to primary variant when no options are provided', () => {
		const { ctx: ctxDefault } = createTestCanvas(200, 56);
		const { ctx: ctxPrimary } = createTestCanvas(200, 56);

		drawStickerBackground(ctxDefault, 200, 56);
		drawStickerBackground(ctxPrimary, 200, 56, { variant: 'primary' });

		const dataDefault = getPixelData(ctxDefault, 200, 56);
		const dataPrimary = getPixelData(ctxPrimary, 200, 56);
		expect(dataDefault).toEqual(dataPrimary);
	});
});

describe('createStickerBackgroundUrl', () => {
	it('returns a valid PNG data URL', () => {
		const url = createStickerBackgroundUrl(200, 56, { variant: 'primary' });

		expect(url).toMatch(/^data:image\/png/);
	});

	it('returns a non-empty data URL for each variant', () => {
		const variants: StickerVariant[] = ['primary', 'secondary', 'accent', 'danger', 'ghost'];

		for (const variant of variants) {
			const url = createStickerBackgroundUrl(180, 48, { variant });
			expect(url.length).toBeGreaterThan(100);
		}
	});
});
