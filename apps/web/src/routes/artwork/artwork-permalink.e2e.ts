import { expect, test } from '@playwright/test';
import { publishArtworkThroughActions, resetDemoState } from '../demo/e2e-helpers';

const ogContent = (html: string, property: string) =>
	new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(html)?.[1];

test.describe('artwork permalinks', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('a shared artwork link opens the artwork with its own preview card', async ({
		baseURL,
		request
	}) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: 'Permalink Piece' });

		const response = await request.get(`/artwork/${id}`);
		const html = await response.text();

		expect(response.status()).toBe(200);
		expect(html).toContain('Permalink Piece');
		expect(ogContent(html, 'og:title')).toBe('Permalink Piece · Not the Louvre');
		expect(ogContent(html, 'og:image')).toBe(
			`https://not-the-louvre.art/api/artworks/${id}/media?v=webp`
		);
	});

	test('a sensitive artwork never shows itself in a link preview', async ({ baseURL, request }) => {
		const id = await publishArtworkThroughActions(request, baseURL, {
			isNsfw: true,
			title: 'Sensitive Piece'
		});

		const html = await (await request.get(`/artwork/${id}`)).text();

		expect(ogContent(html, 'og:image')).toBe('https://not-the-louvre.art/og-cover.png');
	});

	test('a link to an artwork that is not there is a not found', async ({ request }) => {
		const response = await request.get('/artwork/no-such-artwork');

		expect(response.status()).toBe(404);
	});

	test('opening an artwork in the gallery puts its own address in the bar', async ({
		baseURL,
		page
	}) => {
		const id = await publishArtworkThroughActions(page.request, baseURL, {
			title: 'Address Piece'
		});

		await page.goto('/gallery/your-studio');
		await page.getByRole('button', { name: /Address Piece/ }).click();
		await expect(
			page.getByRole('dialog', { name: /Artwork details for Address Piece/ })
		).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`/artwork/${id}$`));

		await page.goBack();
		await expect(page).toHaveURL(/\/gallery\/your-studio$/);
		await expect(page.getByRole('dialog', { name: /Artwork details/ })).toBeHidden();
	});
});
