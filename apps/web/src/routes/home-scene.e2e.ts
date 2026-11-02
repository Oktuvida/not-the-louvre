import { expect, test, type Page } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The studio behind the front door is the first thing an artist sees once in:
// the room is drawn at full strength, not faded behind a veil, on the studio's
// own warm backdrop, and its dressed surfaces compile on the GPU without a
// shader error.

/** The average colour of a small patch of the screen, as the visitor sees it. */
const colourAt = async (page: Page, x: number, y: number) => {
	const png = await page.screenshot({ clip: { height: 8, width: 8, x, y } });
	return page.evaluate(async (base64) => {
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
		const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext('2d')!;
		context.drawImage(bitmap, 0, 0);
		const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
		const sum = [0, 0, 0];
		for (let index = 0; index < data.length; index += 4) {
			for (let channel = 0; channel < 3; channel++) sum[channel] += data[index + channel];
		}
		return sum.map((total) => Math.round(total / (data.length / 4)));
	}, png.toString('base64'));
};

test.describe('the studio behind the front door', () => {
	test.beforeEach(async ({ baseURL, page, request }) => {
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
	});

	test('shows the room at full strength, its surfaces compiling cleanly', async ({ page }) => {
		const shaderErrors: string[] = [];
		page.on('console', (message) => {
			if (/shader error|WebGLProgram/i.test(message.text())) shaderErrors.push(message.text());
		});

		await page.goto('/');
		await page.getByRole('button', { name: 'Studio' }).waitFor();
		const room = page.locator('.home-entry-page canvas').first();
		await room.waitFor();

		// Every layer between the room and the page multiplies into what shows.
		await expect
			.poll(
				() =>
					room.evaluate((canvas) => {
						let opacity = 1;
						for (let node: Element | null = canvas; node; node = node.parentElement) {
							opacity *= Number(getComputedStyle(node).opacity);
						}
						return opacity;
					}),
				{ timeout: 15_000 }
			)
			.toBeCloseTo(1, 2);
		expect(shaderErrors).toEqual([]);
	});

	test('stands the room on the studio’s warm backdrop, not on white', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Studio' }).waitFor();
		const { height, width } = page.viewportSize()!;

		// The room sits in the middle of the screen, so its corners are backdrop.
		await expect
			.poll(
				async () => {
					const corners = await Promise.all(
						[
							[0, 0],
							[width - 8, 0],
							[0, height - 8],
							[width - 8, height - 8]
						].map(([x, y]) => colourAt(page, x, y))
					);
					return corners.map(([red, green, blue]) =>
						red - blue > 20 && Math.max(red, green, blue) < 240
							? 'warm'
							: `rgb(${red}, ${green}, ${blue})`
					);
				},
				{ timeout: 15_000 }
			)
			.toEqual(['warm', 'warm', 'warm', 'warm']);
	});
});
