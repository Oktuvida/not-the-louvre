import { expect, test } from '@playwright/test';
import {
	deterministicArtwork,
	openNicknameAuthDemo,
	publishArtworkThroughDemo,
	resetDemoState,
	signUpThroughNicknameDemo
} from '../e2e-helpers';

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
});
