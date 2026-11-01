import { expect, test } from '@playwright/test';
import { createEmptyDrawingDocument } from '../../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

test.describe('opening a gallery link', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	// A shared link or a reload is the slowest way in: if the artworks waited
	// for the page's JavaScript, the first image would start only after it ran.
	test('arrives with the artworks in the page and the first image asked for first', async ({
		baseURL,
		request
	}) => {
		const { nickname, password } = deterministicAuthUser;
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		await request.post('/?/signUp', { form: { nickname, password }, headers });

		const published = await request.post('/draw?/publish', {
			form: {
				drawingDocument: JSON.stringify({
					...createEmptyDrawingDocument('artwork'),
					strokes: [
						{
							color: '#2d2420',
							points: [
								[120, 120],
								[640, 640]
							],
							size: 12
						}
					]
				}),
				title: 'First Paint'
			},
			headers
		});
		expect(await published.json()).toMatchObject({ type: 'success' });

		const html = await (await request.get('/gallery/hot-wall')).text();

		const artworkImage = /<img[^>]*src="\/api\/artworks\/[^"]+\/media\?v=webp"[^>]*>/.exec(html);
		expect(artworkImage?.[0]).toContain('fetchpriority="high"');
		// The cream paper is the placeholder; inline preview images cost about
		// 2.7 KB per artwork, some 65 KB a room, before anything is visible.
		expect(html).not.toContain('data:image/png;base64');
	});

	// Rooms that size themselves to the screen do it before they are painted:
	// a room that starts at one size and settles at another shoves its button
	// out from under a visitor's thumb.
	test('the Mystery room does not jump as it loads on a phone', async ({ page, request }) => {
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 12 } });
		expect(seeded.ok()).toBe(true);
		await page.setViewportSize({ height: 844, width: 390 });
		await page.addInitScript(() => {
			const shifts = { total: 0 };
			(window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries() as unknown as {
					hadRecentInput: boolean;
					value: number;
				}[]) {
					if (!entry.hadRecentInput) shifts.total += entry.value;
				}
			}).observe({ buffered: true, type: 'layout-shift' });
		});

		await page.goto('/gallery/mystery');
		await expect(page.getByRole('button', { name: /spin/i })).toBeVisible();
		await page.waitForTimeout(1500);

		const shifted = await page.evaluate(
			() => (window as unknown as { __shifts: { total: number } }).__shifts.total
		);
		expect(shifted).toBeLessThan(0.01);
	});
});
