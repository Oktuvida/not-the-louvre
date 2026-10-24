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
});
