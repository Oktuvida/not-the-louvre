import { expect, test, type Locator, type Page } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The front door fits the visitor's screen as it is, with no zooming out:
// outside, the sign, the window and its Come In button; inside, for an artist
// who is signed in, the title, the way to the studio and their own corner; and
// on both, the way to the gallery and the current best pieces. All whole on
// screen, none sitting on another.

type Box = { bottom: number; left: number; right: number; top: number };

const SCREENS = [
	{ height: 667, name: 'an iPhone SE', width: 375 },
	{ height: 844, name: 'a phone', width: 390 },
	{ height: 390, name: 'a phone on its side', width: 844 },
	{ height: 1024, name: 'a tablet upright', width: 768 },
	{ height: 768, name: 'a tablet on its side', width: 1024 },
	{ height: 720, name: 'a small laptop', width: 1280 },
	{ height: 860, name: 'a 14-inch MacBook', width: 1512 },
	{ height: 900, name: 'a laptop', width: 1440 },
	{ height: 1080, name: 'a desktop monitor', width: 1920 },
	{ height: 1440, name: 'a large monitor', width: 2560 }
];

const boxOf = (locator: Locator) =>
	locator.evaluate((element): Box => {
		const { bottom, left, right, top } = element.getBoundingClientRect();
		return { bottom, left, right, top };
	});

const overlap = (a: Box, b: Box) =>
	Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
	Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** What the front door shows, by name, as long as it is on the page. */
const frontDoor = async (page: Page, signedIn: boolean) => {
	const pieces: [string, Locator][] = signedIn
		? [
				['the title', page.getByRole('heading', { name: 'NOT THE LOUVRE' })],
				['the tagline', page.getByText('Where masterpieces are made')],
				['Studio', page.getByRole('button', { name: 'Studio' })],
				['Gallery', page.getByRole('button', { name: 'GALLERY' })],
				['Leave', page.getByRole('button', { name: 'Leave' })],
				['the visitor badge', page.getByRole('button', { name: /Edit avatar for/ })]
			]
		: [
				['the sign', page.getByTestId('museum-wall-logo')],
				['the window', page.getByTestId('museum-window-frame')],
				['Come In', page.getByRole('button', { name: 'Come In' })],
				['Gallery', page.getByRole('link', { name: 'GALLERY' })]
			];
	pieces.push(['the audio tab', page.getByRole('button', { name: 'Ambient music' })]);
	pieces.push(['the Ko-fi cup', page.getByRole('link', { name: /keep the museum open/i })]);
	// The footer line is shown where there is room for it, and must fit there.
	const footer = page.getByText('A social art studio where your doodles compete for glory');
	if (signedIn && (await footer.isVisible())) pieces.push(['the footer line', footer]);
	const previews = page.getByTestId(/^home-preview-frame-/);
	for (let index = 0; index < (await previews.count()); index += 1) {
		if (await previews.nth(index).isVisible()) {
			pieces.push([`best piece ${index + 1}`, previews.nth(index)]);
		}
	}

	const boxes: { box: Box; name: string }[] = [];
	for (const [name, locator] of pieces) boxes.push({ box: await boxOf(locator), name });
	return boxes;
};

const checkFrontDoor = async (page: Page, signedIn: boolean) => {
	for (const screen of SCREENS) {
		const where = `on ${screen.name} (${screen.width}×${screen.height})`;
		await page.setViewportSize({ height: screen.height, width: screen.width });
		await page.goto('/');
		await expect(
			signedIn
				? page.getByRole('button', { name: 'Studio' })
				: page.getByRole('button', { name: 'Come In' })
		).toBeVisible();

		const boxes = await frontDoor(page, signedIn);
		for (const { box, name } of boxes) {
			expect.soft(box.left, `${name} ${where}, left edge`).toBeGreaterThanOrEqual(0);
			expect.soft(box.top, `${name} ${where}, top edge`).toBeGreaterThanOrEqual(0);
			// On a phone the audio tab is tucked into the right edge on purpose,
			// a pull tab peeking out of the frame.
			if (name !== 'the audio tab') {
				expect.soft(box.right, `${name} ${where}, right edge`).toBeLessThanOrEqual(screen.width);
			}
			expect.soft(box.bottom, `${name} ${where}, bottom edge`).toBeLessThanOrEqual(screen.height);
		}

		for (const [index, a] of boxes.entries()) {
			for (const b of boxes.slice(index + 1)) {
				// The sign is painted on the wall overlapping the window's moulding,
				// as a sign hung beside it would; it may touch the window, nothing else.
				const pair = [a.name, b.name];
				if (pair.includes('the sign') && pair.includes('the window')) continue;
				// Leave is the visitor pass's own stub, torn along its perforation.
				if (pair.includes('Leave') && pair.includes('the visitor badge')) continue;
				expect.soft(overlap(a.box, b.box), `${a.name} and ${b.name} ${where}`).toBe(0);
			}
		}

		// The best pieces hang down the right only where there is room beside
		// the window: a wide screen on its side, at least 40rem tall.
		const hasRoomForPieces =
			screen.width >= 768 && screen.height >= 640 && screen.width > screen.height;
		expect
			.soft(
				boxes.some(({ name }) => name.startsWith('best piece')),
				`the best pieces ${where}`
			)
			.toBe(hasRoomForPieces);

		if (signedIn) continue;

		// Fitting is not shrinking to nothing: the sign and the window stay big
		// enough to read the one and look through the other, for the room the
		// screen has.
		const sign = boxes.find(({ name }) => name === 'the sign')!.box;
		const window = boxes.find(({ name }) => name === 'the window')!.box;
		expect
			.soft(sign.right - sign.left, `the sign's width ${where}`)
			.toBeGreaterThanOrEqual(Math.min(240, screen.width * 0.5, screen.height * 0.2));
		expect
			.soft(window.right - window.left, `the window's width ${where}`)
			.toBeGreaterThanOrEqual(Math.min(300, screen.width * 0.7, screen.height * 0.4));
	}
};

