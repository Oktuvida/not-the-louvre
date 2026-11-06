import { expect, test, type Page } from '@playwright/test';
import { resetDemoState } from './demo/e2e-helpers';

// A tab left open across a release still runs the build it was opened on, and
// that build's hashed files are gone from the server. The studio model is one
// of them: a visitor who walked back to the front door got the "scene preview
// paused" card over an empty room instead of the studio.

/** Answers the app's version check as if a later release were out. */
const announceRelease = (page: Page) =>
	page.route('**/_app/version.json', (route) =>
		route.fulfill({ contentType: 'application/json', json: { version: 'a-later-release' } })
	);

/** Counts the documents the tab has loaded: one more for every full page load. */
const countDocuments = (page: Page) => {
	const loaded = { documents: 0 };
	page.on('request', (request) => {
		if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
			loaded.documents += 1;
		}
	});
	return loaded;
};

/**
 * How visible the studio's canvas is, all its ancestors' opacity included: the
 * scene fades in once its model is up, a few elements above the canvas.
 */
const studioOpacity = (page: Page) =>
	page
		.locator('.home-entry-page canvas')
		.first()
		.evaluate((canvas) => {
			let opacity = 1;
			for (let element: Element | null = canvas; element; element = element.parentElement) {
				opacity *= Number(getComputedStyle(element).opacity);
			}
			return opacity;
		})
		.catch(() => 0);

test.describe('a tab opened before a release', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('gets the current studio instead of a broken one', async ({ page }) => {
		const loaded = countDocuments(page);
		// The model this tab's build asks for is gone; the next page's is there.
		await page.route('**/studio.*.glb', (route) =>
			loaded.documents < 2 ? route.fulfill({ status: 404 }) : route.continue()
		);
		await announceRelease(page);

		await page.goto('/');

		await expect.poll(() => studioOpacity(page), { timeout: 15_000 }).toBe(1);
		expect(loaded.documents).toBe(2);
	});

	// A cache that keeps handing out the old page would otherwise reload the tab
	// for as long as the visitor kept it open.
	test('reloads only once when the studio is still missing after it', async ({ page }) => {
		const loaded = countDocuments(page);
		const missingModel = { requests: 0 };
		await page.route('**/studio.*.glb', (route) => {
			if (loaded.documents >= 2) missingModel.requests += 1;
			return route.fulfill({ status: 404 });
		});
		await announceRelease(page);

		await page.goto('/');
		await expect.poll(() => loaded.documents, { timeout: 15_000 }).toBe(2);
		await expect.poll(() => missingModel.requests).toBeGreaterThan(0);
		await page.waitForTimeout(1_500);

		expect(loaded.documents).toBe(2);
		await expect(page.getByRole('button', { name: 'Come In' })).toBeVisible();
	});

	test('opens the next page from the new release', async ({ page, request }) => {
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
		expect(seeded.ok()).toBe(true);
		const loaded = countDocuments(page);
		await page.goto('/gallery/hot-wall');
		await expect(page.getByTestId('hot-wall-room')).toBeVisible();

		// The visitor comes back to the tab after a release went out.
		await announceRelease(page);
		const checked = page.waitForResponse('**/_app/version.json');
		await page.evaluate(() => window.dispatchEvent(new Event('focus')));
		await checked;
		await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));

		await page.getByRole('link', { name: /Mystery Room/ }).click();

		await expect(page).toHaveURL(/\/gallery\/mystery$/);
		await expect(page.getByTestId('mystery-room')).toBeVisible();
		expect(loaded.documents).toBe(2);
	});
});
