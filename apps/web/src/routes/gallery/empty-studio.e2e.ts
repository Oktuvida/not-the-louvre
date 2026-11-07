import { expect, test } from '@playwright/test';
import { createEmptyDrawingDocument } from '../../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

// An artist whose studio is still empty is told how to fill it, and given the
// way there, not just the news that it is empty.

test('an artist with an empty studio is shown the way to draw', async ({
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

	await page.goto('/gallery/your-studio');
	await expect(page.getByText('You have not published any artworks yet.')).toBeVisible();

	const draw = page
		.getByTestId('gallery-room-content')
		.getByRole('link', { name: /draw your first piece/i });
	await expect(draw).toBeVisible();
	await expect(draw).toHaveAttribute('href', '/draw');
});
