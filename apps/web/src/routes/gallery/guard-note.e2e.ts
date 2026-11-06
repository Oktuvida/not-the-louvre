import { expect, test } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// A piece that will not open leaves the visitor on the wall as it was, with a
// note from the guard that stays up long enough to be read: the postcard is
// put away, the address is the room's again, and the piece tapped once more
// opens.

test.beforeEach(async ({ request }) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);
});

test("a piece that will not open is put away, and the guard's note stays up to be read", async ({
	page
}) => {
	await page.goto('/gallery/hot-wall');
	const piece = page.getByRole('button', { name: /Hottest right now/ });
	await expect(piece).toBeVisible();

	// The piece's own record is slow to answer and then does not come at all,
	// the way an overloaded server fails.
	let serverIsDown = true;
	await page.route(
		(url) => /^\/api\/artworks\/[^/]+$/.test(url.pathname),
		async (route) => {
			if (!serverIsDown) return route.continue();
			await new Promise((resolve) => setTimeout(resolve, 800));
			await route.fulfill({ status: 503, body: 'Service Unavailable', contentType: 'text/html' });
		}
	);

	await piece.click();
	const postcard = page.getByRole('dialog', { name: /Artwork details for/ });
	// It opens at once from the card's own copy...
	await expect(postcard).toBeVisible();
	// ...and is put away when the full record does not come.
	await expect(postcard).toBeHidden();
	await expect(page).toHaveURL(/\/gallery\/hot-wall$/);

	const note = page.getByText("Couldn't open that one. Tap it again?");
	await expect(note).toBeVisible();
	// Seconds later it is still there: long enough to read a sentence.
	await page.waitForTimeout(3000);
	await expect(note).toBeVisible();
	await expect(postcard).toBeHidden();

	// The wall still works: with the server back, the piece tapped again opens.
	serverIsDown = false;
	await piece.click();
	await expect(postcard).toBeVisible();
	await expect(page).toHaveURL(/\/artwork\/[^/]+$/);
});
