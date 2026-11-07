import { expect, test } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The gallery's top three hang on the front door's right wall. A visitor who
// picks one walks into the Hall of Fame with that artwork's postcard open,
// rather than into the gallery wherever they last left it.

test.use({ viewport: { height: 800, width: 1280 } });

test.beforeEach(async ({ baseURL, page, request }) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);
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

test(
	'a best piece on the front door opens as its postcard in the Hall of Fame',
	{
		tag: '@gpu'
	},
	async ({ page }) => {
		await page.goto('/');
		const runnerUp = page.getByTestId('home-preview-frame-2');
		await expect(runnerUp).toBeVisible();
		const title = await runnerUp.locator('img').first().getAttribute('alt');

		await runnerUp.click();

		const postcard = page.getByRole('dialog', { name: `Artwork details for ${title}` });
		await expect(postcard).toBeVisible({ timeout: 15_000 });
		await expect(page).toHaveURL(/\/artwork\/[^/]+$/);
		// The room behind it is the one these pieces come from.
		await expect(page.getByTestId('podium-artwork-1')).toBeAttached();

		await page.keyboard.press('Escape');
		await expect(postcard).toBeHidden();
		await expect(page).toHaveURL(/\/gallery$/);
	}
);

test('a best piece is a link to its own page', async ({ page }) => {
	await page.goto('/');
	const champion = page.getByTestId('home-preview-frame-1');
	await expect(champion).toBeVisible();

	// Opened in a new tab, copied or shared, it still leads to the artwork.
	await expect(page.getByRole('link').filter({ has: champion })).toHaveAttribute(
		'href',
		/^\/artwork\/[^/]+$/
	);
});
