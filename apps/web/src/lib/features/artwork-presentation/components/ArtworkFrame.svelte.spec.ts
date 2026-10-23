import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { paintSpy } = vi.hoisted(() => ({ paintSpy: vi.fn() }));

vi.mock(
	'#lib/features/artwork-presentation/canvas/artwork-frame-canvas.js',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('#lib/features/artwork-presentation/canvas/artwork-frame-canvas.js')
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

const canvasOf = (testId: string) => {
	const canvas = page.getByTestId(testId).element().querySelector('canvas');
	if (!(canvas instanceof HTMLCanvasElement)) throw new Error('frame canvas is missing');
	return canvas;
};

/* One armed `(resolution: …dppx)` listener, so the spec can watch the frame
 * re-arm itself as the ratio moves instead of waiting for a zoom it cannot
 * perform. */
type ArmedResolutionQuery = { fire: () => void; listenerCount: () => number; media: string };

const armedResolutionQueries: ArmedResolutionQuery[] = [];

const stubResolutionQueries = () => {
	armedResolutionQueries.length = 0;

	vi.stubGlobal('matchMedia', (media: string) => {
		const listeners = new Set<() => void>();

		armedResolutionQueries.push({
			fire: () => {
				for (const listener of [...listeners]) listener();
			},
			listenerCount: () => listeners.size,
			media
		});

		return {
			addEventListener: (_type: string, listener: () => void) => {
				listeners.add(listener);
			},
			matches: true,
			media,
			removeEventListener: (_type: string, listener: () => void) => {
				listeners.delete(listener);
			}
		} as unknown as MediaQueryList;
	});
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ArtworkFrame', () => {
	it('paints the frame bitmap exactly once per mount', async () => {
		paintSpy.mockClear();

		await render(ArtworkFrameHarness, { artworkId: 'artwork-single-paint', size: 132 });

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

		await render(ArtworkFrameHarness, { artworkId: 'artwork-shared-bitmap', count: 3, size: 148 });

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
		await render(ArtworkFrameHarness, { artworkId: 'artwork-ssr-geometry', size: 0 });

		const opening = openingOf('harness-frame-0');
		const inset = Number.parseFloat(opening.style.left);

		expect(inset).toBeGreaterThan(5);
		expect(inset).toBeLessThan(25);
		expect(Number.parseFloat(opening.style.width)).toBeCloseTo(100 - inset * 2, 6);
		expect(paintSpy).not.toHaveBeenCalled();
	});

	it('re-cuts the bitmap when the device pixel ratio changes on its own', async () => {
		paintSpy.mockClear();
		vi.stubGlobal('devicePixelRatio', 1);
		stubResolutionQueries();

		await render(ArtworkFrameHarness, { artworkId: 'artwork-dpr-repaint', size: 132 });

		await expect.element(page.getByTestId('harness-frame-0')).toBeVisible();
		await vi.waitFor(() => {
			expect(canvasOf('harness-frame-0').width).toBe(132);
		});

		expect(armedResolutionQueries).toHaveLength(1);
		expect(armedResolutionQueries[0]?.media).toBe('(resolution: 1dppx)');

		// Browser zoom: the ratio moves, every CSS box stays exactly where it
		// was, and the ResizeObserver is silent. Without the media-query listener
		// the canvas keeps its 1x bitmap and the frame renders soft.
		vi.stubGlobal('devicePixelRatio', 3);
		armedResolutionQueries[0]?.fire();

		await vi.waitFor(() => {
			expect(canvasOf('harness-frame-0').width).toBe(396);
		});

		const canvas = canvasOf('harness-frame-0');
		expect(canvas.height).toBe(396);
		// The CSS box is untouched: only the bitmap behind it got denser.
		expect(canvas.style.width).toBe('132px');

		// Re-armed at the new ratio, and the spent query released, so a second
		// zoom step is caught too.
		expect(armedResolutionQueries).toHaveLength(2);
		expect(armedResolutionQueries[1]?.media).toBe('(resolution: 3dppx)');
		expect(armedResolutionQueries[0]?.listenerCount()).toBe(0);
	});
});