test.describe('the front door on every screen', () => {
	// Ten screens, one page load each.
	test.describe.configure({ timeout: 120_000 });

	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
		expect(seeded.ok()).toBe(true);
	});

	test('for a visitor', async ({ page }) => {
		await checkFrontDoor(page, false);
	});

	// The wall's opening is cut before any script measures the window; on the
	// first paint, and with scripts off, it has to line up with the glass.
	test('cuts the wall where the window glass is before any script runs', async ({ browser }) => {
		for (const screen of [SCREENS[1]!, SCREENS[5]!, SCREENS[6]!]) {
			const context = await browser.newContext({
				javaScriptEnabled: false,
				viewport: { height: screen.height, width: screen.width }
			});
			const page = await context.newPage();
			await page.goto('/');

			const { cut, glass } = await page.evaluate(() => {
				const slab = document.querySelector<HTMLElement>('[data-testid="museum-wall-slab-left"]')!;
				// Split on separators outside any parentheses: the coordinates are calc()s.
				const splitTop = (text: string, separator: string) => {
					const parts: string[] = [];
					let depth = 0;
					let current = '';
					for (const char of text) {
						if (char === '(') depth += 1;
						if (char === ')') depth -= 1;
						if (char === separator && depth === 0) {
							parts.push(current.trim());
							current = '';
						} else current += char;
					}
					return [...parts, current.trim()].filter(Boolean);
				};
				// polygon(0 0, 100% 0, 100% top, left top, left 100%, 0 100%)
				const points = splitTop(slab.style.clipPath.replace(/^polygon\(|\)$/g, ''), ',').map(
					(point) => splitTop(point, ' ')
				);
				const [left, top] = points[3]!;
				const corner = document.createElement('div');
				corner.style.cssText = `position: absolute; left: ${left}; top: ${top};`;
				slab.parentElement!.append(corner);
				const glassBox = document
					.querySelector('[data-testid="museum-window-frame"]')!
					.previousElementSibling!.getBoundingClientRect();
				const cutBox = corner.getBoundingClientRect();
				return {
					cut: { x: cutBox.left, y: cutBox.top },
					glass: { x: glassBox.left, y: glassBox.top }
				};
			});
			await context.close();

			const where = `on ${screen.name}`;
			expect.soft(Math.abs(cut.x - glass.x), `the cut's left edge ${where}`).toBeLessThanOrEqual(1);
			expect.soft(Math.abs(cut.y - glass.y), `the cut's top edge ${where}`).toBeLessThanOrEqual(1);
		}
	});

	test('for a signed-in artist', async ({ baseURL, page }) => {
		const { nickname, password } = deterministicAuthUser;
		const signedUp = await page.request.post('/?/signUp', {
			form: { nickname, password },
			headers: { origin: baseURL ?? '', 'x-sveltekit-action': 'true' }
		});
		expect(signedUp.ok()).toBe(true);
		// Past the first visit's avatar drawing, which opens over the front door.
		const avatar = await page.request.post('/?/saveAvatar', {
			form: {
				drawingDocument: JSON.stringify({
					...createEmptyDrawingDocument('avatar'),
					strokes: [
						{
							color: '#2d2420',
							points: [
								[100, 100],
								[300, 300]
							],
							size: 12
						}
					]
				})
			},
			headers: { origin: baseURL ?? '', 'x-sveltekit-action': 'true' }
		});
		expect(await avatar.json()).toMatchObject({ type: 'success' });

		await checkFrontDoor(page, true);
	});
});
