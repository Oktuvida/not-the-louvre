import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { paintSpy } = vi.hoisted(() => ({ paintSpy: vi.fn() }));

vi.mock(
	'$lib/features/artwork-presentation/canvas/artwork-frame-canvas',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('$lib/features/artwork-presentation/canvas/artwork-frame-canvas')
			>();

		return {
			...actual,
			drawArtworkFrame: (
				...args: Parameters<typeof actual.drawArtworkFrame>
			): ReturnType<typeof actual.drawArtworkFrame> => {
				paintSpy(...args);
				return actual.drawArtworkFrame(...args);
			}
		};
	}
);

import ArtworkFrameHarness from './ArtworkFrameHarness.svelte';

const openingOf = (testId: string) => {
	const frame = page.getByTestId(testId).element();
	const opening = frame.querySelector('.artwork-opening');
	if (!(opening instanceof HTMLElement)) throw new Error('frame opening is missing');
	return opening;
};

describe('ArtworkFrame', () => {
	it('paints the frame bitmap exactly once per mount', async () => {
		paintSpy.mockClear();

		render(ArtworkFrameHarness, { artworkId: 'artwork-single-paint', size: 132 });

		await expect.element(page.getByTestId('harness-frame-0')).toBeVisible();
		await vi.waitFor(() => {
			expect(paintSpy).toHaveBeenCalledTimes(1);
		});

		// A rAF settles the ResizeObserver's initial callback; the memo guard has
		// to swallow it instead of repainting the canvas a second time.
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		expect(paintSpy).toHaveBeenCalledTimes(1);
	});

	it('reuses one painted bitmap for identical frames of the same size', async () => {
		paintSpy.mockClear();

		render(ArtworkFrameHarness, { artworkId: 'artwork-shared-bitmap', count: 3, size: 148 });

		await expect.element(page.getByTestId('harness-frame-2')).toBeVisible();
		await vi.waitFor(() => {
			expect(openingOf('harness-frame-2').style.left).toContain('%');
		});

		expect(paintSpy).toHaveBeenCalledTimes(1);
	});

	it('insets the opening before any measurement so SSR paints the real geometry', async () => {
		paintSpy.mockClear();

		// A zero-sized box never measures, which is exactly the server's
		// situation: the opening still has to come out of the preset's ratio
		// rather than filling the whole frame and snapping in at hydration.
		render(ArtworkFrameHarness, { artworkId: 'artwork-ssr-geometry', size: 0 });

		const opening = openingOf('harness-frame-0');
		const inset = Number.parseFloat(opening.style.left);

		expect(inset).toBeGreaterThan(5);
		expect(inset).toBeLessThan(25);
		expect(Number.parseFloat(opening.style.width)).toBeCloseTo(100 - inset * 2, 6);
		expect(paintSpy).not.toHaveBeenCalled();
	});
});
