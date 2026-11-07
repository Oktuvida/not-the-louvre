import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	createEmptyDrawingDocument,
	normalizeDrawingDocumentToEditableV2,
	type DrawingDocumentV2,
	type DrawingStroke
} from '#lib/features/stroke-json/document.js';
import { drawingTools } from '#lib/features/studio-drawing/state/drawing.svelte.js';
import DrawingCanvasHarness from './DrawingCanvasHarness.svelte';

/*
 * The studio canvas, judged by what a visitor gets: the stroke that is kept
 * when they lift the pen, and the ink they can see on the canvas while they
 * draw. Synthetic pointers cannot hold a pointer capture, so capture is the
 * one browser call stood in for.
 */

const BACKGROUND = [253, 251, 247];
// The studio's default colour (#1a1a1a) and the seeded strokes' (#2d2420).
const INK = [26, 26, 26];
const SEED_INK = [45, 36, 32];

const seededDocument = (points: [number, number][]) =>
	normalizeDrawingDocumentToEditableV2({
		...createEmptyDrawingDocument('artwork'),
		strokes: [{ color: '#2d2420', points, size: 8 }]
	});

const renderCanvas = async (
	props: Record<string, unknown> = {},
	options: { scale?: number; size?: number } = {}
) => {
	const committed: DrawingStroke[] = [];
	const documents: DrawingDocumentV2[] = [];
	let controls: { redo(): boolean; undo(): boolean } | undefined;

	const rendered = await render(DrawingCanvasHarness, {
		onControls: (handle: NonNullable<typeof controls>) => {
			controls = handle;
		},
		onDocumentChange: (document: DrawingDocumentV2) => {
			documents.push(document);
		},
		onStrokeCommitted: ({ stroke }: { stroke: DrawingStroke }) => {
			committed.push(stroke);
		},
		scale: options.scale ?? 1,
		size: options.size ?? 384,
		...props
	});

	const canvas = page
		.getByLabelText(typeof props.label === 'string' ? props.label : 'Drawing canvas')
		.element() as HTMLCanvasElement;

	/** Client coordinates for a point in document pixels (the canvas is 768 wide). */
	const at = (x: number, y: number) => {
		const rect = canvas.getBoundingClientRect();
		const width = rect.width - (canvas.offsetWidth - canvas.clientWidth);
		const height = rect.height - (canvas.offsetHeight - canvas.clientHeight);
		return {
			clientX: rect.left + canvas.clientLeft + (x * width) / 768,
			clientY: rect.top + canvas.clientTop + (y * height) / 768
		};
	};

	const pointer = (
		type: string,
		point: [number, number],
		init: PointerEventInit & { coalesced?: [number, number][]; predicted?: [number, number][] } = {}
	) => {
		const { coalesced, predicted, ...rest } = init;
		const base = {
			bubbles: true,
			buttons: type === 'pointerup' ? 0 : 1,
			isPrimary: true,
			pointerId: 1,
			pointerType: 'mouse',
			...rest
		};
		const sample = ([x, y]: [number, number]) => new PointerEvent(type, { ...base, ...at(x, y) });
		return new PointerEvent(type, {
			...base,
			...at(...point),
			coalescedEvents: coalesced?.map(sample),
			predictedEvents: predicted?.map(sample)
		});
	};

	const draw = (...points: [number, number][]) => {
		const [first, ...rest] = points;
		canvas.dispatchEvent(pointer('pointerdown', first!));
		for (const point of rest) canvas.dispatchEvent(pointer('pointermove', point));
		canvas.dispatchEvent(pointer('pointerup', points.at(-1)!));
	};

	/** The colour on screen at a point in document pixels. */
	const colourAt = (x: number, y: number) => {
		const context = canvas.getContext('2d')!;
		const data = context.getImageData(
			Math.floor((x * canvas.width) / 768),
			Math.floor((y * canvas.height) / 768),
			1,
			1
		).data;
		return [data[0], data[1], data[2]];
	};

	const history = {
		redo: () => controls!.redo(),
		undo: () => controls!.undo()
	};

	const rerender = (next: Record<string, unknown>) => rendered.rerender(next);

	return { at, canvas, colourAt, committed, documents, draw, history, pointer, rerender };
};

