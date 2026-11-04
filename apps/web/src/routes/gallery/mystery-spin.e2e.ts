import { expect, test, type Locator } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// The Mystery Room keeps its mystery: every photo on the line is undeveloped,
// so none is fetched until a spin lands on one. That one comes up in front of
// the visitor and opens as a postcard.

const isPhoto = (url: string) => /\/api\/artworks\/[^/]+\/media/.test(url);
const artworkOf = (url: string) => /\/api\/artworks\/([^/]+)\/media/.exec(url)?.[1];

type Box = { height: number; width: number; x: number; y: number };

const boxOf = async (locator: Locator) => {
	const box = await locator.boundingBox();
	if (!box) throw new Error('Expected it on screen');
	return box;
};

const overlaps = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('the Mystery Room', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
		expect(seeded.ok()).toBe(true);
	});

	test('fetches no photo until a spin lands, then only that one', async ({ page }) => {
		const asked: string[] = [];
		page.on('request', (request) => {
			if (isPhoto(request.url())) asked.push(request.url());
		});

		await page.goto('/gallery/mystery');
		const spin = page.getByRole('button', { name: /spin/i });
		await expect(spin).toBeVisible();
		await page.waitForTimeout(800);
		expect(asked).toEqual([]);

		await spin.click();

		await expect(page.getByRole('dialog', { name: /Artwork details for/ })).toBeVisible({
			timeout: 12_000
		});
		expect(asked.length).toBeGreaterThan(0);
		expect(new Set(asked.map(artworkOf)).size).toBe(1);
	});

	test('leaves the piece up on the line after its postcard closes', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/gallery/mystery');

		await page.getByRole('button', { name: /spin/i }).click();
		const postcard = page.getByRole('dialog', { name: /Artwork details for/ });
		await expect(postcard).toBeVisible({ timeout: 12_000 });
		await postcard.press('Escape');
		await expect(postcard).toBeHidden();

		await expect(page.getByRole('button', { name: /^Open Seeded Piece/ })).toBeVisible();
	});

	for (const { height, width } of [
		{ height: 860, width: 1512 },
		{ height: 720, width: 1280 },
		{ height: 1180, width: 820 },
		{ height: 844, width: 390 }
	]) {
		test(`fits ${width}×${height} with a big photo and Spin on screen`, async ({ page }) => {
			await page.setViewportSize({ height, width });
			await page.goto('/gallery/mystery');
			const spin = page.getByRole('button', { name: /spin/i });

			await expect(spin).toBeInViewport({ ratio: 1 });
			await expect(page.getByText(/discover a random masterpiece/i)).toBeInViewport({ ratio: 1 });

			const line = await page.getByTestId('film-reel').boundingBox();
			const photo = await page.getByTestId('film-reel-track').locator('> *').nth(6).boundingBox();
			expect(line && Math.round(line.x)).toBe(0);
			expect(line && Math.round(line.width)).toBe(width);
			// The polaroid in the middle takes a fair share of the screen.
			expect(photo!.height, 'the polaroid is big').toBeGreaterThanOrEqual(height * 0.32);
			expect(Math.abs(photo!.x + photo!.width / 2 - width / 2)).toBeLessThanOrEqual(2);

			const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(scrollWidth, 'the page never scrolls sideways').toBeLessThanOrEqual(width);

			// Nothing lies on the polaroid in the ring, and the record player
			// leaves the note under Spin whole.
			const ring = page.getByTestId('film-reel-track').locator('> *').nth(6);
			const note = page.getByText(/Nothing on this line/);
			expect(overlaps(await boxOf(note), await boxOf(ring)), 'the note on the polaroid').toBe(
				false
			);
			const player = page.getByRole('button', { name: 'Ambient music' });
			const slip = page.getByText(/discover a random masterpiece/i);
			expect(overlaps(await boxOf(slip), await boxOf(player)), 'the record player').toBe(false);
		});
	}
});
