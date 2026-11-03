import { expect, test, type Page, type Route } from '@playwright/test';
import { HANDOFF_BOOK_TILT, handoffBookRect } from '../lib/features/shared-ui/studio-handoff';
import { createEmptyDrawingDocument } from '../lib/features/stroke-json/document';
import { deterministicAuthUser, resetDemoState } from './demo/e2e-helpers';

// The studio behind the front door is the first thing an artist sees once in:
// the room is drawn at full strength, not faded behind a veil, on the studio's
// own warm backdrop, and its dressed surfaces compile on the GPU without a
// shader error.

/** The average colour of a small patch of the screen, as the visitor sees it. */
const colourAt = async (page: Page, x: number, y: number) => {
	const png = await page.screenshot({ clip: { height: 8, width: 8, x, y } });
	return page.evaluate(async (base64) => {
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
		const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext('2d')!;
		context.drawImage(bitmap, 0, 0);
		const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
		const sum = [0, 0, 0];
		for (let index = 0; index < data.length; index += 4) {
			for (let channel = 0; channel < 3; channel++) sum[channel] += data[index + channel];
		}
		return sum.map((total) => Math.round(total / (data.length / 4)));
	}, png.toString('base64'));
};

test.describe('the studio as a visitor first meets it', () => {
	test.beforeEach(async ({ request }) => {
		await resetDemoState(request);
	});

	// The floor's parquet was a 362 KB PNG inside a 578 KB model that a returning
	// visitor downloaded again every day.
	test('arrives in under 400 KB, and is kept for good', async ({ page }) => {
		const model = page.waitForResponse((response) => /\.glb(\?|$)/.test(response.url()));
		await page.goto('/');
		const response = await model;

		expect((await response.body()).byteLength).toBeLessThan(400 * 1024);
		expect(response.headers()['cache-control']).toContain('immutable');
	});

	// Without an avatar, the frame over the desk shows a drawn placeholder. The
	// browser refused it as a texture (an SVG with no size of its own), so the
	// frame stayed empty.
	test('hangs the placeholder portrait for a visitor with no avatar', async ({ page }) => {
		const glErrors: string[] = [];
		page.on('console', (message) => {
			if (/WebGL: INVALID|GL_INVALID/.test(message.text())) glErrors.push(message.text());
		});

		await page.goto('/');
		await page.getByRole('button', { name: 'Come In' }).waitFor();
		const room = page.locator('.home-entry-page canvas').first();
		// The room fades in once its model is up; its textures go up with it.
		await expect
			.poll(
				() => room.evaluate((canvas) => Number(getComputedStyle(canvas.parentElement!).opacity)),
				{
					timeout: 15_000
				}
			)
			.toBe(1);
		// A few more drawn frames, for the texture uploads to have happened.
		await page.evaluate(
			() =>
				new Promise((resolve) => {
					let frames = 0;
					const next = () => (++frames < 10 ? requestAnimationFrame(next) : resolve(null));
					requestAnimationFrame(next);
				})
		);

		expect(glErrors).toEqual([]);
	});
});

