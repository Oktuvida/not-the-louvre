import { expect, test } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

// Any artist's work can be visited: the name signed on a postcard leads to a
// wall of theirs, under their bookplate, with its own address to share.

const STUDIO = '/gallery/artist/seed_painter';

test.describe('an artist’s studio', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 30 } });
		expect(seeded.ok()).toBe(true);
	});

	test('is a step away from any postcard, and back again', async ({ page }) => {
		await page.goto('/gallery/hot-wall');
		await page
			.getByRole('button', { name: /Seeded Piece/ })
			.nth(1)
			.click();
		const postcard = page.getByRole('dialog');

		await postcard.getByRole('link', { name: /seed_painter/ }).click();

		await expect(page).toHaveURL(new RegExp(`${STUDIO}$`));
		await expect(page).toHaveTitle(/The studio of seed_painter/);
		await expect(postcard).toBeHidden();
		const plate = page.getByRole('complementary', { name: 'The studio of seed_painter' });
		await expect(plate).toContainText('this studio belongs to');
		await expect(plate).toContainText('30 pieces');

		// A visit is not one of the gallery's rooms: no tab is lit.
		await expect(
			page.getByTestId('gallery-room-header').locator('nav [aria-current="page"]')
		).toHaveCount(0);

		await page.goBack();
		await expect(page).not.toHaveURL(new RegExp(`${STUDIO}$`));
	});

	test('hangs their work newest first, and pages on as it scrolls', async ({ page }) => {
		await page.goto(STUDIO);
		const wall = page.getByTestId('artist-studio-room');
		const first = wall.getByRole('button').first();
		await expect(first).toContainText('Seeded Piece 01');
		await expect(first).toContainText('just hung');

		await page.mouse.wheel(0, 30_000);
		await expect
			.poll(async () => {
				await page.mouse.wheel(0, 30_000);
				return wall.getByRole('button', { name: /Seeded Piece (2[5-9]|30)/ }).count();
			})
			.toBeGreaterThan(0);
	});

	test('opens a postcard on the wall and closes back to it', async ({ page }) => {
		await page.goto(STUDIO);
		await page.getByTestId('artist-studio-room').getByRole('button').first().click();
		const postcard = page.getByRole('dialog');
		await expect(postcard).toBeVisible();

		await postcard.press('Escape');

		await expect(postcard).toBeHidden();
		await expect(page).toHaveURL(new RegExp(`${STUDIO}$`));
		await expect(page.getByTestId('artist-studio-room')).toBeVisible();
	});

	for (const { height, least, width } of [
		{ height: 860, least: 120, width: 1512 },
		{ height: 844, least: 120, width: 390 }
	]) {
		test(`puts the artist’s face first at ${width}×${height}`, async ({ page }) => {
			await page.setViewportSize({ height, width });
			await page.goto(STUDIO);

			const portrait = page.getByRole('img', { name: 'Portrait of seed_painter' });
			await expect(portrait).toBeVisible();
			await expect
				.poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
				.toBeGreaterThan(0);
			expect((await portrait.boundingBox())!.width, 'the face is big').toBeGreaterThanOrEqual(
				least
			);
		});
	}

	test('fits a phone, with the plate whole on screen', async ({ page }) => {
		await page.setViewportSize({ height: 844, width: 390 });
		await page.goto(STUDIO);

		const plate = page.getByRole('complementary', { name: 'The studio of seed_painter' });
		await expect(plate).toBeInViewport({ ratio: 1 });
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth, 'the page never scrolls sideways').toBeLessThanOrEqual(390);
	});

	test('is a missing page for a name nobody has', async ({ page }) => {
		const response = await page.goto('/gallery/artist/nobody_at_all');

		expect(response?.status()).toBe(404);
	});

	test('sends an artist who visits their own name to their studio', async ({ baseURL, page }) => {
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		const signedUp = await page.request.post('/?/signUp', { form: deterministicAuthUser, headers });
		expect(signedUp.ok()).toBe(true);

		await page.goto(`/gallery/artist/${deterministicAuthUser.nickname}`);

		await expect(page).toHaveURL(/\/gallery\/your-studio$/);
	});
});
