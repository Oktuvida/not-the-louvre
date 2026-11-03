import { expect, test, type Page } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

// The studio is one page that has to fit every screen an artist draws on: a
// desktop, a laptop, a tablet either way up, a phone either way up. On each of
// them the canvas is square, whole and uncovered, the page never scrolls
// sideways, the supplies stay off the canvas, the title, the 18+ switch
// and Publish are on screen, and the record player covers none of them. The canvas also takes a fair share of the screen,
// so "fits" never means "shrunk to a stamp".

type Screen = {
	name: string;
	width: number;
	height: number;
	/** The canvas side, as a share of the screen's height or width. */
	canvasShare: { of: 'height' | 'width'; atLeast: number };
	/** On a very short phone the title and Publish sit below the fold. */
	controlsBelowTheFold?: boolean;
};

const SCREENS: Screen[] = [
	{ name: 'a desktop', width: 1920, height: 1080, canvasShare: { of: 'height', atLeast: 0.7 } },
	{ name: 'a 14" laptop', width: 1512, height: 860, canvasShare: { of: 'height', atLeast: 0.7 } },
	{ name: 'a small laptop', width: 1280, height: 720, canvasShare: { of: 'height', atLeast: 0.7 } },
	{
		name: 'a tablet held sideways',
		width: 1180,
		height: 820,
		canvasShare: { of: 'height', atLeast: 0.7 }
	},
	{ name: 'a 4:3 screen', width: 1024, height: 768, canvasShare: { of: 'height', atLeast: 0.6 } },
	{
		name: 'a tablet held upright',
		width: 820,
		height: 1180,
		canvasShare: { of: 'width', atLeast: 0.75 }
	},
	{ name: 'a phone', width: 390, height: 844, canvasShare: { of: 'width', atLeast: 0.85 } },
	{
		name: 'a small phone',
		width: 375,
		height: 667,
		canvasShare: { of: 'width', atLeast: 0.85 },
		controlsBelowTheFold: true
	},
	{
		name: 'a phone held sideways',
		width: 844,
		height: 390,
		canvasShare: { of: 'height', atLeast: 0.5 },
		controlsBelowTheFold: true
	}
];

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const signIn = async (page: Page, baseURL: string | undefined) => {
	const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
	const signUp = await page.request.post('/?/signUp', { form: deterministicAuthUser, headers });
	expect(signUp.ok()).toBe(true);
};

/** Opens the studio; on a screen that shows the sketchbook's cover, opens it. */
const openStudio = async (page: Page) => {
	await page.goto('/draw');
	const cover = page.getByRole('button', { name: 'Open sketchbook' });
	const title = page.getByPlaceholder('Untitled genius');
	await expect(cover.or(title).first()).toBeVisible();
	if (await cover.isVisible()) await cover.click();
	await expect(title).toBeEnabled();
};

const canvasBox = async (page: Page) => {
	const box = await page.getByLabel('Drawing canvas').boundingBox();
	if (!box) throw new Error('The drawing canvas is not on the page');
	return box;
};

/** What the artist would touch at a grid of points across the canvas, when it is not the canvas. */
const whatCoversTheCanvas = (page: Page, box: Box) =>
	page.evaluate((canvas) => {
		const covering: string[] = [];
		for (let row = 1; row <= 5; row += 1) {
			for (let column = 1; column <= 5; column += 1) {
				const x = canvas.x + (canvas.width * column) / 6;
				const y = canvas.y + (canvas.height * row) / 6;
				const hit = document.elementFromPoint(x, y);
				if (!hit?.closest('[data-canvas-frame]')) {
					covering.push(
						`${Math.round(x)},${Math.round(y)}: ${hit ? `${hit.tagName.toLowerCase()}.${[...hit.classList].join('.')}` : 'nothing'}`
					);
				}
			}
		}
		return covering;
	}, box);

/** Draws a line across the middle of the canvas. */
const drawAcrossTheMiddle = async (page: Page) => {
	const box = await canvasBox(page);
	const y = box.y + box.height / 2;
	await page.mouse.move(box.x + box.width * 0.2, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.8, y, { steps: 12 });
	await page.mouse.up();
};

/** Whether the canvas has ink at its centre. */
const inkAtTheCentre = (page: Page) =>
	page.getByLabel('Drawing canvas').evaluate((node) => {
		const canvas = node as HTMLCanvasElement;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Expected a 2D canvas');
		const [, , , alpha] = context.getImageData(
			Math.floor(canvas.width / 2),
			Math.floor(canvas.height / 2),
			1,
			1
		).data;
		return alpha > 0;
	});

