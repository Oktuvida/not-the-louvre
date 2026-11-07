import { expect, test } from '@playwright/test';

// A page that is not there is a gap on the gallery wall: an empty frame and
// the museum's label beside it, saying why nothing hangs there. Its ways out
// are the same paper stickers as everywhere else, not stickers with a frame
// drawn round them.

test('a missing page is an empty frame with the museum label beside it', async ({ page }) => {
	await page.goto('/no-such-room');

	await expect(page.getByRole('heading', { name: 'Room 404' })).toBeVisible();
	await expect(page.getByText('Not on display')).toBeVisible();
	await expect(page.getByText('This piece was moved, sold, or never painted.')).toBeVisible();

	for (const name of [/go home/i, /start drawing/i]) {
		const link = page.getByRole('link', { name });
		await expect(link).toBeVisible();
		const frame = await link.evaluate((element) => getComputedStyle(element).borderTopWidth);
		expect(frame, `the ${name} sticker's frame`).toBe('0px');
	}

	await page.getByRole('link', { name: /go home/i }).click();
	await expect(page).toHaveURL(/\/$/);
});
