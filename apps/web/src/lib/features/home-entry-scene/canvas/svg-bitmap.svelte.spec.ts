import { describe, expect, it } from 'vitest';
import { rasterizeSvgUrl } from './svg-bitmap';

const svgDataUrl = (markup: string) => `data:image/svg+xml,${encodeURIComponent(markup)}`;

const loadImage = (url: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`failed to load ${url}`));
		image.src = url;
	});

const samplePixel = (image: HTMLImageElement, x: number, y: number) => {
	const canvas = document.createElement('canvas');
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('no 2d context');
	context.drawImage(image, 0, 0);
	return [...context.getImageData(x, y, 1, 1).data];
};

describe('rasterizeSvgUrl', () => {
	it('turns an svg data url into a fixed-resolution bitmap so browsers never re-rasterize it', async () => {
		const url = await rasterizeSvgUrl(
			svgDataUrl(
				'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ff0000"/></svg>'
			),
			{ width: 64, height: 64 }
		);

		expect(url).not.toContain('svg');

		const image = await loadImage(url);
		expect(image.naturalWidth).toBe(64);
		expect(image.naturalHeight).toBe(64);
		expect(samplePixel(image, 32, 32)).toEqual([255, 0, 0, 255]);
	});

	it('rasterizes svgs that only declare a viewBox, like the graffiti logo asset', async () => {
		const url = await rasterizeSvgUrl(
			svgDataUrl(
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="#00ff00"/></svg>'
			),
			{ width: 80, height: 40 }
		);

		const image = await loadImage(url);
		expect(image.naturalWidth).toBe(80);
		expect(image.naturalHeight).toBe(40);
		expect(samplePixel(image, 40, 20)).toEqual([0, 255, 0, 255]);
	});

	it('reuses the cached bitmap for repeated requests of the same artwork', async () => {
		const source = svgDataUrl(
			'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0000ff"/></svg>'
		);

		const [first, second] = await Promise.all([
			rasterizeSvgUrl(source, { width: 32, height: 32 }),
			rasterizeSvgUrl(source, { width: 32, height: 32 })
		]);

		expect(first).toBe(second);
		expect(await rasterizeSvgUrl(source, { width: 32, height: 32 })).toBe(first);
	});
});
