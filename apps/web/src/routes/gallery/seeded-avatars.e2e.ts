import { expect, test } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// The gallery the journeys seed is hung by an artist with a face, as a real
// gallery is: every card carries its artist's avatar, so the wall is checked
// the way visitors see it.

test('the seeded gallery’s cards carry their artist’s avatar', async ({ page, request }) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);

	await page.goto('/gallery/hot-wall');
	// A card on the wall, not the lead; by its alt text, since a card is a button
	// and a button's contents are not exposed as roles.
	const avatar = page
		.getByRole('button', { name: /Seeded Piece/ })
		.filter({ hasNotText: 'Hottest right now' })
		.first()
		.getByAltText('seed_painter');
	await expect(avatar).toBeVisible();
	await expect
		.poll(() => avatar.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
		.toBeGreaterThan(0);
});
