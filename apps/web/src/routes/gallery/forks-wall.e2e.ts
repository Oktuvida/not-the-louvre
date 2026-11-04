import { expect, test, type Page } from '@playwright/test';
import { publishArtworkThroughActions, resetDemoState } from '../demo/e2e-helpers';

// What came of a drawing: its forks hang on a wall of their own, under the
// piece they came from. A fork's postcard leads up the thread and the catalogue
// card down it, so the whole of it can be walked a piece at a time.

const wallOf = (id: string) => new RegExp(`/gallery/forks/${id}$`);

const turnThePostcard = async (page: Page) => {
	await page.getByRole('button', { name: 'Read the comments' }).click();
	await expect(page.getByText("Visitor's Book", { exact: true })).toBeVisible();
};

test.describe('the forks of an artwork', () => {
	let original: string;

	test.beforeEach(async ({ baseURL, page, request }) => {
		await resetDemoState(request);
		const publish = (title: string, parentArtworkId?: string) =>
			publishArtworkThroughActions(page.request, baseURL, { parentArtworkId, title });
		original = await publish('The Original');
		await publish('First Fork', original);
		await publish('Second Fork', original);
	});

	test('are a step from the catalogue card', async ({ page }) => {
		await page.goto(`/artwork/${original}`);
		await turnThePostcard(page);

		await page.getByRole('link', { name: /Forks\s*2/ }).click();

		await expect(page).toHaveURL(wallOf(original));
		await expect(page).toHaveTitle(/Forks of The Original/);
		await expect(page.getByRole('dialog')).toBeHidden();

		const head = page.getByRole('complementary', { name: 'Forks of The Original' });
		await expect(head.getByRole('button')).toContainText('The Original');
		const wall = page.getByTestId('artwork-forks-room').getByRole('button');
		await expect(wall).toHaveCount(2);
		await expect(wall.first()).toContainText('Second Fork');
		await expect(wall.nth(1)).toContainText('First Fork');
		await expect(
			page.getByTestId('gallery-room-header').locator('nav [aria-current="page"]')
		).toHaveCount(0);
	});

	test('lead back up the thread from a fork', async ({ page }) => {
		await page.goto(`/gallery/forks/${original}`);
		await page.getByTestId('artwork-forks-room').getByRole('button').first().click();

		await page.getByRole('link', { name: /Forked from The Original/ }).click();

		await expect(page).toHaveURL(wallOf(original));
		await expect(page.getByRole('dialog')).toBeHidden();
	});

	test('open the original from the head of the wall, and close back to it', async ({ page }) => {
		await page.goto(`/gallery/forks/${original}`);

		await page
			.getByRole('complementary', { name: 'Forks of The Original' })
			.getByRole('button')
			.click();
		const postcard = page.getByRole('dialog');
		await expect(postcard).toContainText('The Original');

		await postcard.press('Escape');

		await expect(postcard).toBeHidden();
		await expect(page).toHaveURL(wallOf(original));
	});

	test('are read a page at a time through the feed', async ({ page }) => {
		const response = await page.request.get(`/api/artworks?parentId=${original}&limit=1`);
		const { items, pageInfo } = (await response.json()) as {
			items: { title: string }[];
			pageInfo: { hasMore: boolean };
		};

		expect(items.map((item) => item.title)).toEqual(['Second Fork']);
		expect(pageInfo.hasMore).toBe(true);
	});

	test('leave a piece nobody forked without a way in, and a quiet wall', async ({
		baseURL,
		page
	}) => {
		const lonely = await publishArtworkThroughActions(page.request, baseURL, {
			title: 'Nobody Forked This'
		});

		await page.goto(`/artwork/${lonely}`);
		await turnThePostcard(page);
		await expect(page.getByRole('link', { name: /Forks/ })).toHaveCount(0);

		await page.goto(`/gallery/forks/${lonely}`);
		await expect(page.getByText('Nobody has forked this piece yet.')).toBeVisible();
	});

	test('are a missing page for a piece that is not there', async ({ page }) => {
		const response = await page.goto('/gallery/forks/no-such-artwork');

		expect(response?.status()).toBe(404);
	});
});
