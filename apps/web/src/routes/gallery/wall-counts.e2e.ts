import { expect, test } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

// A vote cast on a postcard shows on its polaroid once the postcard is put
// away, wherever on the wall the polaroid hangs: also far down, among the
// pages the wall fetched while the visitor scrolled.

test('a vote far down the wall shows on its polaroid once the postcard is put away', async ({
	baseURL,
	page,
	request
}) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 30 } });
	expect(seeded.ok()).toBe(true);
	await page.request.post('/?/signUp', {
		form: deterministicAuthUser,
		headers: { origin: baseURL ?? '', 'x-sveltekit-action': 'true' }
	});

	await page.goto('/gallery/wet-paint');
	// The oldest piece hangs past the first page of the wall.
	const deep = page.getByTestId('wet-paint-room').getByRole('button', { name: /Seeded Piece 30/ });
	await expect(async () => {
		await page.mouse.wheel(0, 2000);
		await expect(deep).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 30_000 });
	await expect(deep).toContainText('1 vote');

	await deep.click();
	const upvote = page.getByRole('dialog').getByRole('button', { name: /Upvote/ });
	await upvote.click();
	await expect(upvote).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Escape');

	await expect(deep).toContainText('2 votes');
});
