import { expect, test } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The studio behind the front door is the first thing an artist sees once in:
// the room is drawn at full strength, not faded behind a veil, and its dressed
// surfaces compile on the GPU without a shader error.

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
});
