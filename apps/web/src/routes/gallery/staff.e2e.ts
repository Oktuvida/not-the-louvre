import { expect, test, type Page } from '@playwright/test';
import { createEmptyDrawingDocument } from '../../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

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

	test('are behind the title over the front door, for whoever tries it', async ({
		baseURL,
		page,
		request
	}) => {
		await resetDemoState(request);
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		await page.request.post('/?/signUp', { form: deterministicAuthUser, headers });
		await page.request.post('/?/saveAvatar', {
			form: {
				drawingDocument: JSON.stringify({
					...createEmptyDrawingDocument('avatar'),
					strokes: [
						{
							color: '#2d2420',
							points: [
								[100, 100],
								[300, 300]
							],
							size: 12
						}
					]
				})
			},
			headers
		});

		await page.goto('/');
		const title = page.getByRole('heading', { name: 'NOT THE LOUVRE' });
		await expect(title).toBeVisible();
		await title.getByRole('link').click();

		await expect(page).toHaveURL(/\/gallery\/staff$/);
		await expect(page.getByRole('heading', { name: 'Museum staff' })).toBeVisible();
	});

	// Outside, the title is behind the wall: pressing the window's cornice, over
	// where it lies, must not lead anywhere.
	test('are not behind anything a visitor outside cannot see', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Come In' }).waitFor();
		const title = page.getByRole('heading', { name: 'NOT THE LOUVRE' });
		const box = await title.boundingBox();
		if (!box) throw new Error('The title is not on the page');

		await expect(title.getByRole('link')).toHaveCount(0);
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await expect(page).not.toHaveURL(/\/gallery\/staff$/);
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
