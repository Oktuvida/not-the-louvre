import { expect, test } from '@playwright/test';
import {
	deterministicAuthUser,
	publishArtworkThroughActions,
	resetDemoState
} from './demo/e2e-helpers';

// Signed-out visitors all see the same pages, so a wave of them shares one copy
// for a moment instead of each reading the database. Whoever is signed in is
// never held back, and a moderator's hide never waits for the copy to run out.

const COMMENT = 'What a tired sun';
const TITLE = 'Shared Piece';

// How long a page is shared, less a margin for a slow machine.
const SHARED_WINDOW_MS = 25_000;

test.describe('Pages signed-out visitors share', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('the front door comes back whole from the shared copy', async ({ page, request }) => {
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 3 } });
		expect(seeded.ok()).toBe(true);

		await page.goto('/');
		const champion = page.getByTestId('home-preview-frame-1').locator('img').first();
		const title = await champion.getAttribute('alt');

		await page.reload();

		await expect(champion).toHaveAttribute('alt', title ?? '');
	});

	test('an artwork page is shared, but never held back from an artist', async ({
		baseURL,
		page,
		request
	}) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		const visit = async () => (await page.request.get(`/artwork/${id}`)).text();

		expect(await visit()).toContain(TITLE);
		const sharedSince = Date.now();

		const posted = await request.post(`/api/artworks/${id}/comments`, {
			data: { body: COMMENT },
			headers: { origin: baseURL ?? '' }
		});
		expect(posted.ok()).toBe(true);
		expect(await (await request.get(`/artwork/${id}`)).text()).toContain(COMMENT);

		const next = await visit();
		test.skip(Date.now() - sharedSince > SHARED_WINDOW_MS, 'the machine stalled past the window');
		expect(next).toContain(TITLE);
		expect(next).not.toContain(COMMENT);
	});

	test('a hidden artwork leaves the shared pages at once', async ({ baseURL, page, request }) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		const promoted = await request.post('/demo/test-support/role', {
			data: { nickname: deterministicAuthUser.nickname, role: 'moderator' }
		});
		expect(promoted.ok()).toBe(true);

		expect((await page.request.get(`/artwork/${id}`)).status()).toBe(200);
		expect(await (await page.request.get('/gallery/wet-paint')).text()).toContain(TITLE);
		const sharedSince = Date.now();

		const hidden = await request.patch(`/api/artworks/${id}/moderation`, {
			data: { action: 'hide' },
			headers: { origin: baseURL ?? '' }
		});
		expect(hidden.ok()).toBe(true);

		// The copies are dropped just after the response, well inside the window.
		const gone = { timeout: 5_000 };
		await expect
			.poll(async () => (await page.request.get(`/artwork/${id}`)).status(), gone)
			.toBe(404);
		await expect
			.poll(async () => (await page.request.get('/gallery/wet-paint')).text(), gone)
			.not.toContain(TITLE);
		expect(Date.now() - sharedSince).toBeLessThan(SHARED_WINDOW_MS);
	});

	test('a hidden comment leaves the shared page at once', async ({ baseURL, page, request }) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		const promoted = await request.post('/demo/test-support/role', {
			data: { nickname: deterministicAuthUser.nickname, role: 'moderator' }
		});
		expect(promoted.ok()).toBe(true);
		const headers = { origin: baseURL ?? '' };
		const posted = await request.post(`/api/artworks/${id}/comments`, {
			data: { body: COMMENT },
			headers
		});
		const { comment } = (await posted.json()) as { comment: { id: string } };
		const visit = async () => (await page.request.get(`/artwork/${id}`)).text();

		expect(await visit()).toContain(COMMENT);
		const sharedSince = Date.now();

		const hidden = await request.patch(`/api/artworks/${id}/comments/${comment.id}/moderation`, {
			data: { action: 'hide' },
			headers
		});
		expect(hidden.ok()).toBe(true);

		await expect.poll(visit, { timeout: 5_000 }).not.toContain(COMMENT);
		expect(Date.now() - sharedSince).toBeLessThan(SHARED_WINDOW_MS);
	});
});
