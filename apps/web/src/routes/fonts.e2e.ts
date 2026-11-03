import { expect, test, type Page } from '@playwright/test';
import { resetDemoState } from './demo/e2e-helpers';

// The three typefaces of the house (Baloo 2 for reading, Fredoka for the
// stickers and titles, Caveat for the handwriting) arrive as one file each,
// whatever weights a page paints with them. They used to come one file per
// weight, eight files on the home page alone.

const FAMILIES = ['baloo-2', 'caveat', 'fredoka'] as const;

/** Every font file the page fetched while loading and settling, by family. */
const fontFilesFetched = async (page: Page, path: string) => {
	const files: string[] = [];
	page.on('response', (response) => {
		if (response.request().resourceType() === 'font') files.push(new URL(response.url()).pathname);
	});

	await page.goto(path);
	await page.evaluate(() => document.fonts.ready);

	return Object.fromEntries(
		FAMILIES.map((family) => [
			family,
			files.filter((file) => file.split('/').pop()!.startsWith(`${family}-`))
		])
	);
};

test.describe('the house typefaces', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 12 } });
		expect(seeded.ok()).toBe(true);
	});

	for (const path of ['/', '/gallery', '/gallery/hot-wall']) {
		test(`arrive as one file per typeface on ${path}`, async ({ page }) => {
			const fetched = await fontFilesFetched(page, path);

			for (const family of FAMILIES) {
				expect(fetched[family], family).toHaveLength(1);
			}
		});
	}
});
