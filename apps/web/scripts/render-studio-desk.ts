import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { STUDIO_DESK } from '../src/lib/features/shared-ui/studio-handoff';

/*
 * Photographs the studio's desk out of the home page's 3D room: the side
 * table, seen from where the Studio move ends, without its sketchbook (the
 * studio lays its own there). It writes src/lib/assets/studio-desk/, which
 * the studio page imports; shared-ui/studio-handoff.ts says how the two line
 * up.
 *
 * Run it by hand against a running dev server — `bun run dev`, then
 * `bun run studio:desk` (STUDIO_DESK_ORIGIN picks another server) — when the
 * room, its light or the hand-off changes. The images are committed: like the
 * og card, a design asset to review by eye, not rebuilt on every deploy.
 */

const origin = process.env.STUDIO_DESK_ORIGIN ?? 'http://localhost:5173';
const outputDirectory = resolve(process.cwd(), 'src/lib/assets/studio-desk');

/*
 * Pixels per CSS pixel of the reference camera. The studio draws the desk
 * about twice as big as the room draws it, so the large image has more
 * pixels than the room's own canvas (1.5 per CSS pixel) had for it.
 */
const DENSITY = 2.4;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
try {
	const page = await browser.newPage({
		deviceScaleFactor: DENSITY,
		viewport: { height: STUDIO_DESK.height, width: STUDIO_DESK.width }
	});
	await page.goto(`${origin}/demo/studio-desk?dpr=${DENSITY}`);
	// The root layout's own pieces (the record player) are not part of the room.
	await page.addStyleTag({
		content:
			'body * { visibility: hidden } [data-desk-state], [data-desk-state] * { visibility: visible }'
	});
	await page.locator('[data-desk-state="loaded"]').waitFor({ timeout: 120_000 });
	// The room fades in over 500ms, and the shadow map settles a frame later.
	await page.waitForTimeout(2_000);
	const photograph = await page.screenshot({ type: 'png' });

	await mkdir(outputDirectory, { recursive: true });
	const large = Math.round(STUDIO_DESK.width * DENSITY);
	for (const width of [large, large / 2]) {
		const resized = sharp(photograph).resize({ width });
		for (const [format, encode] of [
			['avif', (image: sharp.Sharp) => image.avif({ effort: 7, quality: 62 })],
			['webp', (image: sharp.Sharp) => image.webp({ effort: 6, quality: 82 })]
		] as const) {
			const path = resolve(outputDirectory, `desk-${width}.${format}`);
			await encode(resized.clone()).toFile(path);
			const { size } = await stat(path);
			console.log(`desk-${width}.${format}: ${(size / 1024).toFixed(1)} KB`);
		}
	}
} finally {
	await browser.close();
}
