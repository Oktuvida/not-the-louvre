import { expect, test, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// An artwork opened on a phone reads as a whole postcard: every word and every
// control on either face sits on the card, none of it running off its edge.

/** What on a face runs past the face's own edges, by how far. */
const overflowOf = (page: Page, face: string) =>
	page.evaluate((selector) => {
		const card = document.querySelector(selector)!.getBoundingClientRect();
		const spills: string[] = [];
		for (const element of document.querySelectorAll(
			`${selector} button, ${selector} a, ${selector} p, ${selector} h2, ${selector} span`
		)) {
			const text = (element as HTMLElement).innerText?.trim();
			if (!text) continue;
			const box = element.getBoundingClientRect();
			if (box.width === 0) continue;
			// The comments tape is cut to hang over the edge like real tape, a little.
			const allowance = element.closest('button[aria-label="Read the comments"]') ? 8 : 1;
			const past = Math.max(card.left - box.left, box.right - card.right);
			if (past > allowance) spills.push(`"${text.slice(0, 30)}" by ${Math.round(past)}px`);
		}
		return spills;
	}, face);

test.describe('a postcard on a phone', () => {
	test.use({ viewport: { height: 844, width: 390 } });

	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
		expect(seeded.ok()).toBe(true);
	});

	test('keeps everything on either face on the card', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/gallery/hot-wall');
		await page
			.getByRole('button', { name: /Seeded Piece/ })
			.nth(2)
			.click();
		await expect(page.getByRole('dialog')).toBeVisible();

		expect(await overflowOf(page, '.postcard-front')).toEqual([]);

		await page.getByRole('button', { name: 'Read the comments' }).click();
		await expect(page.getByText("Visitor's Book", { exact: true })).toBeVisible();
		expect(await overflowOf(page, '.postcard-back')).toEqual([]);
	});
});
