import { expect, test } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// A new artist's last step in is drawing their avatar. The sheet it happens on
// fits the screen they are on: no scrolling to reach the canvas or the way in,
// the canvas square and big enough to draw a face on.

const SCREENS = [
	{ height: 800, width: 1280 },
	{ height: 900, width: 1440 },
	{ height: 571, width: 1000 },
	{ height: 1180, width: 820 },
	{ height: 844, width: 390 },
	{ height: 390, width: 844 }
];

test.describe('the avatar step on every screen', () => {
	for (const screen of SCREENS) {
		test(`fits ${screen.width}×${screen.height} without scrolling`, async ({
			baseURL,
			browser,
			request
		}) => {
			await resetDemoState(request);
			const context = await browser.newContext({ viewport: screen });
			const page = await context.newPage();
			await page.request.post('/?/signUp', {
				form: deterministicAuthUser,
				headers: { origin: baseURL ?? '', 'x-sveltekit-action': 'true' }
			});

			await page.goto('/');
			const sheet = page.getByRole('dialog', { name: 'Finish your avatar' });
			await expect(sheet).toBeVisible();
			const enter = sheet.getByRole('button', { name: 'Enter the gallery' });
			await expect(enter).toBeInViewport({ ratio: 1 });

			const fit = await page.evaluate(() => {
				const overlay = document.querySelector<HTMLElement>('[data-testid="auth-overlay"]')!;
				const canvas = document
					.querySelector('[data-testid="avatar-sketchpad-frame"]')!
					.getBoundingClientRect();
				return {
					canvas: {
						bottom: canvas.bottom,
						height: canvas.height,
						top: canvas.top,
						width: canvas.width
					},
					overlayOverflow: overlay.scrollHeight - overlay.clientHeight,
					pageOverflow: document.documentElement.scrollHeight - innerHeight
				};
			});
			expect(fit.overlayOverflow, 'the sheet scrolls').toBeLessThanOrEqual(1);
			expect(fit.pageOverflow, 'the page scrolls').toBeLessThanOrEqual(1);
			expect(Math.abs(fit.canvas.width - fit.canvas.height), 'the canvas is square').toBeLessThan(
				2
			);
			expect(fit.canvas.width, 'the canvas is big enough to draw on').toBeGreaterThanOrEqual(200);
			expect(fit.canvas.top).toBeGreaterThanOrEqual(0);
			expect(fit.canvas.bottom).toBeLessThanOrEqual(screen.height);
			await context.close();
		});
	}
});