test.describe('the studio fits the screen it is on', () => {
	test.beforeEach(async ({ baseURL, page, request }) => {
		await resetDemoState(request);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await signIn(page, baseURL);
	});

	for (const screen of SCREENS) {
		test(`on ${screen.name} (${screen.width}×${screen.height})`, async ({ page }) => {
			await page.setViewportSize({ width: screen.width, height: screen.height });
			await openStudio(page);

			const canvas = await canvasBox(page);

			// Square, whole, and a fair share of the screen.
			expect(Math.abs(canvas.width - canvas.height), 'the canvas is square').toBeLessThanOrEqual(1);
			expect(canvas.x, 'the canvas starts on screen').toBeGreaterThanOrEqual(0);
			expect(canvas.y, 'the canvas starts on screen').toBeGreaterThanOrEqual(0);
			expect(canvas.x + canvas.width, 'the canvas ends on screen').toBeLessThanOrEqual(
				screen.width
			);
			expect(canvas.y + canvas.height, 'the canvas ends on screen').toBeLessThanOrEqual(
				screen.height
			);
			const side = screen.canvasShare.of === 'height' ? screen.height : screen.width;
			expect(
				canvas.width,
				`the canvas takes its share of the ${screen.canvasShare.of}`
			).toBeGreaterThanOrEqual(side * screen.canvasShare.atLeast);

			// Nothing on top of it, once the cover has finished turning away.
			await expect.poll(() => whatCoversTheCanvas(page, canvas)).toEqual([]);

			// No sideways scroll.
			const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(scrollWidth, 'the page never scrolls sideways').toBeLessThanOrEqual(screen.width);

			// The supplies and the buttons stay off the canvas.
			const supplies = [
				page.getByRole('button', { name: /Select color/ }),
				page.getByRole('slider', { name: 'Brush size' }),
				page.getByRole('button', { name: /Eraser/ }),
				page.getByRole('button', { name: 'Undo' }),
				page.getByRole('button', { name: 'Redo' }),
				page.getByRole('button', { name: 'Publish' }),
				page.getByRole('button', { name: /Tear out this page/ })
			];
			for (const control of supplies) {
				for (const one of await control.all()) {
					if (!(await one.isVisible())) continue;
					const box = await one.boundingBox();
					expect(
						box && overlaps(box, canvas),
						`${(await one.getAttribute('aria-label')) ?? (await one.textContent())?.trim()} sits on the canvas`
					).toBe(false);
				}
			}

			// What the artist needs to finish is on screen, under no record player.
			const recordPlayer = page.getByRole('button', { name: 'Ambient music' });
			const finishing = [
				page.getByPlaceholder('Untitled genius'),
				page.getByRole('checkbox', { name: /Not safe for the Louvre/ }),
				page.getByRole('button', { name: 'Publish' }),
				page.getByRole('button', { name: /Tear out this page/ })
			];
			for (const control of finishing) {
				if (screen.controlsBelowTheFold) await control.scrollIntoViewIfNeeded();
				await expect(control).toBeInViewport({ ratio: 1 });
				const [box, player] = await Promise.all([
					control.boundingBox(),
					recordPlayer.boundingBox()
				]);
				expect(
					box && player && overlaps(box, player),
					`the record player sits on ${(await control.getAttribute('placeholder')) ?? (await control.textContent())?.trim()}`
				).toBe(false);
			}
		});
	}

	for (const [upright, sideways] of [
		[
			{ width: 820, height: 1180 },
			{ width: 1180, height: 820 }
		],
		[
			{ width: 390, height: 844 },
			{ width: 844, height: 390 }
		]
	]) {
		test(`turning a ${upright.width}px screen sideways keeps the drawing`, async ({ page }) => {
			await page.setViewportSize(upright);
			await openStudio(page);
			await drawAcrossTheMiddle(page);
			await expect.poll(() => inkAtTheCentre(page)).toBe(true);

			await page.setViewportSize(sideways);
			await expect(page.getByPlaceholder('Untitled genius')).toBeEnabled();
			await expect.poll(() => inkAtTheCentre(page)).toBe(true);
			const canvas = await canvasBox(page);
			expect(Math.abs(canvas.width - canvas.height)).toBeLessThanOrEqual(1);
		});
	}
});