describe('DrawingCanvas', () => {
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, 'setPointerCapture').mockImplementation(() => {});
		vi.spyOn(HTMLCanvasElement.prototype, 'releasePointerCapture').mockImplementation(() => {});
		vi.spyOn(HTMLCanvasElement.prototype, 'hasPointerCapture').mockReturnValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(window, 'devicePixelRatio');
	});

	// Clearing the page on its sheet tears that sheet off: the drawing goes
	// with it, flying off, and a clean sheet is left in its place.
	it('tears the old sheet off with the drawing on it, leaving a clean one', async () => {
		const { canvas, colourAt, draw, rerender } = await renderCanvas({ sheet: true });
		draw([200, 384], [384, 384], [560, 384]);
		await vi.waitFor(() => expect(colourAt(384, 384)).toEqual(INK));

		await rerender({ clearVersion: 1, sheet: true });

		// The page is clean at once…
		await vi.waitFor(() => expect(colourAt(384, 384)).toEqual(BACKGROUND));
		// …while a copy of the old drawing is carried off and then let go.
		const torn = [...document.querySelectorAll('canvas')].find(
			(element) => element !== canvas && element.getAttribute('aria-hidden') === 'true'
		) as HTMLCanvasElement | undefined;
		expect(torn).toBeDefined();
		const [, , , alpha] = torn!
			.getContext('2d')!
			.getImageData(Math.floor(torn!.width / 2), Math.floor(torn!.height / 2), 1, 1).data;
		expect(alpha).toBeGreaterThan(0);
		await vi.waitFor(() => expect(torn!.isConnected).toBe(false), { timeout: 3000 });
	});

	it('renders product-facing status messaging below the canvas', async () => {
		await renderCanvas({
			statusMessage: 'Artwork published as Untitled #0001',
			statusTone: 'success'
		});

		await expect.element(page.getByText('Artwork published as Untitled #0001')).toBeVisible();
	});

	it('keeps the line a visitor draws once they lift the pointer, and only then', async () => {
		const { canvas, committed, documents, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [100, 100]));
		canvas.dispatchEvent(pointer('pointermove', [160, 140]));
		canvas.dispatchEvent(pointer('pointermove', [220, 200]));
		const strokesWhileDrawing = documents.at(-1)?.tail.length ?? 0;
		canvas.dispatchEvent(pointer('pointerup', [220, 200]));

		expect(strokesWhileDrawing).toBe(0);
		expect(committed).toHaveLength(1);
		expect(committed[0]?.points).toEqual([
			[100, 100],
			[160, 140],
			[220, 200]
		]);
		expect(documents.at(-1)?.tail).toEqual([committed[0]]);
	});

	it('shows the ink under the pointer while the line is still being drawn', async () => {
		const { canvas, colourAt, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [100, 400]));
		canvas.dispatchEvent(pointer('pointermove', [600, 400]));

		await vi.waitFor(() => expect(colourAt(350, 400)).toEqual(INK));
		expect(colourAt(350, 600)).toEqual(BACKGROUND);
	});

	it('draws at the screen’s own pixel density, up to a cap', async () => {
		Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
		const { canvas, colourAt, draw } = await renderCanvas({}, { size: 300 });

		await vi.waitFor(() => expect(canvas.width).toBe(600));
		draw([100, 400], [600, 400]);
		await vi.waitFor(() => expect(colourAt(350, 400)).toEqual(INK));
		expect(colourAt(350, 420)).toEqual(BACKGROUND);
	});

	it('stays sharp through the sketchbook scaling it on its way open', async () => {
		Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
		const { canvas, rerender } = await renderCanvas({}, { scale: 0.5, size: 300 });

		// Shown smaller than its layout: never fewer pixels than the layout.
		await vi.waitFor(() => expect(canvas.width).toBe(600));

		// The book settles larger than its layout once its transition ends.
		await rerender({ scale: 1.5 });
		canvas.dispatchEvent(new Event('transitionend', { bubbles: true }));
		await vi.waitFor(() => expect(canvas.width).toBe(900));
	});

	it('never grows the canvas past 2048 pixels a side', async () => {
		Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
		const { canvas } = await renderCanvas({}, { size: 900 });

		await vi.waitFor(() => expect(canvas.width).toBe(2048));
		expect(canvas.height).toBe(2048);
	});

	it('keeps every sample the browser coalesced into one move', async () => {
		const { canvas, committed, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [100, 100]));
		canvas.dispatchEvent(
			pointer('pointermove', [130, 118], {
				coalesced: [
					[110, 104],
					[120, 110],
					[130, 118]
				]
			})
		);
		canvas.dispatchEvent(pointer('pointerup', [130, 118]));

		expect(committed[0]?.points).toEqual([
			[100, 100],
			[110, 104],
			[120, 110],
			[130, 118]
		]);
	});

	it('draws ahead of the pen with predicted samples but never keeps them', async () => {
		const { canvas, committed, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [100, 100]));
		canvas.dispatchEvent(pointer('pointermove', [140, 140], { predicted: [[200, 200]] }));
		canvas.dispatchEvent(pointer('pointerup', [140, 140]));

		expect(committed[0]?.points).toEqual([
			[100, 100],
			[140, 140]
		]);
	});

	// Every prediction used to land in the page's far corner, so an Apple Pencil
	// drew a line from the pen out to it until the stroke ended.
	it('draws the prediction just ahead of the pen, not out to the corner', async () => {
		const { canvas, pointer } = await renderCanvas();
		const overlay = [...canvas.parentElement!.querySelectorAll('canvas')].find(
			(candidate) => candidate !== canvas
		)!;
		const inkAt = (x: number, y: number) =>
			overlay
				.getContext('2d')!
				.getImageData(
					Math.floor((x * overlay.width) / 768),
					Math.floor((y * overlay.height) / 768),
					1,
					1
				).data[3];

		canvas.dispatchEvent(pointer('pointerdown', [100, 100]));
		canvas.dispatchEvent(pointer('pointermove', [140, 140], { predicted: [[150, 150]] }));

		await vi.waitFor(() => expect(inkAt(146, 146)).toBeGreaterThan(0));
		expect(inkAt(450, 450)).toBe(0);
		expect(inkAt(740, 740)).toBe(0);
	});

	it('ignores drawing input while interaction is disabled', async () => {
		const { colourAt, committed, draw } = await renderCanvas({ interactive: false });

		draw([100, 400], [600, 400]);

		expect(committed).toHaveLength(0);
		await vi.waitFor(() => expect(colourAt(350, 600)).toEqual(BACKGROUND));
		expect(colourAt(350, 400)).toEqual(BACKGROUND);
	});

	it('keeps drawing when the pointer leaves and comes back with the button held', async () => {
		const { canvas, committed, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [24, 24]));
		canvas.dispatchEvent(pointer('pointermove', [80, 80]));
		canvas.dispatchEvent(pointer('pointermove', [900, 900]));
		canvas.dispatchEvent(pointer('pointermove', [120, 120]));
		canvas.dispatchEvent(pointer('pointerup', [120, 120]));

		expect(committed[0]?.points).toEqual([
			[24, 24],
			[80, 80],
			[120, 120]
		]);
	});

	it('ends the line when the mouse is released outside the canvas', async () => {
		const { canvas, committed, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [24, 24]));
		canvas.dispatchEvent(pointer('pointermove', [80, 80]));
		window.dispatchEvent(pointer('pointerup', [80, 80]));
		canvas.dispatchEvent(pointer('pointermove', [120, 120], { buttons: 0 }));

		expect(committed).toHaveLength(1);
		expect(committed[0]?.points).toEqual([
			[24, 24],
			[80, 80]
		]);
	});

	it('keeps the line when a move arrives with the mouse button already released', async () => {
		const { canvas, committed, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [24, 24]));
		canvas.dispatchEvent(pointer('pointermove', [80, 80]));
		// A mouse released outside the window never delivers a pointerup here.
		canvas.dispatchEvent(pointer('pointermove', [120, 120], { buttons: 0 }));
		canvas.dispatchEvent(pointer('pointermove', [160, 160], { buttons: 0 }));

		expect(committed).toHaveLength(1);
		expect(committed[0]?.points).toEqual([
			[24, 24],
			[80, 80]
		]);
	});

	it('paints the drawing it was opened with', async () => {
		const { colourAt, documents } = await renderCanvas({
			initialDrawingDocument: seededDocument([
				[100, 300],
				[600, 300]
			])
		});

		await vi.waitFor(() => expect(colourAt(350, 300)).toEqual(SEED_INK));
		expect(documents.at(-1)?.tail).toHaveLength(1);
	});

	it('adds a new line on top of a fork seed with every sample it was drawn with', async () => {
		const { committed, documents, draw } = await renderCanvas({
			initialDrawingDocument: seededDocument([
				[24, 24],
				[200, 200]
			])
		});

		draw([100, 100], [101, 101], [102, 102]);

		expect(committed[0]?.points).toEqual([
			[100, 100],
			[101, 101],
			[102, 102]
		]);
		expect(documents.at(-1)?.tail).toHaveLength(2);
	});

	it('ignores a press that starts outside the drawing and draws the next one cleanly', async () => {
		const { canvas, committed, pointer } = await renderCanvas();

		canvas.dispatchEvent(pointer('pointerdown', [-10, 24]));
		canvas.dispatchEvent(pointer('pointerup', [-10, 24]));
		canvas.dispatchEvent(pointer('pointerdown', [24, 24]));
		canvas.dispatchEvent(pointer('pointermove', [80, 80]));
		canvas.dispatchEvent(pointer('pointerup', [80, 80]));

		expect(HTMLCanvasElement.prototype.setPointerCapture).toHaveBeenCalledTimes(1);
		expect(committed).toHaveLength(1);
		expect(committed[0]?.points).toEqual([
			[24, 24],
			[80, 80]
		]);
	});

	it('takes the last line off the canvas and puts it back', async () => {
		const { colourAt, documents, draw, history } = await renderCanvas();
		draw([100, 300], [600, 300]);
		draw([100, 500], [600, 500]);
		await vi.waitFor(() => expect(colourAt(350, 500)).toEqual(INK));

		expect(history.undo()).toBe(true);
		await vi.waitFor(() => expect(colourAt(350, 500)).toEqual(BACKGROUND));
		expect(colourAt(350, 300)).toEqual(INK);
		expect(documents.at(-1)?.tail).toHaveLength(1);

		expect(history.redo()).toBe(true);
		await vi.waitFor(() => expect(colourAt(350, 500)).toEqual(INK));
		expect(documents.at(-1)?.tail).toHaveLength(2);
		expect(history.redo()).toBe(false);
	});

	it('undoes far back through a long drawing and paints what is left exactly', async () => {
		const { colourAt, documents, draw, history } = await renderCanvas();
		for (let line = 0; line < 45; line += 1) {
			draw([20, 20 + line * 16], [740, 20 + line * 16]);
		}

		for (let step = 0; step < 40; step += 1) history.undo();

		await vi.waitFor(() => expect(colourAt(380, 20 + 5 * 16)).toEqual(BACKGROUND));
		expect(colourAt(380, 20 + 4 * 16)).toEqual(INK);
		expect(documents.at(-1)?.tail).toHaveLength(5);
	});

	it('forgets what could be redone once a new line is drawn', async () => {
		const { documents, draw, history } = await renderCanvas();
		draw([100, 300], [600, 300]);
		history.undo();

		draw([100, 500], [600, 500]);

		expect(history.redo()).toBe(false);
		expect(documents.at(-1)?.tail).toHaveLength(1);
	});

	it('never undoes the drawing it was opened with', async () => {
		const { documents, draw, history } = await renderCanvas({
			initialDrawingDocument: seededDocument([
				[24, 24],
				[200, 200]
			])
		});
		draw([100, 300], [600, 300]);

		expect(history.undo()).toBe(true);
		expect(history.undo()).toBe(false);
		expect(documents.at(-1)?.tail).toHaveLength(1);
	});

	describe('pens and fingers', () => {
		const touch = (type: string, id: number, point: [number, number]) => ({
			buttons: type === 'pointerup' ? 0 : 1,
			isPrimary: id === 11,
			pointerId: id,
			pointerType: 'touch',
			type,
			point
		});

		const fire = (
			canvas: HTMLCanvasElement,
			pointer: (type: string, point: [number, number], init?: PointerEventInit) => PointerEvent,
			...events: ReturnType<typeof touch>[]
		) => {
			for (const { point, type, ...init } of events)
				canvas.dispatchEvent(pointer(type, point, init));
		};

		it('stops fingers drawing once a pen has touched the canvas, so a resting palm leaves no mark', async () => {
			const { canvas, committed, pointer } = await renderCanvas();

			canvas.dispatchEvent(pointer('pointerdown', [100, 100], { pointerType: 'pen' }));
			canvas.dispatchEvent(pointer('pointermove', [200, 200], { pointerType: 'pen' }));
			canvas.dispatchEvent(pointer('pointerup', [200, 200], { pointerType: 'pen' }));
			fire(
				canvas,
				pointer,
				touch('pointerdown', 11, [300, 600]),
				touch('pointermove', 11, [500, 650]),
				touch('pointerup', 11, [500, 650])
			);

			expect(committed).toHaveLength(1);
			await expect
				.element(page.getByRole('button', { name: 'Pen only' }))
				.toHaveAttribute('aria-pressed', 'true');
		});

		it('lets fingers draw again when pen-only is switched off', async () => {
			const { canvas, committed, pointer } = await renderCanvas();
			canvas.dispatchEvent(pointer('pointerdown', [100, 100], { pointerType: 'pen' }));
			canvas.dispatchEvent(pointer('pointerup', [100, 100], { pointerType: 'pen' }));

			await page.getByRole('button', { name: 'Pen only' }).click();
			fire(
				canvas,
				pointer,
				touch('pointerdown', 11, [300, 600]),
				touch('pointermove', 11, [500, 650]),
				touch('pointerup', 11, [500, 650])
			);

			expect(committed).toHaveLength(2);
		});

		it('takes back the last line with a two-finger tap and puts it back with three', async () => {
			const { canvas, documents, draw, pointer } = await renderCanvas();
			draw([100, 300], [600, 300]);

			fire(
				canvas,
				pointer,
				touch('pointerdown', 11, [300, 400]),
				touch('pointerdown', 12, [400, 400]),
				touch('pointerup', 11, [300, 400]),
				touch('pointerup', 12, [400, 400])
			);
			expect(documents.at(-1)?.tail).toHaveLength(0);

			fire(
				canvas,
				pointer,
				touch('pointerdown', 11, [300, 400]),
				touch('pointerdown', 12, [400, 400]),
				touch('pointerdown', 13, [500, 400]),
				touch('pointerup', 11, [300, 400]),
				touch('pointerup', 12, [400, 400]),
				touch('pointerup', 13, [500, 400])
			);
			expect(documents.at(-1)?.tail).toHaveLength(1);
		});

		it('drops the line a finger started when a second finger joins it straight away', async () => {
			const { canvas, committed, pointer } = await renderCanvas();

			fire(
				canvas,
				pointer,
				touch('pointerdown', 11, [300, 400]),
				touch('pointermove', 11, [320, 420]),
				touch('pointerdown', 12, [500, 400]),
				touch('pointermove', 11, [360, 480]),
				touch('pointermove', 12, [560, 480]),
				touch('pointerup', 11, [360, 480]),
				touch('pointerup', 12, [560, 480])
			);

			expect(committed).toHaveLength(0);
		});

		it('keeps the long press and the magnifier off the canvas', async () => {
			const { canvas } = await renderCanvas();
			const touchstart = new Event('touchstart', { bubbles: true, cancelable: true });

			canvas.dispatchEvent(touchstart);

			expect(touchstart.defaultPrevented).toBe(true);
		});
	});

	describe('zooming and panning', () => {
		/** Client coordinates relative to the canvas frame, which does not zoom. */
		const frame = (canvas: HTMLCanvasElement) =>
			canvas.closest('[data-canvas-frame]')!.getBoundingClientRect();

		const pinch = (
			canvas: HTMLCanvasElement,
			from: { centre: [number, number]; spread: number },
			to: { centre: [number, number]; spread: number }
		) => {
			const box = frame(canvas);
			const fingerAt = (centre: [number, number], spread: number, side: -1 | 1) => ({
				clientX: box.left + centre[0] + (side * spread) / 2,
				clientY: box.top + centre[1]
			});
			const event = (type: string, id: number, point: { clientX: number; clientY: number }) =>
				new PointerEvent(type, {
					bubbles: true,
					buttons: type === 'pointerup' ? 0 : 1,
					isPrimary: id === 21,
					pointerId: id,
					pointerType: 'touch',
					...point
				});

			canvas.dispatchEvent(event('pointerdown', 21, fingerAt(from.centre, from.spread, -1)));
			canvas.dispatchEvent(event('pointerdown', 22, fingerAt(from.centre, from.spread, 1)));
			for (const step of [0.5, 1]) {
				const centre: [number, number] = [
					from.centre[0] + (to.centre[0] - from.centre[0]) * step,
					from.centre[1] + (to.centre[1] - from.centre[1]) * step
				];
				const spread = from.spread + (to.spread - from.spread) * step;
				canvas.dispatchEvent(event('pointermove', 21, fingerAt(centre, spread, -1)));
				canvas.dispatchEvent(event('pointermove', 22, fingerAt(centre, spread, 1)));
			}
			canvas.dispatchEvent(event('pointerup', 21, fingerAt(to.centre, to.spread, -1)));
			canvas.dispatchEvent(event('pointerup', 22, fingerAt(to.centre, to.spread, 1)));
		};

		it('zooms in around two fingers spreading apart', async () => {
			const { canvas } = await renderCanvas();
			const before = canvas.getBoundingClientRect();
			// The document point under the fingers before the pinch.
			const box = frame(canvas);
			const underFingers = (rect: DOMRect) => (box.left + 192 - rect.left) / rect.width;
			const pointBefore = underFingers(before);

			pinch(canvas, { centre: [192, 192], spread: 100 }, { centre: [192, 192], spread: 200 });

			await vi.waitFor(() =>
				expect(canvas.getBoundingClientRect().width).toBeCloseTo(before.width * 2, 0)
			);
			expect(underFingers(canvas.getBoundingClientRect())).toBeCloseTo(pointBefore, 2);
		});

		it('lands a line drawn while zoomed in exactly where the pen is', async () => {
			const { canvas, committed, draw } = await renderCanvas();
			pinch(canvas, { centre: [192, 192], spread: 100 }, { centre: [192, 192], spread: 300 });
			await vi.waitFor(() => expect(canvas.getBoundingClientRect().width).toBeGreaterThan(384 * 2));

			draw([380, 380], [400, 390]);

			expect(committed.at(-1)?.points).toEqual([
				[380, 380],
				[400, 390]
			]);
		});

		it('fills the frame again when pinched in past the fit, or from the zoom stamp', async () => {
			const { canvas } = await renderCanvas();
			pinch(canvas, { centre: [192, 192], spread: 100 }, { centre: [192, 192], spread: 250 });
			await expect.element(page.getByRole('button', { name: /fit canvas/i })).toBeVisible();

			pinch(canvas, { centre: [192, 192], spread: 250 }, { centre: [192, 192], spread: 40 });
			await vi.waitFor(() => expect(canvas.getBoundingClientRect().width).toBeCloseTo(384, 0));

			pinch(canvas, { centre: [100, 100], spread: 100 }, { centre: [100, 100], spread: 250 });
			await page.getByRole('button', { name: /fit canvas/i }).click();
			await vi.waitFor(() => expect(canvas.getBoundingClientRect().width).toBeCloseTo(384, 0));
			await expect
				.element(page.getByRole('button', { name: /fit canvas/i }))
				.not.toBeInTheDocument();
		});

		it('stamps on the drawing how far in it is zoomed, and fits the canvas from the stamp', async () => {
			const { canvas } = await renderCanvas();
			pinch(canvas, { centre: [192, 192], spread: 100 }, { centre: [192, 192], spread: 250 });

			const stamp = page.getByRole('button', { name: /fit canvas/i });
			await expect.element(stamp).toHaveTextContent('250%');

			pinch(canvas, { centre: [192, 192], spread: 250 }, { centre: [192, 192], spread: 300 });
			await expect.element(stamp).toHaveTextContent('300%');

			await stamp.click();
			await vi.waitFor(() => expect(canvas.getBoundingClientRect().width).toBeCloseTo(384, 0));
			await expect.element(stamp).not.toBeInTheDocument();
		});

		it('paints the extra pixels a zoomed-in canvas covers', async () => {
			const { canvas } = await renderCanvas();
			await vi.waitFor(() => expect(canvas.width).toBe(384));

			pinch(canvas, { centre: [192, 192], spread: 100 }, { centre: [192, 192], spread: 300 });

			await vi.waitFor(() => expect(canvas.width).toBe(1152));
		});

		it('zooms with a trackpad pinch', async () => {
			const { canvas } = await renderCanvas();
			const box = frame(canvas);

			const wheel = new WheelEvent('wheel', {
				bubbles: true,
				cancelable: true,
				clientX: box.left + 192,
				clientY: box.top + 192,
				ctrlKey: true,
				deltaY: -50
			});
			canvas.dispatchEvent(wheel);

			// The browser must not zoom the whole page as well.
			expect(wheel.defaultPrevented).toBe(true);
			await vi.waitFor(() =>
				expect(canvas.getBoundingClientRect().width).toBeGreaterThan(384 * 1.2)
			);
		});
	});

	describe('ink', () => {
		it('takes no new line once the ink is gone, and says so', async () => {
			const onOutOfInk = vi.fn();
			const { committed, draw } = await renderCanvas({ inkLimits: { maxStrokes: 1 }, onOutOfInk });

			draw([100, 300], [600, 300]);
			draw([100, 500], [600, 500]);

			expect(committed).toHaveLength(1);
			expect(onOutOfInk).toHaveBeenCalledOnce();
		});

		it('keeps a line that runs dry part way, up to the last drop', async () => {
			const onOutOfInk = vi.fn();
			const { committed, draw } = await renderCanvas({
				inkLimits: { maxTotalPoints: 4 },
				onOutOfInk
			});

			draw([100, 100], [120, 100], [140, 100], [160, 100], [180, 100], [200, 100]);

			expect(committed).toHaveLength(1);
			expect(committed[0]?.points).toEqual([
				[100, 100],
				[120, 100],
				[140, 100],
				[160, 100]
			]);
			expect(onOutOfInk).toHaveBeenCalledOnce();
		});

		it('carries a very long line on as a new one past the most a line may hold', async () => {
			const { committed, draw } = await renderCanvas({ inkLimits: { maxPointsPerStroke: 3 } });

			draw([100, 100], [120, 100], [140, 100], [160, 100], [180, 100], [200, 100]);

			expect(committed.map((stroke) => stroke.points)).toEqual([
				[
					[100, 100],
					[120, 100],
					[140, 100]
				],
				[
					[140, 100],
					[160, 100],
					[180, 100]
				],
				[
					[180, 100],
					[200, 100]
				]
			]);
		});
	});

	describe('on another surface', () => {
		it('draws with the colour and size it is handed instead of the studio’s', async () => {
			const { committed, draw } = await renderCanvas({ strokeColor: '#6b8e7f', strokeSize: 14 });

			draw([100, 300], [600, 300]);

			expect(committed[0]).toMatchObject({ color: '#6b8e7f', size: 14 });
		});

		it('shows its own paper and guides that never become part of the drawing', async () => {
			const { colourAt, documents } = await renderCanvas({
				decorate: (context: CanvasRenderingContext2D) => {
					context.fillStyle = '#ff0000';
					context.fillRect(0, 0, 100, 100);
				},
				label: 'Avatar drawing canvas',
				paper: '#ffffff'
			});

			await vi.waitFor(() => expect(colourAt(50, 50)).toEqual([255, 0, 0]));
			expect(colourAt(400, 400)).toEqual([255, 255, 255]);
			expect(documents.at(-1)?.tail ?? []).toHaveLength(0);
		});
	});

	describe('what a stroke remembers', () => {
		it('records when each point was drawn, with what, and to a quarter of a pixel', async () => {
			const { canvas, committed, pointer } = await renderCanvas();

			canvas.dispatchEvent(pointer('pointerdown', [100.25, 100.5]));
			canvas.dispatchEvent(pointer('pointermove', [120.75, 110]));
			canvas.dispatchEvent(pointer('pointerup', [120.75, 110]));
			canvas.dispatchEvent(pointer('pointerdown', [300, 300]));
			canvas.dispatchEvent(pointer('pointerup', [300, 300]));

			const [first, second] = committed;
			expect(first).toMatchObject({
				brush: 'round@1',
				pointer: 'mouse',
				points: [
					[100.25, 100.5],
					[120.75, 110]
				],
				start: 0
			});
			expect(first?.times).toHaveLength(2);
			expect(first?.times?.[0]).toBe(0);
			expect(first!.times![1]).toBeGreaterThanOrEqual(0);
			expect(first).not.toHaveProperty('pressures');
			expect(second?.start).toBeGreaterThanOrEqual(0);
		});

		it('keeps a pen’s pressure when the pen really reports one', async () => {
			const { canvas, committed, pointer } = await renderCanvas();
			const pen = (pressure: number) => ({ pointerType: 'pen', pressure });

			canvas.dispatchEvent(pointer('pointerdown', [100, 100], pen(0.3)));
			canvas.dispatchEvent(pointer('pointermove', [140, 120], pen(0.6)));
			canvas.dispatchEvent(pointer('pointerup', [140, 120], pen(0)));

			// Kept in the ten bits the document stores.
			const tenBits = (pressure: number) => Math.round(pressure * 1023) / 1023;
			expect(committed[0]).toMatchObject({
				brush: 'ink@1',
				pointer: 'pen',
				pressures: [tenBits(0.3), tenBits(0.6)]
			});
		});

		it('drops a pressure that is only a placeholder', async () => {
			const { canvas, committed, pointer } = await renderCanvas();
			// iOS fingers and many mice report a constant 0.5 or 0.
			const pen = { pointerType: 'pen', pressure: 0.5 };

			canvas.dispatchEvent(pointer('pointerdown', [100, 100], pen));
			canvas.dispatchEvent(pointer('pointermove', [140, 120], pen));
			canvas.dispatchEvent(pointer('pointerup', [140, 120], pen));

			expect(committed[0]).not.toHaveProperty('pressures');
			expect(committed[0]).toMatchObject({ brush: 'round@1' });
		});

		it('draws a pen line thin where it barely touches and thick where it presses', async () => {
			const { canvas, colourAt, pointer } = await renderCanvas();
			const xs = Array.from({ length: 41 }, (_, index) => 100 + index * 14);

			xs.forEach((x, index) =>
				canvas.dispatchEvent(
					pointer(index === 0 ? 'pointerdown' : 'pointermove', [x, 400], {
						pointerType: 'pen',
						pressure: 0.05 + (index / 40) * 0.95
					})
				)
			);
			canvas.dispatchEvent(pointer('pointerup', [xs.at(-1)!, 400], { pointerType: 'pen' }));

			// How far the ink reaches above the line, at the light and the heavy end.
			const reach = (x: number) => {
				let offset = 0;
				while (offset < 40 && colourAt(x, 400 - offset).join() !== BACKGROUND.join()) offset += 1;
				return offset;
			};
			// Painted (paper well away from the line) before anything is measured.
			await vi.waitFor(() => expect(colourAt(350, 600)).toEqual(BACKGROUND));
			expect(reach(600)).toBeGreaterThan(reach(160));
			expect(reach(160)).toBeGreaterThan(0);
		});

		it('names the eraser as such', async () => {
			drawingTools.tool = 'eraser';
			const { committed, draw } = await renderCanvas();

			draw([100, 300], [600, 300]);
			drawingTools.tool = 'brush';

			expect(committed[0]).toMatchObject({ brush: 'eraser@1', color: '#fdfbf7' });
		});
	});

	describe('drawing a fork', () => {
		// The parent's image: its left half #d66b4d, its right half #406c8f.
		const parentImage =
			'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2" viewBox="0 0 2 2"%3E%3Crect width="1" height="2" fill="%23d66b4d"/%3E%3Crect x="1" width="1" height="2" fill="%23406c8f"/%3E%3C/svg%3E';

		it('draws over the image of the artwork it was forked from, which undo never takes away', async () => {
			const { colourAt, documents, draw, history } = await renderCanvas({ backdrop: parentImage });

			await vi.waitFor(() => expect(colourAt(100, 400)).toEqual([0xd6, 0x6b, 0x4d]));
			expect(colourAt(668, 400)).toEqual([0x40, 0x6c, 0x8f]);

			draw([100, 200], [668, 200]);
			await vi.waitFor(() => expect(colourAt(384, 200)).toEqual(INK));
			// Only the fork's own line is in its drawing.
			expect(documents.at(-1)?.tail).toHaveLength(1);

			history.undo();
			expect(history.undo()).toBe(false);
			await vi.waitFor(() => expect(colourAt(384, 200)).not.toEqual(INK));
			expect(colourAt(100, 400)).toEqual([0xd6, 0x6b, 0x4d]);
		});
	});
});
