import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { publishArtworkThroughActions, resetDemoState } from './demo/e2e-helpers';

// The staff desk: a moderator is called in from their visitor pass, sees what
// was reported and why, and decides. Nothing is decided blind, and nothing is
// deleted on a single press.

const TITLE = 'Reported Piece';
const NOTE = 'there is a slur in the corner';

const signUp = async (
	request: APIRequestContext,
	baseURL: string | undefined,
	nickname: string
) => {
	const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
	await request.post('/?/signUp', { form: { nickname, password: 'password123' }, headers });
	await request.post('/?/saveAvatar', {
		form: {
			drawingDocument: JSON.stringify({
				background: '#f5f0e1',
				height: 340,
				kind: 'avatar',
				strokes: [
					{
						color: '#2d2420',
						points: [
							[100, 100],
							[240, 240]
						],
						size: 12
					}
				],
				version: 1,
				width: 340
			})
		},
		headers
	});
};

const setRole = async (
	request: APIRequestContext,
	nickname: string,
	role: 'admin' | 'moderator'
) => {
	const promoted = await request.post('/demo/test-support/role', { data: { nickname, role } });
	expect(promoted.ok()).toBe(true);
};

const report = async (
	browser: Browser,
	baseURL: string | undefined,
	artworkId: string,
	nickname: string,
	details?: string
) => {
	const reporter = await browser.newContext({ baseURL });
	await signUp(reporter.request, baseURL, nickname);
	const reported = await reporter.request.post(`/api/artworks/${artworkId}/reports`, {
		data: { details, reason: 'hate' },
		headers: { origin: baseURL ?? '' }
	});
	expect(reported.ok()).toBe(true);
	await reporter.close();
};

const moderator = async (
	page: Page,
	request: APIRequestContext,
	baseURL: string | undefined,
	nickname = 'on_duty'
) => {
	await signUp(page.request, baseURL, nickname);
	await setRole(request, nickname, 'moderator');
};

const theCase = (page: Page, text: string) => page.getByRole('article').filter({ hasText: text });

