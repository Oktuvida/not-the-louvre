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

/** The average brightness of a picture, 0 to 255. */
const brightness = (page: Page, png: Buffer) =>
	page.evaluate(async (base64) => {
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
		const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext('2d')!;
		context.drawImage(bitmap, 0, 0);
		const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
		let sum = 0;
		for (let index = 0; index < data.length; index += 4) {
			sum += (data[index]! + data[index + 1]! + data[index + 2]!) / 3;
		}
		return sum / (data.length / 4);
	}, png.toString('base64'));

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

	// Safari takes a slide down a frame or two before the page lets go of the
	// name that marks the room for it. For those frames the room is still
	// marked, and it used to sink under the room's light and drifting dust,
	// so every artwork flickered dull as the slide ended.
	test('looks the same while it is marked for a slide', async ({ page }) => {
		await page.goto('/gallery/hot-wall');
		const lead = page.getByRole('button', { name: /Hottest right now/ });
		await expect(lead).toBeVisible();
		await page.evaluate(() => document.fonts.ready);

		const unmarked = await brightness(page, await lead.screenshot());
		await page.evaluate(() => {
			document.documentElement.dataset.roomSlide = 'next';
		});
		const marked = await brightness(page, await lead.screenshot());

		expect(Math.abs(marked - unmarked)).toBeLessThan(2);
	});

	// The slide holds the navigation until the browser has its picture of the
	// room being left, which on a heavy room in Safari takes a while. Going
	// back inside that moment used to apply the abandoned navigation over the
	// one that replaced it: the Hot Wall's address over the Hall of Fame.
	test('lets the visitor turn back before the slide has started', async ({ page, request }) => {
		// A wall deep enough to scroll into.
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 40 } });
		expect(seeded.ok()).toBe(true);
		await page.addInitScript(() => {
			// The browser takes its time over the picture.
			const start = document.startViewTransition.bind(document);
			document.startViewTransition = ((update: () => Promise<void>) =>
				start(async () => {
					await new Promise((resolve) => setTimeout(resolve, 300));
					await update();
				})) as typeof document.startViewTransition;
		});
		await page.goto('/gallery/hot-wall');
		const deepCard = page.getByRole('button', { name: /Seeded Piece 30/ });
		await expect(async () => {
			await page.mouse.wheel(0, 400);
			await expect(deepCard).toBeInViewport({ timeout: 500 });
		}).toPass({ timeout: 20_000 });
		const leftAt = (await deepCard.boundingBox())!.y;

		await page.getByRole('link', { name: /Hall of Fame/ }).click();
		await expect(page).toHaveURL(/\/gallery$/);
		await page.goBack();

		await expect(page).toHaveURL(/\/gallery\/hot-wall$/);
		await expect(page.getByTestId('hot-wall-room')).toBeVisible();
		await expect(page.getByTestId('podium-artwork-1')).toHaveCount(0);
		await expect(deepCard).toBeInViewport();
		expect(Math.abs((await deepCard.boundingBox())!.y - leftAt)).toBeLessThan(40);
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
