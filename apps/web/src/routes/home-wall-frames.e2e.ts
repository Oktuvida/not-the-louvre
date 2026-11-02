import { expect, test } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The gallery's top three hang on the studio's right wall, each tilted a little
// on its nail. Each frame is drawn the size of its place on the wall, so the
// artwork fills the frame's opening, centred, however the frame is tilted.

for (const viewport of [
	{ height: 800, width: 1280 },
	{ height: 1080, width: 1920 }
]) {
	test(`the home wall's frames hold their artworks centred at ${viewport.width}×${viewport.height}`, async ({
		baseURL,
		browser,
		request
	}) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
		expect(seeded.ok()).toBe(true);

		const context = await browser.newContext({ viewport });
		const page = await context.newPage();
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
		const frames = page.getByTestId(/^home-preview-frame-/);
		await expect(frames).toHaveCount(3);

		// In layout coordinates, which the tilt does not move: the drawn frame
		// covers exactly its place, and the artwork sits in the middle of it.
		await expect
			.poll(() =>
				frames.evaluateAll((hosts) =>
					(hosts as HTMLElement[]).map((host) => {
						const frame = host.querySelector('canvas') as HTMLCanvasElement;
						const artwork = host.querySelector('img')!.parentElement!.parentElement as HTMLElement;
						const off = (a: number, b: number) => Math.abs(a - b) <= 1.5;
						return (
							off(frame.offsetWidth, host.offsetWidth) &&
							off(frame.offsetHeight, host.offsetHeight) &&
							off(artwork.offsetLeft + artwork.offsetWidth / 2, host.offsetWidth / 2) &&
							off(artwork.offsetTop + artwork.offsetHeight / 2, host.offsetHeight / 2)
						);
					})
				)
			)
			.toEqual([true, true, true]);
		await context.close();
	});
}
