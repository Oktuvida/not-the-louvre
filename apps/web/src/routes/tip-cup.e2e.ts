import { expect, test, type Locator, type Page } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The way to help keep the museum open stands beside the record player, in
// plain sight on every page a visitor walks through, with or without an
// account. Only the studio, where nothing should call for attention, goes
// without it, and it steps aside for a postcard as the record player does.

const cup = (page: Page) => page.getByRole('link', { name: /help us keep the museum open/i });

const boxOf = async (locator: Locator) => {
	const box = await locator.boundingBox();
	if (!box) throw new Error('Expected it on screen');
	return box;
};

test.describe('the Ko-fi cup', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 3 } });
		expect(seeded.ok()).toBe(true);
	});

	for (const path of [
		'/',
		'/gallery',
		'/gallery/wet-paint',
		'/gallery/mystery',
		'/gallery/staff'
	]) {
		test(`stands beside the record player on ${path}`, async ({ page }) => {
			await page.goto(path);

			await expect(cup(page)).toBeInViewport({ ratio: 1 });
			await expect(cup(page)).toHaveAttribute('href', 'https://ko-fi.com/hit_here');
			await expect(cup(page)).toHaveAttribute('target', '_blank');

			const box = await boxOf(cup(page));
			const player = await boxOf(page.getByRole('button', { name: 'Ambient music' }));
			const clear =
				box.y + box.height <= player.y ||
				player.y + player.height <= box.y ||
				box.x + box.width <= player.x ||
				player.x + player.width <= box.x;
			expect(clear, 'it stands clear of the record player').toBe(true);
		});
	}

	test('keeps out of the studio', async ({ baseURL, page }) => {
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		const signedUp = await page.request.post('/?/signUp', { form: deterministicAuthUser, headers });
		expect(signedUp.ok()).toBe(true);

		await page.goto('/draw');
		await expect(page.getByPlaceholder('Untitled genius')).toBeAttached();

		await expect(cup(page)).toHaveCount(0);
	});

	test('steps aside for a postcard', async ({ page }) => {
		await page.goto('/artwork/e2e-seeded-01');
		await expect(page.getByRole('dialog')).toBeVisible();

		await expect(cup(page)).toBeHidden();
	});

	test('is only the cup on a phone, a fingertip wide, and still says what it is', async ({
		page
	}) => {
		await page.setViewportSize({ height: 844, width: 390 });
		await page.goto('/gallery/wet-paint');

		await expect(cup(page)).toBeInViewport({ ratio: 1 });
		const box = await boxOf(cup(page));
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.width).toBeLessThanOrEqual(64);
		expect(box.height).toBeGreaterThanOrEqual(44);
	});
});
