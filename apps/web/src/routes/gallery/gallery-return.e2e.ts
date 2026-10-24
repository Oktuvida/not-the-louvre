import { expect, test, type Locator, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// Pinterest's promise: wherever you wander off to, coming back puts you on
// the same artwork you were looking at.

const scrollUntilVisible = async (page: Page, title: RegExp) => {
	const card = page.getByRole('button', { name: title });
	await expect(async () => {
		await page.mouse.wheel(0, 400);
		await expect(card).toBeInViewport({ timeout: 500 });
	}).toPass({ timeout: 20_000 });
	return card;
};

// Where the card sits on screen, which is what the visitor sees. `scrollY`
// is not: Chrome's scroll anchoring moves it while the virtualized rows above
// get measured, precisely so that the card itself stays put.
const screenTop = async (card: Locator) => (await card.boundingBox())?.y ?? Number.NaN;

test.describe('finding your place again', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 40 } });
		expect(seeded.ok()).toBe(true);
	});

	test('a visitor who wanders to another room and back lands on the same artwork', async ({
		page
	}) => {
		await page.goto('/gallery/hot-wall');
		// Past the first page of 24, so the way back has to remember a paged feed.
		const deepCard = await scrollUntilVisible(page, /Seeded Piece 30/);
		const leftAt = await screenTop(deepCard);

		// Straight back, before the room it left has finished sliding out.
		await page.getByRole('link', { name: /Hall of Fame/ }).click();
		await expect(page).toHaveURL(/\/gallery$/);
		await page.goBack();

		await expect(page).toHaveURL(/\/gallery\/hot-wall$/);
		await expect(deepCard).toBeInViewport();
		expect(Math.abs((await screenTop(deepCard)) - leftAt)).toBeLessThan(40);
	});

	test('closing an artwork opened deep in the wall leaves the wall where it was', async ({
		page
	}) => {
		await page.goto('/gallery/hot-wall');
		const deepCard = await scrollUntilVisible(page, /Seeded Piece 30/);

		await deepCard.click();
		const detail = page.getByRole('dialog', { name: /Artwork details for Seeded Piece 30/ });
		await expect(detail).toBeVisible();
		await expect(page).toHaveURL(/\/artwork\/e2e-seeded-30$/);
		// Read once the postcard is up: Playwright's click scrolls the card into
		// view first, which is the test moving the page, not the visitor.
		const leftAt = await screenTop(deepCard);

		await page.goBack();

		await expect(detail).toBeHidden();
		await expect(page).toHaveURL(/\/gallery\/hot-wall$/);
		await expect(deepCard).toBeInViewport();
		expect(Math.abs((await screenTop(deepCard)) - leftAt)).toBeLessThan(40);
	});
});
