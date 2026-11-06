import { expect, test, type Page } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

// A pen that slips off the canvas on a tablet drags across whatever lies
// beside it: the page's tagline, the supplies, the notes. In the studio none
// of that is text to pick up, so nothing turns blue under the pen, while the
// title stays a field the artist can type in and select.

const signIn = async (page: Page, baseURL: string | undefined) => {
	const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
	const signUp = await page.request.post('/?/signUp', { form: deterministicAuthUser, headers });
	expect(signUp.ok()).toBe(true);
};

const openStudio = async (page: Page) => {
	await page.goto('/draw');
	const cover = page.getByRole('button', { name: 'Open sketchbook' });
	const title = page.getByPlaceholder('Untitled genius');
	await expect(cover.or(title).first()).toBeVisible();
	if (await cover.isVisible()) await cover.click();
	await expect(title).toBeEnabled();
};

const centre = async (page: Page, text: string) => {
	const box = await page.getByText(text, { exact: false }).first().boundingBox();
	if (!box) throw new Error(`"${text}" is not on the page`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const selectedText = (page: Page) => page.evaluate(() => window.getSelection()?.toString() ?? '');

test.describe('the page around the canvas', () => {
	test.beforeEach(async ({ baseURL, page, request }) => {
		await resetDemoState(request);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.setViewportSize({ width: 1512, height: 860 });
		await signIn(page, baseURL);
	});

	test('selects nothing when a drag runs from the page across the supplies', async ({ page }) => {
		await openStudio(page);
		const from = await centre(page, 'U might get a very expensive frame');
		const to = await centre(page, 'Paints');

		await page.mouse.move(from.x - 120, from.y);
		await page.mouse.down();
		await page.mouse.move(to.x, to.y, { steps: 12 });
		await page.mouse.up();

		expect(await selectedText(page)).toBe('');
	});

	test('leaves the title a field to type in and select', async ({ page }) => {
		await openStudio(page);
		const title = page.getByPlaceholder('Untitled genius');

		await title.fill('Sunny house');
		await title.dblclick();

		expect(
			await title.evaluate((field: HTMLInputElement) =>
				field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)
			)
		).not.toBe('');
	});
});