test.describe('the studio behind the front door', () => {
	test.beforeEach(async ({ baseURL, page, request }) => {
		await resetDemoState(request);
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
	});

	test('shows the room at full strength, its surfaces compiling cleanly', async ({ page }) => {
		const shaderErrors: string[] = [];
		page.on('console', (message) => {
			if (/shader error|WebGLProgram/i.test(message.text())) shaderErrors.push(message.text());
		});

		await page.goto('/');
		await page.getByRole('button', { name: 'Studio' }).waitFor();
		const room = page.locator('.home-entry-page canvas').first();
		await room.waitFor();

		// Every layer between the room and the page multiplies into what shows.
		await expect
			.poll(
				() =>
					room.evaluate((canvas) => {
						let opacity = 1;
						for (let node: Element | null = canvas; node; node = node.parentElement) {
							opacity *= Number(getComputedStyle(node).opacity);
						}
						return opacity;
					}),
				{ timeout: 15_000 }
			)
			.toBeCloseTo(1, 2);
		expect(shaderErrors).toEqual([]);
	});

	// Every visit to the front door used to leave its room's GPU memory
	// behind: the canvas left the page, but its WebGL context stayed alive
	// until the garbage collector got round to it, and Safari reloads a page
	// that holds too much.
	test('lets go of the room’s GPU memory once the visitor walks into the gallery', async ({
		page
	}) => {
		await page.addInitScript(() => {
			const contexts: { canvas: HTMLCanvasElement; context: WebGLRenderingContext }[] = [];
			Object.assign(window, { __contexts: contexts });
			const getContext = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function (
				this: HTMLCanvasElement,
				...args: Parameters<HTMLCanvasElement['getContext']>
			) {
				const context = getContext.apply(this, args);
				if (context instanceof WebGL2RenderingContext || context instanceof WebGLRenderingContext) {
					if (!contexts.some((known) => known.context === context)) {
						contexts.push({ canvas: this, context });
					}
				}
				return context;
			} as typeof getContext;
		});
		/** The room's contexts: the ones that drew into a canvas on the page. */
		const roomContexts = () =>
			page.evaluate(() =>
				(
					window as unknown as {
						__contexts: { canvas: HTMLCanvasElement; context: WebGLRenderingContext }[];
					}
				).__contexts
					.filter(({ canvas }) => canvas.width > 300)
					.map(({ context }) => ({ lost: context.isContextLost() }))
			);

		await page.goto('/');
		await page.getByRole('button', { name: 'Studio' }).waitFor();
		await expect.poll(roomContexts, { timeout: 15_000 }).toEqual([{ lost: false }]);

		await page.getByRole('button', { name: 'Gallery' }).click();
		await expect(page).toHaveURL(/\/gallery/, { timeout: 15_000 });

		await expect.poll(roomContexts).toEqual([{ lost: true }]);
	});

	test('stands the room on the studio’s warm backdrop, not on white', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Studio' }).waitFor();
		const { height, width } = page.viewportSize()!;

		// The room sits in the middle of the screen, so its corners are backdrop.
		await expect
			.poll(
				async () => {
					const corners = await Promise.all(
						[
							[0, 0],
							[width - 8, 0],
							[0, height - 8],
							[width - 8, height - 8]
						].map(([x, y]) => colourAt(page, x, y))
					);
					return corners.map(([red, green, blue]) =>
						red - blue > 20 && Math.max(red, green, blue) < 240
							? 'warm'
							: `rgb(${red}, ${green}, ${blue})`
					);
				},
				{ timeout: 15_000 }
			)
			.toEqual(['warm', 'warm', 'warm', 'warm']);
	});

	test.describe('on a desk-shaped screen', () => {
		test.use({ viewport: { height: 860, width: 1512 } });

		test('hands the side table’s sketchbook to the studio on the spot it lies, on the same desk', async ({
			page
		}) => {
			// The room's scene, as three.js announces it to its devtools.
			await page.addInitScript(() => {
				const hook = new EventTarget();
				const scenes: unknown[] = [];
				Object.assign(window, { __THREE_DEVTOOLS__: hook, __scenes: scenes });
				hook.addEventListener('observe', (event) => {
					const detail = (event as CustomEvent<{ isScene?: boolean }>).detail;
					if (detail?.isScene) scenes.push(detail);
				});
			});
			// The studio's data waits until the room's last frame has been looked at.
			const heldRoutes: Route[] = [];
			await page.route('**/draw/__data.json*', (route) => {
				heldRoutes.push(route);
			});

			const { height, width } = page.viewportSize()!;
			const spot = handoffBookRect(width, height);
			const turn = (HANDOFF_BOOK_TILT * Math.PI) / 180;
			// The box the book fills on screen, turned to its slant.
			const spotBox = {
				height: spot.width * Math.abs(Math.sin(turn)) + spot.height * Math.cos(turn),
				width: spot.width * Math.cos(turn) + spot.height * Math.abs(Math.sin(turn))
			};
			const deskPoints = [
				[0.12, 0.45],
				[0.88, 0.45],
				[0.2, 0.9],
				[0.8, 0.9]
			].map(([x, y]) => [Math.round(x * width), Math.round(y * height)]);

			await page.goto('/');
			await page.getByRole('button', { name: 'Studio' }).click();

			// The camera ends with the side table's book on that spot, level with
			// the screen but for the studio's slant.
			const roomBook = () =>
				page.evaluate(() => {
					type Vector = { x: number; y: number; z: number; project(camera: unknown): Vector };
					type Node = {
						isCamera?: boolean;
						isMesh?: boolean;
						material?: { name?: string };
						geometry?: {
							boundingBox: { max: Vector; min: Vector } | null;
							computeBoundingBox(): void;
						};
						position: { constructor: new (x: number, y: number, z: number) => Vector };
						localToWorld(vector: Vector): Vector;
					};
					const [scene] = (
						window as unknown as { __scenes: { traverse(visit: (node: Node) => void): void }[] }
					).__scenes;
					if (!scene) return null;
					let camera: Node | undefined;
					let cover: Node | undefined;
					scene.traverse((node) => {
						if (node.isCamera) camera = node;
						if (node.isMesh && node.material?.name === 'Architexture.001') cover = node;
					});
					if (!camera || !cover?.geometry) return null;
					cover.geometry.computeBoundingBox();
					const { max, min } = cover.geometry.boundingBox!;
					const canvas = document.querySelector('.home-entry-page canvas')!.getBoundingClientRect();
					const corner = (x: number, y: number) => {
						const point = cover!
							.localToWorld(new cover!.position.constructor(x, y, max.z))
							.project(camera);
						return [
							canvas.left + ((point.x + 1) / 2) * canvas.width,
							canvas.top + ((1 - point.y) / 2) * canvas.height
						];
					};
					const corners = [
						corner(min.x, max.y),
						corner(max.x, max.y),
						corner(max.x, min.y),
						corner(min.x, min.y)
					];
					const xs = corners.map(([x]) => x);
					const ys = corners.map(([, y]) => y);
					return {
						cx: (Math.min(...xs) + Math.max(...xs)) / 2,
						cy: (Math.min(...ys) + Math.max(...ys)) / 2,
						height: Math.max(...ys) - Math.min(...ys),
						width: Math.max(...xs) - Math.min(...xs)
					};
				});
			const expected = {
				cx: spot.cx,
				cy: spot.cy,
				height: spotBox.height,
				width: spotBox.width
			};
			/** How far, in CSS px, a box on screen is from the spot. */
			const offSpot = (box: typeof expected | null) =>
				box
					? Math.max(
							...(Object.keys(expected) as (keyof typeof expected)[]).map((side) =>
								Math.abs(box[side] - expected[side])
							)
						)
					: Infinity;
			await expect.poll(async () => offSpot(await roomBook()), { timeout: 15_000 }).toBeLessThan(2);

			// No veil drops over it: the book shows in its own cloth.
			const [red, , blue] = await colourAt(page, spot.cx - 4, spot.cy - 4);
			expect(red - blue).toBeGreaterThan(15);
			const roomDesk = await Promise.all(deskPoints.map(([x, y]) => colourAt(page, x, y)));

			for (const route of heldRoutes) await route.continue();
			await page.unroute('**/draw/__data.json*');
			await expect(page).toHaveURL(/\/draw$/);

			// The studio's closed book lies on the same spot…
			const cover = page.getByRole('button', { name: 'Open sketchbook' });
			await expect
				.poll(async () =>
					offSpot(
						await cover.evaluate((element) => {
							const box = element.getBoundingClientRect();
							return {
								cx: box.left + box.width / 2,
								cy: box.top + box.height / 2,
								height: box.height,
								width: box.width
							};
						})
					)
				)
				.toBeLessThan(2);

			// …on a desk drawn from the same room: what lies round it matches.
			await expect
				.poll(() => page.evaluate(() => [...document.images].every((image) => image.complete)))
				.toBe(true);
			const studioDesk = await Promise.all(deskPoints.map(([x, y]) => colourAt(page, x, y)));
			studioDesk.forEach((colour, point) => {
				colour.forEach((channel, index) => {
					expect(Math.abs(channel - roomDesk[point][index])).toBeLessThan(14);
				});
			});
		});

		test('closes the book straight back onto its spot on the way out of the studio', async ({
			page
		}) => {
			// The room's data waits, so the studio stays on screen to be watched.
			await page.route('**/__data.json*', (route) => {
				if (new URL(route.request().url()).pathname === '/__data.json') return;
				return route.continue();
			});
			await page.goto('/draw');
			await page.getByRole('button', { name: 'Open sketchbook' }).click();
			await expect(page.getByPlaceholder('Untitled genius')).toBeEnabled();
			await page.waitForTimeout(1_000);

			// Where the drawing's centre is, every frame, from Exit Studio until
			// the book has lain closed for a while.
			const sampling = page.evaluate(
				() =>
					new Promise<number[]>((resolve) => {
						const canvas = document.querySelector('[aria-label="Drawing canvas"]')!;
						const centres: number[] = [];
						const start = performance.now();
						const sample = () => {
							const box = canvas.getBoundingClientRect();
							centres.push(box.left + box.width / 2);
							if (performance.now() - start < 2_200) requestAnimationFrame(sample);
							else resolve(centres);
						};
						requestAnimationFrame(sample);
					})
			);
			await page.getByRole('link', { name: /Exit Studio/ }).click();
			const centres = await sampling;

			// It travels from the open book's place to the spot and no further.
			const [open, closed] = [centres[0], centres.at(-1)!];
			expect(Math.max(...centres)).toBeLessThanOrEqual(Math.max(open, closed) + 2);
			expect(Math.min(...centres)).toBeGreaterThanOrEqual(Math.min(open, closed) - 2);
		});
	});
});
