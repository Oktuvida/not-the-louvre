import { expect, test } from '@playwright/test';
import { createPngTestFile } from '../../lib/server/media/test-helpers';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

test.describe('publishing from the studio', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	// An artwork is its strokes: forks, the timelapse and every rendered image
	// come from them, so a picture with no strokes behind it has nothing to offer.
	test('an uploaded picture with no strokes behind it is not published', async ({
		baseURL,
		request
	}) => {
		const { nickname, password } = deterministicAuthUser;
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		const signUp = await request.post('/?/signUp', { form: { nickname, password }, headers });
		expect(await signUp.json()).toMatchObject({ type: 'success' });

		const picture = await createPngTestFile({ height: 768, width: 768 });
		const publish = await request.post('/draw?/publish', {
			headers,
			multipart: {
				media: {
					buffer: Buffer.from(await picture.arrayBuffer()),
					mimeType: 'image/png',
					name: 'photo.png'
				},
				title: 'Not a drawing'
			}
		});

		expect(await publish.json()).toMatchObject({ type: 'failure', status: 400 });
	});
});
