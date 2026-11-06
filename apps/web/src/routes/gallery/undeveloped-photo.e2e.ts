import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// A photo that did not come the first time used to stay a broken-image icon
// until the visitor reloaded the page. Now the empty polaroid, or the one a
// spin landed on in the Mystery Room, says so in pencil and fetches the photo
// again by itself.

/** Seeds a small gallery whose every photo fails the first time it is asked for. */
const seedPhotosThatFailOnce = async (page: Page, request: APIRequestContext) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);

	const failedOnce = new Set<string>();
	await page.route('**/api/artworks/*/media*', (route) => {
		const artwork = new URL(route.request().url()).pathname;
		if (failedOnce.has(artwork)) return route.continue();
		failedOnce.add(artwork);
		return route.fulfill({ body: 'unavailable', status: 503 });
	});
};

test('a photo that fails once develops on its own, with no reload', async ({ page, request }) => {
	await seedPhotosThatFailOnce(page, request);

	await page.goto('/gallery/hot-wall');
	const lead = page.getByRole('button', { name: /Hottest right now/ });
	await expect(lead).toBeVisible();

	await expect(lead.getByText(/didn.t develop/i)).toBeVisible();

	const photo = lead.getByRole('img').first();
	await expect
		.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth), {
			timeout: 15_000
		})
		.toBeGreaterThan(0);
	await expect(photo).toBeVisible();
	await expect(lead.getByText(/didn.t develop/i)).toBeHidden();
});

test('the photo a spin lands on, if it fails once, develops on its own', async ({
	page,
	request
}) => {
	await seedPhotosThatFailOnce(page, request);
	await page.emulateMedia({ reducedMotion: 'reduce' });

	await page.goto('/gallery/mystery');
	await page.getByRole('button', { name: /spin/i }).click();

	const reel = page.getByTestId('film-reel');
	await expect(reel.getByText(/didn.t develop/i)).toBeVisible();

	await expect
		.poll(
			() =>
				reel.evaluate((element) => {
					const image = element.querySelector('img');
					return (
						(image?.naturalWidth ?? 0) > 0 && !/didn.t develop/i.test(element.textContent ?? '')
					);
				}),
			{ timeout: 15_000 }
		)
		.toBe(true);
});
