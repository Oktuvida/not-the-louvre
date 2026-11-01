import { expect, test, type Browser, type Page } from '@playwright/test';
import { resetDemoState } from '../demo/e2e-helpers';

// The gallery fits the screen it is on: one artwork per row on a phone, more
// per row as the screen widens, and on a big screen the room itself grows, so
// nothing ends up small or lost in an expanse of wall.

type Box = { height: number; width: number; x: number; y: number };

const SCREENS = [
	{ columns: 1, name: 'a phone', viewport: { height: 844, width: 390 } },
	{ columns: 2, name: 'a tablet', viewport: { height: 1024, width: 768 } },
	{ columns: 3, name: 'a laptop', viewport: { height: 800, width: 1280 } },
	{ columns: 3, name: 'a 14-inch MacBook', viewport: { height: 860, width: 1512 } },
	{ columns: 3, name: 'a desktop monitor', viewport: { height: 1080, width: 1920 } },
	{ columns: 4, name: 'a large monitor', viewport: { height: 1440, width: 2560 } }
] as const;

/** The artwork cards on the wall (the Hot Wall's lead stands alone in its row). */
const cardBoxes = (page: Page) =>
	page.getByRole('button', { name: /Seeded Piece/ }).evaluateAll((cards) =>
		cards.map((card) => {
			const { height, width, x, y } = card.getBoundingClientRect();
			return { height, width, x, y: y + window.scrollY };
		})
	);

/**
 * Cards grouped into the rows they sit in, top to bottom. By their centres:
 * each polaroid is pinned up a few degrees askew, which moves the top of its
 * box but not its centre.
 */
const rowsOf = (boxes: Box[]) => {
	const rows = new Map<number, Box[]>();
	for (const box of boxes) {
		const middle = Math.round((box.y + box.height / 2) / 8) * 8;
		rows.set(middle, [...(rows.get(middle) ?? []), box]);
	}
	return [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
};

const openHotWall = async (page: Page) => {
	await page.goto('/gallery/hot-wall');
	await expect(page.getByRole('button', { name: /Seeded Piece/ }).nth(4)).toBeVisible();
	// Settled: the grid has been measured and the cards stopped moving.
	let previous = '';
	await expect
		.poll(async () => {
			const current = JSON.stringify(await cardBoxes(page));
			const settled = current === previous;
			previous = current;
			return settled;
		})
		.toBe(true);
};

const atSize = async (browser: Browser, viewport: { height: number; width: number }) => {
	const context = await browser.newContext({ viewport });
	return { context, page: await context.newPage() };
};

test.describe('the gallery on every screen', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 40 } });
		expect(seeded.ok()).toBe(true);
	});

	for (const screen of SCREENS) {
		test(`on ${screen.name}, ${screen.columns} per row and none of them small`, async ({
			browser
		}) => {
			const { context, page } = await atSize(browser, screen.viewport);
			await openHotWall(page);

			const rows = rowsOf(await cardBoxes(page));
			const widest = Math.max(...rows.map((row) => row.length));
			expect(widest).toBe(screen.columns);

			// Every card on the grid is big enough to see the drawing without
			// opening it, and the row uses the width it has.
			const gridCards = rows.filter((row) => row.length === widest).flat();
			for (const card of gridCards) expect(card.width).toBeGreaterThanOrEqual(300);
			await context.close();
		});
	}

	test('the Mystery room keeps Spin a button, not a banner across the screen', async ({
		browser
	}) => {
		for (const viewport of [
			{ height: 1024, width: 768 },
			{ height: 860, width: 1512 },
			{ height: 1440, width: 2560 }
		]) {
			const { context, page } = await atSize(browser, viewport);
			await page.goto('/gallery/mystery');
			const spin = page.getByRole('button', { name: /spin/i });
			await expect(spin).toBeVisible();
			const width = await spin.evaluate((element) => element.getBoundingClientRect().width);
			expect(width, `Spin at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width * 0.5);
			await context.close();
		}
	});

	test('on a big screen the room grows with it, not only the number of columns', async ({
		browser
	}) => {
		const measure = async (viewport: { height: number; width: number }) => {
			const { context, page } = await atSize(browser, viewport);
			await openHotWall(page);
			const lead = await page
				.getByRole('button', { name: /Hottest right now/ })
				.evaluate((element) => element.getBoundingClientRect().width);
			const caption = await page
				.getByRole('button', { name: /Seeded Piece/ })
				.nth(2)
				.getByText(/^Seeded Piece/)
				.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
			await context.close();
			return { caption, lead };
		};

		const laptop = await measure({ height: 900, width: 1440 });
		const large = await measure({ height: 1440, width: 2560 });

		// Half as big again: the lead artwork, and with it every piece of the room.
		expect(large.lead / laptop.lead).toBeGreaterThan(1.4);
		expect(large.lead / laptop.lead).toBeLessThan(1.6);
		// The cards grow too, and their captions with them.
		expect(large.caption).toBeGreaterThan(laptop.caption * 1.2);
	});

	test('arrives with the first artworks laid out where they stay once the page runs', async ({
		browser
	}) => {
		const viewport = { height: 800, width: 1280 };

		const withoutScript = await browser.newContext({ javaScriptEnabled: false, viewport });
		const staticPage = await withoutScript.newPage();
		await staticPage.goto('/gallery/hot-wall');
		const served = rowsOf(await cardBoxes(staticPage));
		await withoutScript.close();

		// The lead and at least one full row of the grid come in the page itself.
		expect(served.flat().length).toBeGreaterThanOrEqual(4);

		const { context, page } = await atSize(browser, viewport);
		await openHotWall(page);
		const running = rowsOf(await cardBoxes(page));
		await context.close();

		for (const [rowIndex, row] of served.slice(0, 2).entries()) {
			for (const [cardIndex, card] of row.entries()) {
				const after = running[rowIndex]![cardIndex]!;
				expect(Math.abs(after.x - card.x)).toBeLessThanOrEqual(2);
				expect(Math.abs(after.y - card.y)).toBeLessThanOrEqual(2);
				expect(Math.abs(after.width - card.width)).toBeLessThanOrEqual(2);
			}
		}
	});
});
