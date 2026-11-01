import { expect, test } from '@playwright/test';

// A page that is not there still looks like the museum: its way home and its
// way to the studio are the same paper stickers as everywhere else, not
// stickers with a frame drawn round them.

test('a missing page offers its ways out as plain stickers', async ({ page }) => {
	await page.goto('/no-such-room');
	await expect(page.getByText('Oops! This Canvas is Blank')).toBeVisible();

	for (const name of [/go home/i, /start drawing/i]) {
		const link = page.getByRole('link', { name });
		await expect(link).toBeVisible();
		const frame = await link.evaluate((element) => getComputedStyle(element).borderTopWidth);
		expect(frame, `the ${name} sticker's frame`).toBe('0px');
	}
});
