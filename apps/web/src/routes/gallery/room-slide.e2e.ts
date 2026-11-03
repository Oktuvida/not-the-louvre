import { expect, test, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// Moving between rooms, the next one slides in from the side its tab is on.
// The browser moves a picture of the room being left and only starts the
// slide once the next room is drawn: building that room inside the slide
// used to eat its first frames, so the rooms jumped instead of sliding.

/** How far across the next room starts its slide in, once the slide begins. */
const nextRoomStartsAt = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<number | null>((resolve) => {
				const deadline = performance.now() + 3_000;
				const look = () => {
					const slide = document
						.getAnimations()
						.find((animation) =>
							(animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith(
								'::view-transition-new'
							)
						);
					if (slide) {
						const [from] = (slide.effect as KeyframeEffect).getKeyframes();
						resolve(new DOMMatrixReadOnly(String(from?.transform ?? 'none')).m41);
					} else if (performance.now() > deadline) resolve(null);
					else requestAnimationFrame(look);
				};
				requestAnimationFrame(look);
			})
	);

/** Resolves once no slide is running any more. */
const slideIsOver = (page: Page) =>
	expect
		.poll(() =>
			page.evaluate(
				() =>
					document
						.getAnimations()
						.filter((animation) =>
							(animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith(
								'::view-transition'
							)
						).length
			)
		)
		.toBe(0);

test.describe('moving between rooms', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 12 } });
		expect(seeded.ok()).toBe(true);
	});

	test('slides the next room in from the side its tab is on', async ({ page }) => {
		await page.goto('/gallery/hot-wall');
		await expect(page.getByRole('button', { name: /Hottest right now/ })).toBeVisible();

		// The Mystery Room's tab is to the right of the Hot Wall's.
		let startsAt = nextRoomStartsAt(page);
		await page.getByRole('link', { name: /Mystery Room/ }).click();
		expect(await startsAt).toBeGreaterThan(0);
		await expect(page.getByTestId('mystery-room')).toBeVisible();
		await slideIsOver(page);

		// The Hall of Fame's is to the left.
		startsAt = nextRoomStartsAt(page);
		await page.getByRole('link', { name: /Hall of Fame/ }).click();
		expect(await startsAt).toBeLessThan(0);
	});

	test('takes the room it leaves off the stage at once', async ({ page }) => {
		await page.goto('/gallery/hot-wall');
		await expect(page.getByRole('button', { name: /Hottest right now/ })).toBeVisible();

		await page.getByRole('link', { name: /Hall of Fame/ }).click();
		await expect(page).toHaveURL(/\/gallery$/);

		// What slides away is a picture of it: there is one room on the stage.
		expect(await page.locator('.room-stage > *').count()).toBe(1);
	});
});
