import { expect, test } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// A polaroid is one piece of paper: the card on the wall and the postcard it
// opens into are the same stock, the same colour and the same grain.

/** The paper a surface is printed on: its colour, and the grain laid over it. */
const paperOf = (element: Element) => {
	const style = getComputedStyle(element);
	return {
		backgroundColor: style.backgroundColor,
		backgroundImage: style.backgroundImage,
		backgroundSize: style.backgroundSize
	};
};

test('a polaroid opens into a postcard of the same paper', async ({ page, request }) => {
	await resetDemoState(request);
	const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
	expect(seeded.ok()).toBe(true);

	await page.goto('/gallery/hot-wall');
	const card = page
		.getByRole('button', { name: /Seeded Piece/ })
		.filter({ hasNotText: 'Hottest right now' })
		.first();
	// The card's paper is the button's first child: the polaroid itself.
	const closed = await card.locator(':scope > *').first().evaluate(paperOf);

	await card.click();
	const front = page.locator('.postcard-front');
	await expect(front).toBeVisible();
	const opened = await front.evaluate(paperOf);

	expect(opened.backgroundColor, 'the paper colour').toBe(closed.backgroundColor);
	expect(opened.backgroundImage, 'the grain').toContain(closed.backgroundImage);
	expect(opened.backgroundSize.split(/,\s*/)).toContain(closed.backgroundSize);
});
