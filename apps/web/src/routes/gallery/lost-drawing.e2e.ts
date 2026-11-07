import { expect, test } from '@playwright/test';
import { publishArtworkThroughActions, resetDemoState } from '../demo/e2e-helpers';

// A replay needs the strokes. An artwork can outlive them: a few old drawings
// never reached object storage whole, and only their image is left.

test.describe('An artwork with no drawing behind it', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('offers no replay, and still everything else', async ({ page, request }) => {
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 1 } });
		expect(seeded.ok()).toBe(true);

		await page.goto('/gallery/wet-paint');
		await page.getByTestId('wet-paint-room').getByRole('button').first().click();

		const postcard = page.getByRole('dialog');
		await expect(postcard.getByRole('button', { name: 'Download' })).toBeVisible();
		await expect(postcard.getByRole('button', { name: 'Watch it being drawn' })).toBeHidden();
	});

	test('leaves the replay on one drawn in the studio', async ({ baseURL, page, request }) => {
		await publishArtworkThroughActions(request, baseURL, { title: 'Drawn Whole' });

		await page.goto('/gallery/wet-paint');
		await page.getByRole('button', { name: /Drawn Whole/ }).click();

		const postcard = page.getByRole('dialog');
		await expect(postcard.getByRole('button', { name: 'Download' })).toBeVisible();
		await expect(postcard.getByRole('heading', { name: 'Drawn Whole' })).toBeVisible();
		await expect(postcard.getByRole('button', { name: 'Watch it being drawn' })).toBeVisible();
	});
});
