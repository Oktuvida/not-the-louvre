import { expect, test, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// The museum wall behind the artworks is part of the room: it travels with
// the artworks as the visitor scrolls, on a sharp screen its bricks are as
// crisp as the pattern they are drawn from, and where a fast scroll outruns
// the painting the gap is the wall's own colour, not a dark hole.

test.use({ deviceScaleFactor: 2, viewport: { height: 800, width: 1280 } });

const WALL_PATCH = { height: 500, width: 300, x: 0, y: 100 };

/** Leaves only the wall on screen, whatever element paints it. */
const showOnlyTheWall = (page: Page) =>
	page.addStyleTag({
		content: `[data-testid='gallery-room-shell'] > :not([data-testid='gallery-wall-bricks']) { visibility: hidden !important; }`
	});

const wallPatch = (page: Page) =>
	page.screenshot({ clip: WALL_PATCH }).then((png) => png.toString('base64'));

/** Luminance rows of a screenshot, decoded by the page itself. */
const luminance = (page: Page, base64: string) =>
	page.evaluate(async (data) => {
		const image = new Image();
		image.src = `data:image/png;base64,${data}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d')!;
		context.drawImage(image, 0, 0);
		const pixels = context.getImageData(0, 0, image.width, image.height).data;
		const rows: number[][] = [];
		for (let y = 0; y < image.height; y += 1) {
			const row: number[] = [];
			for (let x = 0; x < image.width; x += 1) {
				const i = (y * image.width + x) * 4;
				row.push(0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!);
			}
			rows.push(row);
		}
		return rows;
	}, base64);

/** Edge energy: how much detail survives, which blurring takes away. */
const sharpness = (rows: number[][]) => {
	let total = 0;
	let count = 0;
	for (let y = 1; y < rows.length - 1; y += 1) {
		for (let x = 1; x < rows[y]!.length - 1; x += 1) {
			const edge =
				4 * rows[y]![x]! -
				rows[y]![x - 1]! -
				rows[y]![x + 1]! -
				rows[y - 1]![x]! -
				rows[y + 1]![x]!;
			total += edge * edge;
			count += 1;
		}
	}
	return total / count;
};

test.describe('the gallery wall', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 40 } });
		expect(seeded.ok()).toBe(true);
	});

	test('travels with the artworks as the visitor scrolls, as sharp as its pattern', async ({
		page
	}) => {
		await page.goto('/gallery/hot-wall');
		await expect(page.getByRole('button', { name: /Seeded Piece/ }).first()).toBeVisible();
		await showOnlyTheWall(page);

		await page.evaluate(() => window.scrollTo(0, 0));
		const atTop = await luminance(page, await wallPatch(page));
		await page.evaluate(() => window.scrollTo(0, 300));
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
		const scrolled = await luminance(page, await wallPatch(page));

		// 300 CSS pixels down, the bricks that were 300 pixels lower are now
		// where the patch starts: the wall moved exactly as far as the page.
		const shift = 300 * 2;
		let difference = 0;
		let samples = 0;
		for (let y = 0; y < atTop.length - shift; y += 1) {
			for (let x = 0; x < atTop[y]!.length; x += 1) {
				difference += Math.abs(scrolled[y]![x]! - atTop[y + shift]![x]!);
				samples += 1;
			}
		}
		expect(difference / samples).toBeLessThan(2);

		// The same pattern, drawn by the browser where nothing moves it.
		const patternUrl = await page.evaluate(
			() =>
				[...document.querySelectorAll('*')]
					.map((element) => getComputedStyle(element).backgroundImage)
					.find((image) => image.includes('museum-wall')) ?? ''
		);
		expect(patternUrl).not.toBe('');
		await page.evaluate(
			({ image, patch }) => {
				const reference = document.createElement('div');
				Object.assign(reference.style, {
					backgroundImage: image,
					backgroundSize: '512px 512px',
					height: `${patch.height}px`,
					left: `${patch.x}px`,
					position: 'fixed',
					top: `${patch.y}px`,
					width: `${patch.width}px`,
					zIndex: '2147483647'
				});
				document.body.append(reference);
			},
			{ image: patternUrl, patch: WALL_PATCH }
		);
		const pattern = await luminance(page, await wallPatch(page));

		expect(sharpness(scrolled) / sharpness(pattern)).toBeGreaterThan(0.85);
	});

	test('fills what a fast scroll has not painted yet with the wall’s own colour', async ({
		page
	}) => {
		await page.goto('/gallery/hot-wall');
		await expect(page.getByRole('button', { name: /Seeded Piece/ }).first()).toBeVisible();

		// The browser fills a tile it has not painted with the shell's colour,
		// and beyond the shell with the page's.
		const fills = await page.evaluate(() =>
			[document.querySelector("[data-testid='gallery-room-shell']")!, document.body].map(
				(element) =>
					getComputedStyle(element).backgroundColor.match(/\d+/g)!.slice(0, 3).map(Number)
			)
		);

		// The bricks' own average colour, drawn from the pattern itself.
		const brick = await page.evaluate(async () => {
			const image = [...document.querySelectorAll('*')]
				.map((element) => getComputedStyle(element).backgroundImage)
				.find((value) => value.includes('museum-wall'))!;
			const url = image.match(/url\("?([^")]+)"?\)/)![1]!;
			const picture = new Image();
			picture.src = url;
			await picture.decode();
			const canvas = document.createElement('canvas');
			canvas.width = 64;
			canvas.height = 64;
			const context = canvas.getContext('2d')!;
			context.drawImage(picture, 0, 0, 64, 64);
			const pixels = context.getImageData(0, 0, 64, 64).data;
			const sum = [0, 0, 0];
			for (let i = 0; i < pixels.length; i += 4) {
				for (let channel = 0; channel < 3; channel += 1) sum[channel] += pixels[i + channel]!;
			}
			return sum.map((total) => total / (pixels.length / 4));
		});

		for (const fill of fills) {
			fill.forEach((channel, index) => {
				expect(Math.abs(channel - brick[index]!)).toBeLessThan(24);
			});
		}
	});
});
