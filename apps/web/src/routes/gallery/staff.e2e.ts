import { expect, test, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// Who keeps the museum: the wall ends at the velvet rope, and its label leads
// to the staff, by the names they go by, with their GitHub and Discord.

const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

// The photos are GitHub's own: the suite does not go out to fetch them.
const answerForGitHub = (page: Page) =>
	page.route('https://github.com/**', (route) =>
		route.fulfill({ body: PIXEL, contentType: 'image/png' })
	);

const plate = (page: Page, name: string) =>
	page.getByRole('complementary', { name: `${name}, museum staff` });

test.describe('the museum staff', () => {
	test.beforeEach(async ({ page }) => {
		await answerForGitHub(page);
	});

	test('are found where the wall ends', async ({ page, request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 3 } });
		expect(seeded.ok()).toBe(true);

		await page.goto('/gallery/wet-paint');
		await page.getByRole('link', { name: /meet the staff/i }).click();

		await expect(page).toHaveURL(/\/gallery\/staff$/);
		await expect(page).toHaveTitle(/Museum staff/);
		await expect(page.getByRole('heading', { name: 'Museum staff' })).toBeVisible();
		await expect(
			page.getByTestId('gallery-room-header').locator('nav [aria-current="page"]')
		).toHaveCount(0);
	});

	test('go by their own names, with their GitHub and Discord', async ({ page }) => {
		await page.goto('/gallery/staff');

		const hiThere = plate(page, 'HiThere');
		await expect(hiThere.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
			'href',
			'https://github.com/GH-Jaider'
		);
		await expect(hiThere.getByText('hi__there')).toBeVisible();
		await expect(hiThere.getByRole('img', { name: 'HiThere' })).toBeVisible();

		const oktuvida = plate(page, 'Oktuvida');
		await expect(oktuvida.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
			'href',
			'https://github.com/Oktuvida'
		);
		await expect(oktuvida.getByText('Discord: oktuvida')).toBeVisible();
	});

	test('fit a phone, both on the page and nothing wider than it', async ({ page }) => {
		await page.setViewportSize({ height: 844, width: 390 });
		await page.goto('/gallery/staff');

		await expect(plate(page, 'HiThere')).toBeInViewport({ ratio: 1 });
		await expect(plate(page, 'Oktuvida')).toBeVisible();
		const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
		expect(scrollWidth, 'the page never scrolls sideways').toBeLessThanOrEqual(390);
	});
});
