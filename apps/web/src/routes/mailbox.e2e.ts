import {
	expect,
	test,
	type APIRequestContext,
	type Browser,
	type Locator,
	type Page
} from '@playwright/test';
import { resetDemoState } from './demo/e2e-helpers';

// The mailbox stands on the Gallery button. An artist with no ideas opens it,
// takes a slip somebody left and draws it; an artist who wants to see something
// drawn leaves a slip of their own. The drawing's postcard keeps the slip beside
// it, and the polaroids on the walls stay as they are.

const WISH = 'a cat reading the newspaper on the bus';

const signUpArtist = async (
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

/** Another artist, in a browser of their own, who has slips to leave. */
const leaveSlips = async (
	browser: Browser,
	baseURL: string | undefined,
	nickname: string,
	...texts: string[]
) => {
	const context = await browser.newContext({ baseURL });
	await signUpArtist(context.request, baseURL, nickname);
	const ids: string[] = [];
	for (const text of texts) {
		const left = await context.request.post('/api/wishes', {
			data: { text },
			headers: { origin: baseURL ?? '' }
		});
		expect(left.status()).toBe(201);
		ids.push(((await left.json()) as { wish: { id: string } }).wish.id);
	}
	await context.close();
	return ids;
};

const mailboxOn = (page: Page) => page.getByRole('button', { name: 'The Mailbox' });
const openedBox = (page: Page) => page.getByRole('dialog', { name: 'The Mailbox' });
const gallery = (page: Page) => page.getByRole('button', { name: 'GALLERY', exact: true });
const slipInStudio = (page: Page) => page.getByRole('complementary', { name: 'Commission' });

const boxOf = async (locator: Locator) => {
	const box = await locator.boundingBox();
	if (!box) throw new Error('Expected it on screen');
	return box;
};

test.describe('the mailbox', () => {
	test.beforeEach(async ({ page, request }) => {
		await resetDemoState(request);
		await page.emulateMedia({ reducedMotion: 'reduce' });
	});

	test('an artist out of ideas draws a slip, and the postcard keeps it beside the drawing', async ({
		baseURL,
		browser,
		page
	}) => {
		await leaveSlips(browser, baseURL, 'asker_artist', WISH);
		await signUpArtist(page.request, baseURL, 'idle_artist');

		await page.goto('/');
		await mailboxOn(page).click();
		await openedBox(page)
			.getByRole('button', { name: new RegExp(`Draw this: ${WISH}`) })
			.click();

		await expect(page).toHaveURL(/\/draw\?wish=/);
		await expect(slipInStudio(page)).toContainText(WISH);
		await expect(slipInStudio(page)).toContainText('left by asker_artist');

		// Still there for the artist who comes back to the page tomorrow.
		await page.goto('/draw');
		await expect(slipInStudio(page)).toContainText(WISH);

		await page.getByPlaceholder('Untitled genius').fill('Cat on the 42');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		// Drawn, so the next drawing starts free of it.
		await expect(slipInStudio(page)).toBeHidden();

		await page.goto('/gallery/wet-paint');
		const wall = page.getByTestId('wet-paint-room');
		await expect(wall.getByRole('button').first()).toContainText('Cat on the 42');
		await expect(wall, 'the polaroid on the wall stays as it is').not.toContainText(WISH);

		await wall.getByRole('button').first().click();
		const postcard = page.getByRole('dialog');
		const slip = postcard.getByRole('complementary', { name: 'Drawn for a slip' });
		await expect(slip).toContainText(WISH);
		await expect(slip).toContainText('left by asker_artist');

		const drawing = await boxOf(postcard.getByRole('img', { name: 'Cat on the 42' }));
		const beside = await boxOf(slip);
		expect(beside.x + beside.width, 'the slip sticks out from behind the card').toBeGreaterThan(
			drawing.x + drawing.width + 100
		);
		const onTop = await page.evaluate(
			([x, y]) => document.elementFromPoint(x, y)?.closest('aside') ?? null,
			[drawing.x + drawing.width - 2, beside.y + beside.height / 2]
		);
		expect(onTop, 'and nothing of it lies on the drawing').toBeNull();
	});

	for (const [width, height, name] of [
		[1512, 860, 'a laptop'],
		[1180, 820, 'a tablet on its side'],
		[820, 1180, 'an upright tablet'],
		[390, 844, 'a phone']
	] as const) {
		test(`the slip leaves the studio's notes and tools alone on ${name}`, async ({
			baseURL,
			browser,
			page
		}) => {
			await page.setViewportSize({ height, width });
			const [id] = await leaveSlips(browser, baseURL, 'asker_artist', WISH);
			await signUpArtist(page.request, baseURL, 'idle_artist');

			await page.goto(`/draw?wish=${id}`);
			await expect(slipInStudio(page)).toBeVisible();

			const slip = await boxOf(slipInStudio(page));
			const title = await boxOf(page.getByLabel('Title your masterpiece'));
			const clear = slip.y + slip.height <= title.y || title.y + title.height <= slip.y;
			expect(clear, 'it does not lie on the title').toBe(true);

			const publish = page.getByRole('button', { name: 'Publish' });
			await publish.scrollIntoViewIfNeeded();
			await expect(publish).toBeInViewport({ ratio: 1 });
		});
	}

	test('a slip goes back in the box when the artist changes their mind', async ({
		baseURL,
		browser,
		page
	}) => {
		const [id] = await leaveSlips(browser, baseURL, 'asker_artist', WISH);
		await signUpArtist(page.request, baseURL, 'idle_artist');

		await page.goto(`/draw?wish=${id}`);
		await slipInStudio(page).getByRole('button', { name: 'Put it back' }).click();

		await expect(slipInStudio(page)).toBeHidden();
		await expect(page).not.toHaveURL(/wish=/);

		await page.getByPlaceholder('Untitled genius').fill('My Own Idea');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/wet-paint');
		await page.getByTestId('wet-paint-room').getByRole('button').first().click();
		await expect(page.getByRole('dialog')).toContainText('My Own Idea');
		await expect(
			page.getByRole('dialog').getByRole('complementary', { name: 'Drawn for a slip' })
		).toBeHidden();
	});

	test('a slip that is gone leaves the studio as it was', async ({ baseURL, page }) => {
		await signUpArtist(page.request, baseURL, 'idle_artist');

		await page.goto('/draw?wish=nobody-left-this');

		await expect(page.getByText('Tap the cover to begin')).toBeVisible();
		await expect(slipInStudio(page)).toBeHidden();
	});

	test('an artist leaves a slip for somebody else to draw', async ({ baseURL, browser, page }) => {
		await signUpArtist(page.request, baseURL, 'asker_artist');

		await page.goto('/');
		await mailboxOn(page).click();
		const box = openedBox(page);
		await expect(box).toContainText('No slips from other artists yet');

		await box.getByLabel('or leave one').fill(WISH);
		await expect(box).toContainText(`${WISH.length} / 80`);
		await box.getByRole('button', { name: 'Into the box' }).click();

		await expect(box).toContainText('In the box');
		await expect(box.getByLabel('or leave one')).toHaveValue('');
		await expect(
			box.getByRole('button', { name: new RegExp(WISH) }),
			'nobody is handed their own slip'
		).toHaveCount(0);

		const someoneElse = await browser.newContext({ baseURL });
		await signUpArtist(someoneElse.request, baseURL, 'idle_artist');
		const slips = (await (await someoneElse.request.get('/api/wishes')).json()) as unknown;
		await someoneElse.close();
		expect(slips).toMatchObject({ wishes: [{ author: 'asker_artist', text: WISH }] });
	});

	test('a rude slip stays out of the box, and the artist is told why', async ({
		baseURL,
		page
	}) => {
		await signUpArtist(page.request, baseURL, 'asker_artist');

		await page.goto('/');
		await mailboxOn(page).click();
		const box = openedBox(page);
		await box.getByLabel('or leave one').fill('shit');
		await box.getByRole('button', { name: 'Into the box' }).click();

		const field = box.getByLabel('or leave one');
		await expect(field).toHaveAttribute('aria-invalid', 'true');
		await expect(field).toHaveAccessibleDescription(/.+/);
		await expect(field, 'what they wrote is not lost').toHaveValue('shit');
		expect(await (await page.request.get('/api/wishes')).json()).toEqual({ wishes: [] });
	});

	test('three slips at a time, and others on request', async ({ baseURL, browser, page }) => {
		const texts = ['a very tired sun', 'two pigeons in love', 'a castle made of toast'];
		const others = ['a shark at the dentist', 'a robot learning to knit', 'a snail winning a race'];
		await leaveSlips(browser, baseURL, 'asker_artist', ...texts);
		await leaveSlips(browser, baseURL, 'other_asker', ...others);
		await signUpArtist(page.request, baseURL, 'idle_artist');

		await page.goto('/');
		await mailboxOn(page).click();
		const slips = openedBox(page)
			.getByRole('list', { name: 'Slips' })
			.getByRole('button', { name: /^Draw this/ });
		await expect(slips).toHaveCount(3);
		const first = await slips.allTextContents();

		await openedBox(page).getByRole('button', { name: 'show me others' }).click();

		await expect.poll(() => slips.allTextContents()).not.toEqual(first);
		const second = await slips.allTextContents();
		expect(second.filter((slip) => first.includes(slip))).toEqual([]);
	});

	test('a slip three artists report leaves the box, and its reporter stops seeing it at once', async ({
		baseURL,
		browser,
		page
	}) => {
		const [id] = await leaveSlips(browser, baseURL, 'asker_artist', WISH);
		await signUpArtist(page.request, baseURL, 'first_reporter');

		await page.goto('/');
		await mailboxOn(page).click();
		const box = openedBox(page);
		await box.getByRole('button', { name: new RegExp(`Report this slip: ${WISH}`) }).click();
		await box.getByRole('button', { exact: true, name: 'Hate' }).click();

		await expect(box.getByRole('status')).toContainText('Thanks');
		await expect(box.getByRole('button', { name: new RegExp(`Draw this: ${WISH}`) })).toHaveCount(
			0
		);

		for (const nickname of ['second_reporter', 'third_reporter']) {
			const context = await browser.newContext({ baseURL });
			await signUpArtist(context.request, baseURL, nickname);
			const report = await context.request.post(`/api/wishes/${id}/reports`, {
				data: { reason: 'hate' },
				headers: { origin: baseURL ?? '' }
			});
			expect(report.status()).toBe(201);
			await context.close();
		}

		const stranger = await browser.newContext({ baseURL });
		await signUpArtist(stranger.request, baseURL, 'late_artist');
		const left = (await (await stranger.request.get('/api/wishes')).json()) as unknown;
		await stranger.close();
		expect(left).toEqual({ wishes: [] });
	});

	test('a slip can be reported from the postcard it hangs beside', async ({
		baseURL,
		browser,
		page
	}) => {
		const [id] = await leaveSlips(browser, baseURL, 'asker_artist', WISH);
		await signUpArtist(page.request, baseURL, 'idle_artist');
		await page.goto(`/draw?wish=${id}`);
		await page.getByPlaceholder('Untitled genius').fill('Cat on the 42');
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByText(/Artwork published as/)).toBeVisible();

		await page.goto('/gallery/wet-paint');
		await page.getByTestId('wet-paint-room').getByRole('button').first().click();
		const slip = page.getByRole('dialog').getByRole('complementary', { name: 'Drawn for a slip' });
		await slip.getByRole('button', { name: /Report this slip/ }).click();
		await slip.getByRole('button', { exact: true, name: 'Spam' }).click();

		await expect(slip.getByRole('status')).toContainText('Thanks');
	});

	test('a moderator takes a reported slip down from the ops page', async ({
		baseURL,
		browser,
		page,
		request
	}) => {
		const [id] = await leaveSlips(browser, baseURL, 'asker_artist', WISH);
		const reporter = await browser.newContext({ baseURL });
		await signUpArtist(reporter.request, baseURL, 'first_reporter');
		await reporter.request.post(`/api/wishes/${id}/reports`, {
			data: { reason: 'hate' },
			headers: { origin: baseURL ?? '' }
		});
		await reporter.close();

		await signUpArtist(page.request, baseURL, 'on_duty');
		const promoted = await request.post('/demo/test-support/role', {
			data: { nickname: 'on_duty', role: 'moderator' }
		});
		expect(promoted.ok()).toBe(true);

		await page.goto('/admin');
		const slipCase = page.getByRole('article').filter({ hasText: WISH });
		await expect(slipCase).toContainText('Slip case');
		await expect(slipCase).toContainText('asker_artist');

		await slipCase.getByRole('button', { name: 'Delete slip' }).click();

		await expect(page.getByRole('article').filter({ hasText: WISH })).toHaveCount(0);
		expect(await (await page.request.get('/api/wishes')).json()).toEqual({ wishes: [] });
	});

	test('closes back to the room', async ({ baseURL, page }) => {
		await signUpArtist(page.request, baseURL, 'idle_artist');

		await page.goto('/');
		await mailboxOn(page).click();
		await openedBox(page).getByRole('button', { name: 'Back to the room' }).click();
		await expect(openedBox(page)).toBeHidden();

		await mailboxOn(page).click();
		await openedBox(page).press('Escape');
		await expect(openedBox(page)).toBeHidden();
		await expect(mailboxOn(page)).toBeFocused();
	});

	test('stands only where an artist can use it', async ({ page }) => {
		await page.goto('/');

		await expect(gallery(page).or(page.getByRole('link', { name: 'GALLERY' }))).toBeVisible();
		await expect(mailboxOn(page)).toHaveCount(0);
	});

	for (const [width, height, name] of [
		[1512, 860, 'a laptop'],
		[1280, 800, 'a small laptop'],
		[820, 1180, 'an upright tablet'],
		[390, 844, 'a phone'],
		[375, 667, 'a small phone'],
		[844, 390, 'a phone on its side']
	] as const) {
		test(`stands on Gallery on ${name}, its post behind the sticker`, async ({ baseURL, page }) => {
			await page.setViewportSize({ height, width });
			await signUpArtist(page.request, baseURL, 'idle_artist');
			await page.goto('/');

			await expect(mailboxOn(page)).toBeInViewport({ ratio: 1 });
			const box = await boxOf(mailboxOn(page));
			const sticker = await boxOf(gallery(page));
			expect(box.y + box.height, 'the post reaches the sticker').toBeGreaterThan(sticker.y);

			const onTop = await page.evaluate(
				([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.trim(),
				[box.x + box.width / 2, sticker.y + 6]
			);
			expect(onTop, 'Gallery keeps all of its face').toMatch(/GALLERY/i);

			const studio = await boxOf(page.getByRole('button', { exact: true, name: 'Studio' }));
			const clearOfStudio =
				box.x + box.width <= studio.x ||
				studio.x + studio.width <= box.x ||
				box.y + box.height <= studio.y ||
				studio.y + studio.height <= box.y;
			expect(clearOfStudio, 'it stands clear of Studio').toBe(true);
		});
	}

	test('Gallery can move under the pointer without the post coming away', async ({
		baseURL,
		page
	}) => {
		await signUpArtist(page.request, baseURL, 'idle_artist');
		await page.goto('/');

		await expect(mailboxOn(page)).toBeInViewport();
		const atRest = await boxOf(gallery(page));
		await gallery(page).hover();
		await expect
			.poll(async () => (await boxOf(gallery(page))).x, 'Gallery slides aside')
			.toBeGreaterThan(atRest.x + 4);

		const box = await boxOf(mailboxOn(page));
		const sticker = await boxOf(gallery(page));
		expect(box.y + box.height).toBeGreaterThan(sticker.y);
	});
});
