import { expect, test } from '@playwright/test';
import { publishArtworkThroughActions, resetDemoState } from '../demo/e2e-helpers';

// Wet Paint hangs what was just drawn, newest first, whatever the votes say. A
// first drawing with no votes waits behind every favourite on the Hot Wall;
// here it goes up at the front of the wall, with a note of when it was hung.

const STILL_WET = 'Still Wet';
const WETTER = 'Wetter Still';

// How long signed-out visitors share a wall, less a margin for a slow machine.
const SHARED_WINDOW_MS = 25_000;

test.describe('Wet Paint', () => {
	test.beforeEach(async ({ baseURL, request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
		expect(seeded.ok()).toBe(true);
		await publishArtworkThroughActions(request, baseURL, { title: STILL_WET });
	});

	test('hangs a piece nobody has voted for ahead of the favourites', async ({ page }) => {
		await page.goto('/gallery/hot-wall');
		const lead = page.getByRole('button', { name: /Hottest right now/ });
		await expect(lead).toContainText('Seeded Piece 01');

		await page.getByRole('link', { name: 'Wet Paint' }).click();

		await expect(page).toHaveURL(/\/gallery\/wet-paint$/);
		const wall = page.getByTestId('wet-paint-room').getByRole('button');
		await expect(wall.first()).toContainText(STILL_WET);
		await expect(wall.first()).toContainText('just hung');
		await expect(wall.nth(1)).toContainText('Seeded Piece 01');
		await expect(wall.nth(2)).toContainText('Seeded Piece 02');
	});

	test('is shared among signed-out visitors, but never held back from an artist', async ({
		baseURL,
		page,
		request
	}) => {
		await page.goto('/gallery/wet-paint');
		const sharedSince = Date.now();
		const wall = page.getByTestId('wet-paint-room').getByRole('button');
		await expect(wall.first()).toContainText(STILL_WET);

		await publishArtworkThroughActions(request, baseURL, { title: WETTER });
		expect(await (await request.get('/gallery/wet-paint')).text()).toContain(WETTER);

		await page.reload();
		test.skip(Date.now() - sharedSince > SHARED_WINDOW_MS, 'the machine stalled past the window');
		await expect(wall.first()).toContainText(STILL_WET);
		await expect(wall.first()).toContainText('just hung');
	});

	test('opens from a shared link, and from its own note says what it is', async ({ page }) => {
		await page.goto('/gallery/wet-paint');

		await expect(page).toHaveTitle(/Wet Paint/);
		await expect(page.getByText('newest first')).toBeVisible();
		await expect(page.getByTestId('wet-paint-room').getByRole('button').first()).toContainText(
			STILL_WET
		);
	});
});
