import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// Everyone can read the museum: every surface a visitor reaches meets WCAG 2.1
// AA as axe measures it (contrast, names, labels), on a phone and a laptop.

const SCREENS = [
	{ height: 844, width: 390 },
	{ height: 800, width: 1280 }
];

type Surface = { name: string; open: (page: Page) => Promise<void> };

const card = (page: Page) => page.getByRole('button', { name: /Seeded Piece/ }).nth(2);

const VISITOR: Surface[] = [
	{
		name: 'the front door',
		open: async (page) => {
			await page.goto('/');
			await page.getByRole('button', { name: 'Come In' }).waitFor();
		}
	},
	{
		name: 'the sign-in sheet',
		open: async (page) => {
			await page.goto('/');
			await page.getByRole('button', { name: 'Come In' }).click();
			await page.getByPlaceholder('artist_123').waitFor();
		}
	},
	{
		name: 'the Hall of Fame',
		open: async (page) => {
			await page.goto('/gallery');
			await page.getByText('Trophy room').waitFor();
		}
	},
	{
		name: 'the Hot Wall',
		open: async (page) => {
			await page.goto('/gallery/hot-wall');
			await card(page).waitFor();
		}
	},
	{
		name: 'Wet Paint',
		open: async (page) => {
			await page.goto('/gallery/wet-paint');
			await card(page).waitFor();
		}
	},
	{
		name: "an artist's studio",
		open: async (page) => {
			await page.goto('/gallery/artist/seed_painter');
			await card(page).waitFor();
		}
	},
	{
		name: 'the Mystery room',
		open: async (page) => {
			await page.goto('/gallery/mystery');
			await page.getByRole('button', { name: /spin/i }).waitFor();
		}
	},
	{
		name: 'an open artwork',
		open: async (page) => {
			await page.goto('/gallery/hot-wall');
			await card(page).click();
			await page.getByRole('dialog').waitFor();
		}
	},
	{
		name: "an artwork's visitor book",
		open: async (page) => {
			await page.goto('/gallery/hot-wall');
			await card(page).click();
			await page.getByRole('button', { name: 'Read the comments' }).click();
			await page.getByText("Visitor's Book", { exact: true }).waitFor();
		}
	},
	{
		name: "an artwork's permalink",
		open: async (page) => {
			await page.goto('/artwork/e2e-seeded-05');
			await page.getByRole('heading', { name: 'Seeded Piece 05' }).waitFor();
		}
	}
];

const ARTIST: Surface[] = [
	{
		name: 'the studio lobby',
		open: async (page) => {
			await page.goto('/');
			await page.getByRole('button', { name: 'Studio' }).waitFor();
		}
	},
	{
		name: 'an empty studio wall',
		open: async (page) => {
			await page.goto('/gallery/your-studio');
			await page.getByText('You have not published any artworks yet.').waitFor();
		}
	},
	{
		name: 'the studio',
		open: async (page) => {
			await page.goto('/draw');
			const cover = page.getByRole('button', { name: 'Open sketchbook' });
			const title = page.getByPlaceholder('Untitled genius');
			await cover.or(title).first().waitFor();
			if (await cover.isVisible()) await cover.click();
			await expect(title).toBeEnabled();
		}
	}
];

const violationsOn = async (page: Page, surfaces: Surface[]) => {
	const found: string[] = [];
	for (const screen of SCREENS) {
		await page.setViewportSize(screen);
		for (const surface of surfaces) {
			await surface.open(page);
			// Measured settled: fonts in, fades finished and the grid handed to its
			// virtualizer. Mid-fade text reads as low contrast, and a card caught
			// mid-hand-over as a button with no name.
			await page.evaluate(() => document.fonts.ready);
			await page.waitForTimeout(1000);
			const { violations } = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
				.analyze();
			for (const violation of violations) {
				for (const node of violation.nodes.slice(0, 3)) {
					found.push(
						`${surface.name} at ${screen.width}px: ${violation.id} on ${node.target.join(' ')}`
					);
				}
			}
			// Readable size: no text a reader is meant to read is smaller than 12px.
			// Decoration (an edge print, a status pill beside its own label) is
			// marked aria-hidden and may be small.
			for (const tiny of await page.evaluate(() => {
				const small: string[] = [];
				const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
				while (walker.nextNode()) {
					const text = walker.currentNode.textContent?.trim();
					const parent = walker.currentNode.parentElement;
					if (!text || !parent || parent.closest('[aria-hidden="true"], [inert]')) continue;
					const style = getComputedStyle(parent);
					if (style.visibility === 'hidden' || style.display === 'none') continue;
					const box = parent.getBoundingClientRect();
					if (box.width === 0 || box.bottom <= 0 || box.top >= innerHeight) continue;
					const size = parseFloat(style.fontSize);
					if (size < 11.95) small.push(`"${text.slice(0, 30)}" at ${size.toFixed(1)}px`);
				}
				return [...new Set(small)];
			})) {
				found.push(`${surface.name} at ${screen.width}px: tiny text ${tiny}`);
			}
		}
	}
	return found;
};

test.describe('accessibility', () => {
	test.describe.configure({ timeout: 180_000 });

	test.beforeEach(async ({ page, request }) => {
		await resetDemoState(request);
		const seeded = await request.post('/demo/test-support/gallery', { data: { count: 8 } });
		expect(seeded.ok()).toBe(true);
		await page.emulateMedia({ reducedMotion: 'reduce' });
	});

	test('for a visitor', async ({ page }) => {
		expect(await violationsOn(page, VISITOR)).toEqual([]);
	});

	test('for a signed-in artist', async ({ baseURL, page }) => {
		const headers = { origin: baseURL ?? '', 'x-sveltekit-action': 'true' };
		await page.request.post('/?/signUp', { form: deterministicAuthUser, headers });
		await page.request.post('/?/saveAvatar', {
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
			headers
		});
		expect(await violationsOn(page, ARTIST)).toEqual([]);
	});
});
