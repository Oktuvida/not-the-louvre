import { expect, test } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// A visit to the gallery draws the Hall of Fame's award style once, rubber
// stamps or marker doodles: the podium and the champion's postcard wear the
// same one, and walking to another room and back does not draw again.

const champion = /^Champion, first place \((rubber stamp|marker doodle)\)$/;

test('the podium and the champion’s postcard wear the same award for the whole visit', async ({
	page,
	request
}) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);

	await page.goto('/gallery/hall-of-fame');
	const podiumAward = page.getByRole('img', { name: champion });
	await expect(podiumAward).toBeVisible();
	const name = (await podiumAward.getAttribute('aria-label')) ?? '';

	await page.getByTestId('podium-artwork-1').click();
	const postcard = page.getByRole('dialog');
	await expect(postcard.getByRole('img', { name })).toBeVisible();
	await postcard.press('Escape');
	await expect(postcard).toBeHidden();

	await page.getByRole('link', { name: 'The Hot Wall' }).click();
	await expect(page).toHaveURL(/\/gallery\/hot-wall/);
	await page.getByRole('link', { name: 'Hall of Fame' }).click();
	// The Hall of Fame is the gallery's front room, at /gallery itself.
	await expect(page).not.toHaveURL(/hot-wall/);
	await expect(page.getByRole('img', { name: champion })).toHaveAttribute('aria-label', name);
});
