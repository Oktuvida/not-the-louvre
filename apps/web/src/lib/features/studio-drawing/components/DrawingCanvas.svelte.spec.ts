import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	createEmptyDrawingDocument,
	normalizeDrawingDocumentToEditableV2,
	type DrawingDocumentV2,
	type DrawingStroke
} from '#lib/features/stroke-json/document.js';
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
	options: { size?: number } = {}
) => {
	const committed: DrawingStroke[] = [];
	const documents: DrawingDocumentV2[] = [];

	await render(DrawingCanvasHarness, {
		onDocumentChange: (document: DrawingDocumentV2) => {
			documents.push(document);
		},
		onStrokeCommitted: ({ stroke }: { stroke: DrawingStroke }) => {
			committed.push(stroke);
		},
		size: options.size ?? 384,
		...props
	});

	const canvas = page.getByLabelText('Drawing canvas').element() as HTMLCanvasElement;

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

	return { at, canvas, colourAt, committed, documents, draw, pointer };
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
});
