import { expect, test, type Locator, type Page } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

// Whatever the screen, the gallery's header can be read and used: its controls
// never sit on top of one another, the room the visitor is in shows its whole
// tab, and the room's note is on screen rather than cut off at the edge.

type Box = { bottom: number; left: number; right: number; top: number };

const WIDTHS = [390, 768, 1024, 1280, 1440, 1920, 2560];

const boxOf = (page: Page, locator: Locator) =>
	locator.evaluate((element): Box => {
		const { bottom, left, right, top } = element.getBoundingClientRect();
		return { bottom, left, right, top };
	});

const overlap = (a: Box, b: Box) =>
	Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
	Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** The header's own controls: Back, the room tabs, and the actions on the right. */
const headerControls = async (page: Page, signedIn: boolean) => {
	const header = page.getByTestId('gallery-room-header');
	const named: [string, Locator][] = [
		['Back', header.getByRole('link', { name: 'Back' })],
		...(signedIn
			? ([
					['Create Art', header.getByRole('link', { name: 'Create Art' })],
					['Refresh', header.getByRole('button', { name: 'Refresh' })]
				] satisfies [string, Locator][])
			: ([['Join & draw', header.getByRole('link', { name: /Join/ })]] satisfies [
					string,
					Locator
				][]))
	];
	const controls: { box: Box; name: string }[] = [];
	for (const [name, locator] of named) controls.push({ box: await boxOf(page, locator), name });
	const tabs = header.getByRole('navigation').getByRole('link');
	for (let index = 0; index < (await tabs.count()); index += 1) {
		const tab = tabs.nth(index);
		controls.push({ box: await boxOf(page, tab), name: `tab "${await tab.innerText()}"` });
	}
	return controls;
};

const ROOMS = [
	{ note: 'Fresh pieces rising fast', path: '/gallery/hot-wall', tab: /the hot wall/i },
	{ note: 'Trophy room for the top-ranked', path: '/gallery', tab: /hall of fame/i }
] as const;

const checkHeader = async (
	page: Page,
	width: number,
	signedIn: boolean,
	room: (typeof ROOMS)[number]
) => {
	await page.setViewportSize({ height: 900, width });
	await page.goto(room.path);
	await expect(page.getByText(room.note)).toBeVisible();

	const controls = await headerControls(page, signedIn);
	const nav = await boxOf(page, page.getByTestId('gallery-room-header').getByRole('navigation'));
	for (const [index, a] of controls.entries()) {
		for (const b of controls.slice(index + 1)) {
			expect.soft(overlap(a.box, b.box), `${a.name} and ${b.name} at ${width}px`).toBe(0);
		}
	}

	// The tab strip may scroll sideways on a phone, but the room the visitor is
	// in is always shown whole.
	const active = controls.find((control) => room.tab.test(control.name))!;
	expect.soft(active.box.left, `the active tab at ${width}px`).toBeGreaterThanOrEqual(nav.left - 1);
	expect.soft(active.box.right, `the active tab at ${width}px`).toBeLessThanOrEqual(nav.right + 1);

	const note = await boxOf(page, page.getByText(room.note));
	expect.soft(note.left, `the room note at ${width}px`).toBeGreaterThanOrEqual(0);
	expect.soft(note.right, `the room note at ${width}px`).toBeLessThanOrEqual(width);
	for (const control of controls) {
		expect
			.soft(overlap(note, control.box), `the room note and ${control.name} at ${width}px`)
			.toBe(0);
	}
	// Nor does it cover what the room opens with: its first artworks, and the
	// champion's medal and banner in the Hall of Fame.
	const artworks = page.getByRole('img', { name: /Seeded Piece/ });
	for (let index = 0; index < Math.min(4, await artworks.count()); index += 1) {
		const artwork = await boxOf(page, artworks.nth(index));
		expect.soft(overlap(note, artwork), `the room note and an artwork at ${width}px`).toBe(0);
	}
	const champion = page.getByText(/^champion$/i);
	if (await champion.count()) {
		const banner = await boxOf(page, champion);
		// The medal hangs above the banner, as wide as it is tall.
		const medal = { ...banner, top: banner.top - (banner.right - banner.left) };
		expect.soft(overlap(note, medal), `the room note and the champion at ${width}px`).toBe(0);
	}
};

test.describe('the gallery header on every screen', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 6 } });
		expect(seeded.ok()).toBe(true);
	});

	test('for a visitor', async ({ page }) => {
		for (const room of ROOMS)
			for (const width of WIDTHS) await checkHeader(page, width, false, room);
	});

	test('for a signed-in artist, with their studio and the actions to draw', async ({
		baseURL,
		page
	}) => {
		const { nickname, password } = deterministicAuthUser;
		const signedUp = await page.request.post('/?/signUp', {
			form: { nickname, password },
			headers: { origin: baseURL ?? '', 'x-sveltekit-action': 'true' }
		});
		expect(signedUp.ok()).toBe(true);

		for (const room of ROOMS)
			for (const width of WIDTHS) await checkHeader(page, width, true, room);
	});
});
