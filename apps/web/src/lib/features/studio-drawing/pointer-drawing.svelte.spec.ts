import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createEmptyDrawingDocumentV2,
	normalizeDrawingDocumentToEditableV2,
	createEmptyDrawingDocument
} from '#lib/features/stroke-json/document.js';
import {
	attachPointerReleaseSafetyNet,
	ensureCommittedCacheCanvas,
	getCanvasDrawingPoint,
	hasLostPrimaryButton,
	isSameDrawingRenderSignature,
	readDrawingRenderSignature
} from './pointer-drawing';

const createCanvas = (width: number, height: number, rect: { width: number; height: number }) => {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
		bottom: rect.height,
		height: rect.height,
		left: 0,
		right: rect.width,
		top: 0,
		width: rect.width,
		x: 0,
		y: 0,
		toJSON: () => ({})
	} as DOMRect);

	return canvas;
};

const createPointerEvent = (type: string, init: PointerEventInit) =>
	new PointerEvent(type, { isPrimary: true, pointerId: 1, pointerType: 'mouse', ...init });

const createDocumentWithStroke = (points: [number, number][]) =>
	normalizeDrawingDocumentToEditableV2({
		...createEmptyDrawingDocument('artwork'),
		strokes: [{ color: '#2d2420', points, size: 8 }]
	});

describe('getCanvasDrawingPoint', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('scales client coordinates into the canvas pixel grid', () => {
		const canvas = createCanvas(768, 768, { width: 384, height: 384 });

		expect(
			getCanvasDrawingPoint(
				canvas,
				createPointerEvent('pointermove', { clientX: 96, clientY: 48 }),
				createEmptyDrawingDocumentV2('artwork')
			)
		).toEqual([192, 96]);
	});

	it('rejects a point outside the document bounds', () => {
		const canvas = createCanvas(768, 768, { width: 768, height: 768 });

		expect(
			getCanvasDrawingPoint(
				canvas,
				createPointerEvent('pointermove', { clientX: 900, clientY: 20 }),
				createEmptyDrawingDocumentV2('artwork')
			)
		).toBeNull();
	});
});

describe('hasLostPrimaryButton', () => {
	it('reports a mouse move that arrives with no button held', () => {
		expect(
			hasLostPrimaryButton(createPointerEvent('pointermove', { buttons: 0, pointerType: 'mouse' }))
		).toBe(true);
		expect(
			hasLostPrimaryButton(createPointerEvent('pointermove', { buttons: 1, pointerType: 'mouse' }))
		).toBe(false);
	});

	it('never truncates a pen or touch stroke that reports no buttons', () => {
		expect(
			hasLostPrimaryButton(createPointerEvent('pointermove', { buttons: 0, pointerType: 'pen' }))
		).toBe(false);
		expect(
			hasLostPrimaryButton(createPointerEvent('pointermove', { buttons: 0, pointerType: 'touch' }))
		).toBe(false);
	});
});

describe('ensureCommittedCacheCanvas', () => {
	it('creates the cache once and only resizes it when the surface changes', () => {
		const cache = ensureCommittedCacheCanvas(null, 768, 768);

		expect(cache.width).toBe(768);
		expect(cache.height).toBe(768);
		expect(ensureCommittedCacheCanvas(cache, 768, 768)).toBe(cache);

		const resized = ensureCommittedCacheCanvas(cache, 340, 340);
		expect(resized).toBe(cache);
		expect(resized.width).toBe(340);
		expect(resized.height).toBe(340);
	});
});

describe('attachPointerReleaseSafetyNet', () => {
	it('catches the releases the canvas never sees and detaches cleanly', () => {
		const onRelease = vi.fn();
		const detach = attachPointerReleaseSafetyNet(onRelease);

		window.dispatchEvent(createPointerEvent('pointerup', { bubbles: true, buttons: 0 }));
		window.dispatchEvent(createPointerEvent('pointercancel', { bubbles: true }));
		window.dispatchEvent(new Event('blur'));

		expect(onRelease).toHaveBeenCalledTimes(3);
		expect(onRelease).toHaveBeenLastCalledWith();

		detach();
		window.dispatchEvent(createPointerEvent('pointerup', { bubbles: true, buttons: 0 }));

		expect(onRelease).toHaveBeenCalledTimes(3);
	});
});

describe('drawing render signatures', () => {
	it('matches a repaint that would draw the very same frame', () => {
		const document = createDocumentWithStroke([
			[10, 10],
			[20, 20]
		]);
		const target = createCanvas(768, 768, { width: 768, height: 768 });
		const input = { activeStroke: null, document, responsive: false, target };

		expect(
			isSameDrawingRenderSignature(
				readDrawingRenderSignature(input),
				readDrawingRenderSignature(input)
			)
		).toBe(true);
	});

	it('separates a document that grew a point, a stroke, or an active stroke', () => {
		const target = createCanvas(768, 768, { width: 768, height: 768 });
		const document = createDocumentWithStroke([[10, 10]]);
		const rendered = readDrawingRenderSignature({
			activeStroke: null,
			document,
			responsive: false,
			target
		});

		document.tail.at(-1)?.points.push([20, 20]);
		expect(
			isSameDrawingRenderSignature(
				rendered,
				readDrawingRenderSignature({ activeStroke: null, document, responsive: false, target })
			)
		).toBe(false);

		expect(
			isSameDrawingRenderSignature(
				rendered,
				readDrawingRenderSignature({
					activeStroke: { color: '#2d2420', points: [[30, 30]], size: 8 },
					document,
					responsive: false,
					target
				})
			)
		).toBe(false);

		expect(
			isSameDrawingRenderSignature(
				rendered,
				readDrawingRenderSignature({
					activeStroke: null,
					document: createDocumentWithStroke([[10, 10]]),
					responsive: false,
					target
				})
			)
		).toBe(false);
	});
});
