import { expect, test, type Page } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The studio's 3D room takes a moment on a slow connection, and used to leave
// a generic loading card over an empty frame. Now the room is drawn in pencil
// where it will stand, and the real one fades in over the drawing.

test.use({ viewport: { height: 800, width: 1280 } });

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

/** Holds the studio's model back until `release` is called. */
const holdTheModel = async (page: Page) => {
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/studio.*.glb', async (route) => {
		await released;
		await route.continue();
	});
	return release;
};

test.describe('the studio while it is on its way', () => {
	test.beforeEach(async ({ baseURL, page, request }) => {
		await resetDemoState(request);
		// Signed in with an avatar, the visitor lands inside the room.
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		await page.request.post('/?/signUp', { form: deterministicAuthUser, headers });
		await page.request.post('/?/saveAvatar', {
			form: {
				drawingDocument: JSON.stringify({
					...createEmptyDrawingDocument('avatar'),
					strokes: [
						{
							color: '#2d2420',
							points: [
								[100, 100],
								[300, 300]
							],
							size: 12
						}
					]
				})
			},
			headers
		});
	});

	test('is drawn in pencil, then gives way to the room', async ({ page }) => {
		const release = await holdTheModel(page);
		await page.goto('/');

		await expect(page.getByText(/setting up the studio/i)).toBeAttached();
		const sketch = page.getByTestId('studio-sketch');
		await expect(sketch).toBeVisible();
		await expect
			.poll(() => sketch.evaluate((image: HTMLImageElement) => image.naturalWidth))
			.toBeGreaterThan(0);
		expect(await studioOpacity(page)).toBe(0);

		release();

		await expect.poll(() => studioOpacity(page), { timeout: 20_000 }).toBe(1);
		await expect(sketch).toBeHidden();
	});

	test('that never comes leaves the drawing, and a way to try again', async ({ page }) => {
		const model = { missing: true };
		await page.route('**/studio.*.glb', (route) =>
			model.missing ? route.fulfill({ status: 404 }) : route.continue()
		);
		await page.goto('/');

		const tryAgain = page.getByRole('button', { name: /try the real room/i });
		await expect(tryAgain).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('studio-sketch')).toBeVisible();

		model.missing = false;
		await tryAgain.click();

		await expect.poll(() => studioOpacity(page), { timeout: 15_000 }).toBe(1);
		await expect(tryAgain).toBeHidden();
	});
});
