import { expect, test } from '@playwright/test';
import { resetDemoState, signUpThroughNicknameDemo } from '../demo/e2e-helpers';

// A vote that does not reach the server is stamped on the postcard it was
// cast on, and the stamp's Try again sends the same vote once more: the
// visitor neither loses the vote nor has to work out that it was lost.

test.beforeEach(async ({ request }) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);
});

test('a vote that did not go through is stamped on the postcard and sent again from the stamp', async ({
	page
}) => {
	await page.goto('/demo/better-auth/login');
	await signUpThroughNicknameDemo(page);
	await page.goto('/gallery/hot-wall');
	await page.getByRole('button', { name: /Hottest right now/ }).click();
	const postcard = page.getByRole('dialog', { name: /Artwork details for/ });
	await expect(postcard).toBeVisible();

	// The first vote is lost on the way, the way a dropped connection loses it.
	let loseNext = true;
	await page.route(
		(url) => url.pathname.endsWith('/vote'),
		async (route) => {
			if (!loseNext || route.request().method() !== 'POST') return route.continue();
			loseNext = false;
			await route.fulfill({ status: 502, body: 'Bad Gateway', contentType: 'text/html' });
		}
	);

	const upvote = postcard.getByRole('button', { name: /^Upvote/ });
	await upvote.click();

	const stamp = postcard.getByRole('alert').filter({ hasText: 'Not sent' });
	await expect(stamp.getByText("Your vote didn't make it onto the ledger.")).toBeVisible();
	await expect(upvote).toHaveAttribute('aria-pressed', 'false');

	const voteLanded = page.waitForResponse(
		(response) =>
			response.url().endsWith('/vote') && response.request().method() === 'POST' && response.ok()
	);
	await stamp.getByRole('button', { name: 'Try again' }).click();
	await voteLanded;

	await expect(stamp).toHaveCount(0);
	await expect(upvote).toHaveAttribute('aria-pressed', 'true');
});