test.describe('The staff desk', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('calls a moderator in from their pass, and shows what was reported and why', async ({
		baseURL,
		browser,
		page,
		request
	}) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		await report(browser, baseURL, id, 'worried_one', NOTE);
		await moderator(page, request, baseURL);

		await page.goto('/');
		await page.getByRole('link', { name: 'Staff desk, 1 case waiting' }).click();

		await expect(page).toHaveURL(/\/admin$/);
		const reported = theCase(page, TITLE);
		await expect(reported).toContainText('Hate');
		await expect(reported).toContainText(NOTE);
		await expect(reported).toContainText('journey_artist');
		await expect
			.poll(() =>
				reported
					.getByRole('img', { name: TITLE })
					.evaluate((img: HTMLImageElement) => img.naturalWidth)
			)
			.toBeGreaterThan(1);
		await expect(reported.getByRole('link', { name: 'Open the postcard' })).toHaveAttribute(
			'href',
			`/artwork/${id}`
		);
	});

	test('leaves the rest of the pass to open the avatar editor', async ({
		baseURL,
		page,
		request
	}) => {
		await moderator(page, request, baseURL);

		await page.goto('/');
		await expect(page.getByRole('link', { name: 'Staff desk, 0 cases waiting' })).toBeVisible();
		await page
			.getByRole('button', { name: /Edit avatar for on_duty/ })
			.click({ position: { x: 30, y: 90 } });

		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole('dialog')).toBeVisible();
	});

	test('stays closed to an artist', async ({ baseURL, page }) => {
		await signUp(page.request, baseURL, 'just_an_artist');

		await page.goto('/');
		await expect(page.getByRole('button', { name: /Edit avatar for/ })).toBeVisible();
		await expect(page.getByRole('link', { name: /Staff desk/ })).toHaveCount(0);

		expect((await page.goto('/admin'))?.status()).toBe(403);
	});

	test('closes a case with nothing wrong and leaves the artwork on the wall', async ({
		baseURL,
		browser,
		page,
		request
	}) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		await report(browser, baseURL, id, 'worried_one');
		await moderator(page, request, baseURL);

		await page.goto('/admin');
		await theCase(page, TITLE).getByRole('button', { name: 'Keep' }).click();

		await expect(theCase(page, TITLE)).toHaveCount(0);
		await expect(page.getByText('All quiet')).toBeVisible();
		expect((await request.get(`/api/artworks/${id}`)).status()).toBe(200);
	});

	test('takes down a reported comment', async ({ baseURL, browser, page, request }) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		const posted = await request.post(`/api/artworks/${id}/comments`, {
			data: { body: 'a rude remark' },
			headers: { origin: baseURL ?? '' }
		});
		const { comment } = (await posted.json()) as { comment: { id: string } };
		const reporter = await browser.newContext({ baseURL });
		await signUp(reporter.request, baseURL, 'worried_one');
		const reported = await reporter.request.post(
			`/api/artworks/${id}/comments/${comment.id}/reports`,
			{ data: { reason: 'harassment' }, headers: { origin: baseURL ?? '' } }
		);
		expect(reported.ok()).toBe(true);
		await reporter.close();
		await moderator(page, request, baseURL);

		await page.goto('/admin');
		const theComment = theCase(page, 'a rude remark');
		await expect(theComment).toContainText('Harassment');
		await expect(theComment).toContainText(`On ${TITLE}`);
		await theComment.getByRole('button', { name: 'Hide' }).click();

		await expect(theCase(page, 'a rude remark')).toHaveCount(0);
	});

	test('offers to put back what three reports took down', async ({
		baseURL,
		browser,
		page,
		request
	}) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		for (const nickname of ['worried_one', 'worried_two', 'worried_three']) {
			await report(browser, baseURL, id, nickname);
		}
		await moderator(page, request, baseURL);

		await page.goto('/admin');
		const hidden = theCase(page, TITLE);
		await expect(hidden).toContainText('Hidden');
		await expect(hidden.getByRole('button', { name: 'Stay hidden' })).toBeVisible();
		await hidden.getByRole('button', { name: 'Put back' }).click();

		await expect(theCase(page, TITLE)).toHaveCount(0);
		const visitor = await browser.newContext({ baseURL });
		expect((await visitor.request.get(`/api/artworks/${id}`)).status()).toBe(200);
		await visitor.close();
	});

	test('asks twice before deleting', async ({ baseURL, browser, page, request }) => {
		const id = await publishArtworkThroughActions(request, baseURL, { title: TITLE });
		await report(browser, baseURL, id, 'worried_one');
		await moderator(page, request, baseURL);

		await page.goto('/admin');
		const reported = theCase(page, TITLE);
		await reported.getByRole('button', { name: 'Delete' }).click();

		await expect(reported).toBeVisible();
		expect((await request.get(`/api/artworks/${id}`)).status()).toBe(200);

		await reported.getByRole('button', { name: 'Press again' }).click();

		await expect(theCase(page, TITLE)).toHaveCount(0);
		await expect.poll(async () => (await request.get(`/api/artworks/${id}`)).status()).toBe(404);
	});

	test('shows a moderator the queue and nothing an admin keeps', async ({
		baseURL,
		page,
		request
	}) => {
		await moderator(page, request, baseURL);

		await page.goto('/admin');

		const tabs = page.getByRole('navigation', { name: 'Staff desk' });
		await expect(tabs.getByRole('button', { name: 'Queue' })).toBeVisible();
		await expect(tabs.getByRole('button', { name: 'People' })).toHaveCount(0);
		await expect(tabs.getByRole('button', { name: 'Words' })).toHaveCount(0);
	});

	test('lets an admin find an artist, and a ban needs a reason', async ({
		baseURL,
		page,
		request
	}) => {
		await signUp(request, baseURL, 'someone_rude');
		await signUp(page.request, baseURL, 'the_admin');
		await setRole(request, 'the_admin', 'admin');

		await page.goto('/admin');
		const tabs = page.getByRole('navigation', { name: 'Staff desk' });
		await tabs.getByRole('button', { name: 'People' }).click();

		await expect(page.getByText('2 artists')).toBeVisible();
		await page.getByRole('searchbox', { name: 'Find an artist by name' }).fill('someone');
		await expect(page.getByRole('button', { name: 'Open the_admin' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Open someone_rude' }).click();
		const ban = page.getByRole('button', { name: 'Ban artist' });
		await expect(ban).toBeDisabled();
		await page.getByRole('textbox', { name: 'Why? They can read this.' }).fill('spamming the wall');
		await ban.click();

		await expect(page.getByRole('button', { name: 'Lift the ban' })).toBeVisible();
		await page.getByRole('searchbox', { name: 'Find an artist by name' }).fill('');
		await page.getByRole('button', { name: 'Banned', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Open someone_rude' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Open the_admin' })).toHaveCount(0);
		await expect(page.getByText('1 banned')).toBeVisible();
	});

	test('keeps the words the museum will not take', async ({ baseURL, page, request }) => {
		await signUp(page.request, baseURL, 'the_admin');
		await setRole(request, 'the_admin', 'admin');

		await page.goto('/admin');
		await page
			.getByRole('navigation', { name: 'Staff desk' })
			.getByRole('button', { name: 'Words' })
			.click();
		await page.getByRole('textbox', { name: 'Comments: never allow' }).fill('forbiddenword');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page.getByText('Saved.')).toBeVisible();
		await page.reload();
		await page
			.getByRole('navigation', { name: 'Staff desk' })
			.getByRole('button', { name: 'Words' })
			.click();
		await expect(page.getByRole('textbox', { name: 'Comments: never allow' })).toHaveValue(
			'forbiddenword'
		);
	});
});
