import { expect, test } from '@playwright/test';
import {
	deterministicActorUser,
	openNicknameAuthDemo,
	publishArtworkThroughRealtimeDemo,
	resetDemoState,
	signUpThroughNicknameDemo
} from '../e2e-helpers';

test.beforeEach(async ({ request }) => {
	await resetDemoState(request);
});

test('shows vote score changes from another authenticated browser context without refresh', async ({
	browser,
	page
}) => {
	await openNicknameAuthDemo(page);
	await signUpThroughNicknameDemo(page);
	const trackedArtworkId = await publishArtworkThroughRealtimeDemo(page);

	await expect(page.getByText('Realtime subscription: subscribed')).toBeVisible();
	await expect(page.getByText(`Tracked artwork score: 0`)).toBeVisible();

	const actorContext = await browser.newContext();
	const actorPage = await actorContext.newPage();

	try {
		await openNicknameAuthDemo(actorPage);
		await signUpThroughNicknameDemo(actorPage, deterministicActorUser);
		await actorPage.goto(
			`/demo/artwork-realtime-votes?artworkId=${encodeURIComponent(trackedArtworkId)}`
		);

		await expect(actorPage.getByText(`Tracked artwork ID: ${trackedArtworkId}`)).toBeVisible();
		const upvoteResponse = actorPage.waitForResponse(
			(response) =>
				response.url().includes(`/api/artworks/${trackedArtworkId}/vote`) &&
				response.request().method() === 'POST' &&
				response.ok()
		);
		await actorPage.getByRole('button', { name: 'Upvote tracked artwork' }).click();
		await upvoteResponse;
		await expect(actorPage.getByText('Vote action requested: upvote')).toBeVisible();

		await expect
			.poll(async () => await page.getByText(/Tracked artwork score:/).textContent(), {
				timeout: 10000
			})
			.toContain('Tracked artwork score: 1');
		await expect
			.poll(async () => await page.locator('[aria-label="Realtime event log"]').textContent(), {
				timeout: 10000
			})
			.toContain('Vote event: up from realtime');

		const removeVoteResponse = actorPage.waitForResponse(
			(response) =>
				response.url().includes(`/api/artworks/${trackedArtworkId}/vote`) &&
				response.request().method() === 'DELETE' &&
				response.ok()
		);
		await actorPage.getByRole('button', { name: 'Remove vote' }).click();
		await removeVoteResponse;
		await expect(actorPage.getByText('Vote action requested: remove')).toBeVisible();

		await expect
			.poll(async () => await page.getByText(/Tracked artwork score:/).textContent(), {
				timeout: 10000
			})
			.toContain('Tracked artwork score: 0');
		await expect
			.poll(async () => await page.locator('[aria-label="Realtime event log"]').textContent(), {
				timeout: 10000
			})
			.toContain('Vote event: removed from realtime');
	} finally {
		await actorContext.close();
	}
});
