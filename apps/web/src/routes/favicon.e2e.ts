import { expect, test } from '@playwright/test';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The tab of a signed-in artist wears their avatar. Safari is the strict one:
// it takes an icon for what its link says it is, only reads a page's icon when
// a link arrives, and fetches an icon at an address when it gets round to it
// (never in a private window), so the page carries the avatar inside it.

const iconLinks = (page: import('@playwright/test').Page) =>
	page.evaluate(() =>
		[...document.head.querySelectorAll('link[rel~="icon"]')].map((link) => ({
			href: link.getAttribute('href') ?? '',
			sizes: link.getAttribute('sizes'),
			type: link.getAttribute('type')
		}))
	);

/** The width and height a PNG's header gives. */
const pngSize = (bytes: Buffer) => ({
	height: bytes.readUInt32BE(20),
	width: bytes.readUInt32BE(16)
});

test.describe('the tab icon', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	test('wears a signed-in artist’s avatar, written into the page as a 32-pixel PNG', async ({
		baseURL,
		page
	}) => {
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

		await page.goto('/');
		const [icon, ...others] = await iconLinks(page);
		expect(others).toEqual([]);
		expect(icon).toMatchObject({ sizes: '32x32', type: 'image/png' });
		expect(icon!.href).toMatch(/^data:image\/png;base64,/);
		const png = Buffer.from(icon!.href.slice('data:image/png;base64,'.length), 'base64');
		expect(pngSize(png)).toEqual({ height: 32, width: 32 });

		// The second page is served the same icon, kept from the first.
		await page.reload();
		const [again] = await iconLinks(page);
		expect(again?.href).toBe(icon!.href);
	});

	test('changes to the avatar the moment it is drawn, with a new icon, not an edited one', async ({
		baseURL,
		page
	}) => {
		await page.request.post('/?/signUp', {
			form: deterministicAuthUser,
			headers: { origin: baseURL ?? '', 'x-sveltekit-action': 'true' }
		});
		await page.goto('/');
		await expect(page.getByRole('dialog', { name: 'Finish your avatar' })).toBeVisible();
		const [sketch] = await iconLinks(page);
		expect(sketch?.type).toBe('image/svg+xml');
		const sketchLink = await page.evaluateHandle(() =>
			document.head.querySelector('link[rel~="icon"]')
		);

		const canvas = page.getByLabel('Avatar drawing canvas');
		await expect(canvas).toHaveAttribute('aria-disabled', 'false');
		const box = (await canvas.boundingBox())!;
		await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 6 });
		await page.mouse.up();
		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await expect
			.poll(async () => (await iconLinks(page)).map((icon) => icon.type))
			.toEqual(['image/png']);
		expect(await sketchLink.evaluate((link) => link?.isConnected ?? false)).toBe(false);
	});
});
