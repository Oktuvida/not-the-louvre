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

	test('an artwork opened from a shared link shows votes as they happen', async ({
		baseURL,
		page,
		request
	}) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: 'Live Piece' });
		// A vote is only passed on to sockets that are already open.
		await page.addInitScript(() => {
			const NativeWebSocket = window.WebSocket;
			window.WebSocket = class extends NativeWebSocket {
				constructor(...args: ConstructorParameters<typeof WebSocket>) {
					super(...args);
					this.addEventListener('open', () => document.body.setAttribute('data-live', 'open'));
				}
			};
		});

		await page.goto(`/artwork/${id}`);
		const score = (value: number) =>
			page
				.getByRole('dialog', { name: /Artwork details for Live Piece/ })
				.getByText(new RegExp(`⭐\\s*${value}$`))
				.filter({ visible: true })
				.first();
		await expect(score(0)).toBeVisible();
		await expect(page.locator('body[data-live="open"]')).toHaveCount(1);

		const vote = await request.post(`/api/artworks/${id}/vote`, {
			data: { value: 'up' },
			headers: { origin: baseURL ?? '' }
		});
		expect(vote.status(), await vote.text()).toBe(200);

		await expect(score(1)).toBeVisible();
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
