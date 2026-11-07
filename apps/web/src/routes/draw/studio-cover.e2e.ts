import { expect, test } from '@playwright/test';
import { deterministicAuthUser, resetDemoState } from '../demo/e2e-helpers';

// On a desk-shaped screen the drawing's notes lie on the inside of the
// sketchbook's cover, under the artist's bookplate. They are part of the
// cover, so they turn open with it, drawn in the same perspective, rather
// than popping up beside it once it has landed.

test.use({ viewport: { height: 860, width: 1512 } });

type Box = { height: number; width: number; x: number; y: number };

test.describe('the sketchbook’s cover', () => {
	test.beforeEach(async ({ baseURL, page, request }) => {
		await resetDemoState(request);
		const signUp = await page.request.post('/?/signUp', {
			form: deterministicAuthUser,
			headers: { origin: baseURL ?? '', 'x-sveltekit-action': 'true' }
		});
		expect(signUp.ok()).toBe(true);
	});

	test('carries the notes with it as it turns open', { tag: '@gpu' }, async ({ page }) => {
		await page.goto('/draw');
		const openCover = page.getByRole('button', { name: 'Open sketchbook' });
		await expect(openCover).toBeVisible();

		// Every frame from the click until the book has lain open a moment: the
		// inside of the cover, and the notes.
		const sampling = page.evaluate(
			() =>
				new Promise<{ cover: Box; notes: Box | null }[]>((resolve) => {
					const box = (element: Element | null) => {
						if (!element) return null;
						const { height, width, x, y } = element.getBoundingClientRect();
						return { height, width, x, y };
					};
					const frames: { cover: Box; notes: Box | null }[] = [];
					const start = performance.now();
					const sample = () => {
						frames.push({
							cover: box(document.querySelector('.cover-back-face'))!,
							notes: box(document.querySelector('[aria-label="About this drawing"]'))
						});
						if (performance.now() - start < 1_600) requestAnimationFrame(sample);
						else resolve(frames);
					};
					requestAnimationFrame(sample);
				})
		);
		await openCover.click();
		const frames = await sampling;

		const atRest = frames.at(-1)!.notes!;
		expect(atRest.width).toBeGreaterThan(150);

		// Turning, the notes are drawn foreshortened, as the cover is…
		const turning = frames.filter(
			({ notes }) => notes && notes.width > 0.1 * atRest.width && notes.width < 0.9 * atRest.width
		);
		expect(turning.length).toBeGreaterThan(2);

		// …and on every frame they lie on the cover.
		for (const { cover, notes } of frames) {
			if (!notes || notes.width === 0) continue;
			expect(notes.x).toBeGreaterThanOrEqual(cover.x - 2);
			expect(notes.x + notes.width).toBeLessThanOrEqual(cover.x + cover.width + 2);
			expect(notes.y).toBeGreaterThanOrEqual(cover.y - 2);
			expect(notes.y + notes.height).toBeLessThanOrEqual(cover.y + cover.height + 2);
		}

		await expect(page.getByPlaceholder('Untitled genius')).toBeEnabled();
	});
});
