import { describe, expect, it } from 'vitest';
import { loomBookcloth, weaveBookcloth, wearSketchbookCover } from './bookcloth';
import { SKETCHBOOK_COVER } from './cover';

// The sketchbook on the studio desk and the one on the home's side table wear
// the same two images: a tile of bookcloth that repeats across the cover, and
// the wear of this one book (its dark spine and corners, the rubbed edges,
// the grime where hands hold it), laid over the whole cover.

const luminance = (data: Uint8ClampedArray, index: number) =>
	(0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;

describe('the sketchbook’s bookcloth', () => {
	it('runs on from one tile into the next, so the cover shows no seam', () => {
		const loom = loomBookcloth({ size: 96, warp: 16, weft: 18 });
		const step = 0.02;
		const jump = (ax: number, ay: number, bx: number, by: number) => {
			const a = loom.sample(ax, ay);
			const b = loom.sample(bx, by);
			return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
		};
		// The same small step, taken across the tile's edges and inside the tile.
		let acrossEdges = 0;
		let inside = 0;
		const samples = 400;
		for (let index = 0; index < samples; index++) {
			const along = (index + 0.5) * (loom.size / samples);
			const within = 5 + ((index * 37.13) % (loom.size - 10));
			acrossEdges += jump(loom.size - step, along, step, along);
			acrossEdges += jump(along, loom.size - step, along, step);
			inside += jump(within - step, along, within + step, along);
			inside += jump(along, within - step, along, within + step);
		}

		expect(acrossEdges / samples).toBeLessThan(Math.max(1.5 * (inside / samples), 0.004));
	});

	it('shows its weave: threads catch the light and the gaps between them fall dark', () => {
		const { data, height, width } = weaveBookcloth({ size: 96, warp: 16, weft: 18 });
		const values: number[] = [];
		for (let index = 0; index < width * height * 4; index += 4) values.push(luminance(data, index));
		values.sort((a, b) => a - b);

		const gap = values[Math.floor(values.length * 0.05)];
		const thread = values[Math.floor(values.length * 0.95)];
		expect(thread - gap).toBeGreaterThan(0.12);
	});

	it('is woven from the same threads every time, so the committed images can be regenerated', () => {
		const options = { size: 48, warp: 8, weft: 8 };
		expect(weaveBookcloth(options).data).toEqual(weaveBookcloth(options).data);
		expect(wearSketchbookCover({ size: 96 }).data).toEqual(wearSketchbookCover({ size: 96 }).data);
	});
});

describe('the wear on the sketchbook’s cover', () => {
	const size = 256;
	const { data } = wearSketchbookCover({ size });
	const at = (x: number, y: number) => (Math.floor(y) * size + Math.floor(x)) * 4;
	const isDarkCloth = (x: number, y: number) =>
		data[at(x, y) + 3] / 255 > 0.5 && luminance(data, at(x, y)) < 0.35;

	it('binds the spine and the two open corners in dark cloth, and leaves the board in linen', () => {
		expect(isDarkCloth(size * 0.07, size / 2)).toBe(true);
		expect(isDarkCloth(size * 0.95, size * 0.04)).toBe(true);
		expect(isDarkCloth(size * 0.95, size * 0.96)).toBe(true);

		expect(data[at(size / 2, size / 2) + 3] / 255).toBeLessThan(0.3);
		expect(isDarkCloth(size * 0.95, size / 2)).toBe(false);
	});

	it('keeps its dark cloth to the spine and the two corners, clear of the label and the elastic', () => {
		const spine = (SKETCHBOOK_COVER.spine + 0.01) * size;
		const leg = (SKETCHBOOK_COVER.corner + 0.01) * size;
		const stray: string[] = [];

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const inSpine = x < spine;
				const inCorner = size - x + Math.min(y, size - y) < leg;
				if (!inSpine && !inCorner && isDarkCloth(x, y)) stray.push(`${x},${y}`);
			}
		}

		expect(stray).toEqual([]);
	});
});
