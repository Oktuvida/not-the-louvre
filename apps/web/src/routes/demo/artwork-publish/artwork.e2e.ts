import { expect, test } from '@playwright/test';
import {
	createDisguisedJpegUpload,
	createOversizedArtworkUpload,
	deterministicArtwork,
	openNicknameAuthDemo,
	publishArtworkThroughDemo,
	resetDemoState,
	signUpThroughNicknameDemo
} from '../e2e-helpers';
import { ARTWORK_MEDIA_MAX_BYTES } from '../../../lib/server/artwork/config';

test.beforeEach(async ({ request }) => {
	await resetDemoState(request);
});

test('publishes artwork through the minimal authenticated demo and renders the read-back state', async ({
	page
}) => {
	await openNicknameAuthDemo(page);
	await signUpThroughNicknameDemo(page);
	await publishArtworkThroughDemo(page, { title: deterministicArtwork.title });

	await expect(page.getByText('Published artwork outcome')).toBeVisible();
	await expect(
		page.getByText(`Published artwork title: ${deterministicArtwork.title}`)
	).toBeVisible();
	await expect(page.getByText('Published artwork author: journey_artist')).toBeVisible();
	await expect(page.getByText(`Artwork card title: ${deterministicArtwork.title}`)).toBeVisible();

	const mediaUrlText = await page.getByText(/Published artwork media URL:/).textContent();
	const mediaUrl = mediaUrlText?.split(': ').at(1)?.trim();
	if (!mediaUrl) {
		throw new Error('Published artwork media URL was not rendered');
	}

	const mediaResponse = await page.evaluate(async (url) => {
		const response = await fetch(url);
		const bytes = await response.arrayBuffer();

		return {
			byteLength: bytes.byteLength,
			cacheControl: response.headers.get('cache-control'),
			contentType: response.headers.get('content-type'),
			ok: response.ok,
			status: response.status
		};
	}, mediaUrl);

	expect(mediaResponse).toMatchObject({
		cacheControl: 'public, max-age=31536000, immutable',
		contentType: 'image/avif',
		ok: true,
		status: 200
	});
	expect(mediaResponse.byteLength).toBeGreaterThan(0);
});

test('rejects a jpg payload disguised as .avif and keeps it out of the visible feed', async ({
	page
}) => {
	await openNicknameAuthDemo(page);
	await signUpThroughNicknameDemo(page);

	await page.goto('/demo/artwork-publish');
	await expect(page.getByText('Artwork demo state: authenticated')).toBeVisible();
	await page.getByLabel('Artwork title').fill('Disguised payload');
	await page.getByLabel('Artwork media').setInputFiles(await createDisguisedJpegUpload());
	await page.getByRole('button', { name: 'Publish artwork' }).click();

	await expect(
		page.getByText('Artwork media must decode as a single still AVIF image')
	).toBeVisible();
	await expect(page.getByText('Published artwork outcome')).not.toBeVisible();
	await expect(page.getByText('No artworks published yet.')).toBeVisible();
});

test('rejects artwork uploads larger than the allowed size and keeps them out of the feed', async ({
	page
}) => {
	await openNicknameAuthDemo(page);
	await signUpThroughNicknameDemo(page);

	await page.goto('/demo/artwork-publish');
	await expect(page.getByText('Artwork demo state: authenticated')).toBeVisible();
	await page.getByLabel('Artwork title').fill('Oversized payload');
	await page.getByLabel('Artwork media').setInputFiles(createOversizedArtworkUpload());
	await page.getByRole('button', { name: 'Publish artwork' }).click();

	await expect(
		page.getByText(`Artwork media must be ${ARTWORK_MEDIA_MAX_BYTES} bytes or smaller`)
	).toBeVisible();
	await expect(page.getByText('Published artwork outcome')).not.toBeVisible();
	await expect(page.getByText('No artworks published yet.')).toBeVisible();
});
