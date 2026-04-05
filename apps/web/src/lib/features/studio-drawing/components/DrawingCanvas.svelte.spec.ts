import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	createEmptyDrawingDocument,
	normalizeDrawingDocumentToEditableV2,
	type DrawingDocumentV2
} from '$lib/features/stroke-json/document';
import DrawingCanvas from './DrawingCanvas.svelte';

const createLargeEditableArtworkDocument = () =>
	normalizeDrawingDocumentToEditableV2({
		...createEmptyDrawingDocument('artwork'),
		strokes: Array.from({ length: 72 }, (_, strokeIndex) => ({
			color: '#2d2420',
			points: Array.from(
				{ length: 24 },
				(_, pointIndex) =>
					[48 + pointIndex * 8, 80 + (((strokeIndex % 6) * 44 + pointIndex * 3) % 520)] as [
						number,
						number
					]
			),
			size: 8
		}))
	});

const createMockContext = () =>
	({
		arc: vi.fn(),
		beginPath: vi.fn(),
		drawImage: vi.fn(),
		fill: vi.fn(),
		fillRect: vi.fn(),
		fillStyle: '#fdfbf7',
		lineCap: 'round',
		lineJoin: 'round',
		lineTo: vi.fn(),
		lineWidth: 1,
		moveTo: vi.fn(),
		stroke: vi.fn(),
		strokeStyle: '#000000'
	}) as unknown as CanvasRenderingContext2D;

const createPointerEvent = (
	type: string,
	init: Partial<PointerEventInit> & { clientX?: number; clientY?: number; pointerId?: number }
) =>
	new PointerEvent(type, {
		bubbles: true,
		buttons: 1,
		clientX: init.clientX ?? 0,
		clientY: init.clientY ?? 0,
		isPrimary: true,
		pointerId: init.pointerId ?? 1,
		pointerType: 'mouse',
		...init
	});

describe('DrawingCanvas', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders product-facing status messaging below the canvas', async () => {
		render(DrawingCanvas, {
			statusMessage: 'Artwork published as Untitled #0001',
			statusTone: 'success'
		});

		await expect.element(page.getByText('Artwork published as Untitled #0001')).toBeVisible();
	});

	it('ignores drawing input while interaction is disabled', async () => {
		const ctx = createMockContext();
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: false });

		const canvas = document.querySelector('canvas');
		if (!canvas) {
			throw new Error('Expected drawing canvas to render');
		}

		vi.clearAllMocks();
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 24, clientY: 24 }));
		canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 80, clientY: 80 }));

		expect(ctx.beginPath).not.toHaveBeenCalled();
		expect(ctx.lineTo).not.toHaveBeenCalled();
		getContextSpy.mockRestore();
	});

	it('accepts drawing input once interaction is enabled', async () => {
		const ctx = createMockContext();
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: true });

		const canvas = document.querySelector('canvas');
		if (!canvas) {
			throw new Error('Expected drawing canvas to render');
		}
		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);

		vi.clearAllMocks();
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 24, clientY: 24 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 80, clientY: 80 }));
		canvas.dispatchEvent(createPointerEvent('pointerup', { buttons: 0, clientX: 80, clientY: 80 }));

		expect(ctx.beginPath).toHaveBeenCalled();
		expect(ctx.moveTo).toHaveBeenCalled();
		expect(ctx.lineTo).toHaveBeenCalled();
		expect(ctx.stroke).toHaveBeenCalled();
		getContextSpy.mockRestore();
	});

	it('keeps drawing when the pointer leaves and re-enters with the mouse still pressed', async () => {
		const ctx = createMockContext();
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: true });

		const canvas = document.querySelector('canvas');
		if (!canvas) {
			throw new Error('Expected drawing canvas to render');
		}
		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);

		vi.clearAllMocks();
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 24, clientY: 24 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 80, clientY: 80 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 900, clientY: 900 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 120, clientY: 120 }));

		expect(ctx.lineTo).toHaveBeenCalledTimes(3);
		getContextSpy.mockRestore();
	});

	it('stops drawing after the mouse is released outside the canvas', async () => {
		const ctx = createMockContext();
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: true });

		const canvas = document.querySelector('canvas');
		if (!canvas) {
			throw new Error('Expected drawing canvas to render');
		}
		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);

		vi.clearAllMocks();
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 24, clientY: 24 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 80, clientY: 80 }));
		window.dispatchEvent(createPointerEvent('pointerup', { buttons: 0, clientX: 80, clientY: 80 }));
		canvas.dispatchEvent(
			createPointerEvent('pointermove', { buttons: 0, clientX: 120, clientY: 120 })
		);

		expect(ctx.lineTo).toHaveBeenCalledTimes(1);
		getContextSpy.mockRestore();
	});

	it('hydrates the canvas with an initial drawing document when provided', async () => {
		const ctx = {
			...createMockContext(),
			imageSmoothingEnabled: false,
			imageSmoothingQuality: 'low'
		} as unknown as CanvasRenderingContext2D;
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, {
			initialDrawingDocument: normalizeDrawingDocumentToEditableV2({
				...createEmptyDrawingDocument('artwork'),
				strokes: [
					{
						color: '#2d2420',
						points: [[24, 24] as [number, number], [200, 200] as [number, number]],
						size: 8
					}
				]
			})
		});

		const canvas = document.querySelector('canvas');
		if (!canvas) {
			throw new Error('Expected drawing canvas to render');
		}

		expect(canvas.width).toBe(768);
		expect(canvas.height).toBe(768);

		await vi.waitFor(() => {
			expect(ctx.moveTo).toHaveBeenCalled();
			expect(ctx.lineTo).toHaveBeenCalled();
			expect(ctx.stroke).toHaveBeenCalled();
		});

		getContextSpy.mockRestore();
	});

	it('preserves dense user stroke samples while drawing over a fork seed', async () => {
		const ctx = createMockContext();
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);
		const committedDocuments: DrawingDocumentV2[] = [];

		render(DrawingCanvas, {
			initialDrawingDocument: normalizeDrawingDocumentToEditableV2({
				...createEmptyDrawingDocument('artwork'),
				strokes: [
					{
						color: '#2d2420',
						points: [[24, 24] as [number, number], [200, 200] as [number, number]],
						size: 8
					}
				]
			}),
			onDocumentChange: (document: DrawingDocumentV2) => {
				committedDocuments.push(document);
			}
		});

		const canvas = document.querySelector('canvas');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected drawing canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 768,
			height: 768,
			left: 0,
			right: 768,
			top: 0,
			width: 768,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 101, clientY: 101 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 102, clientY: 102 }));
		canvas.dispatchEvent(
			createPointerEvent('pointerup', { buttons: 0, clientX: 102, clientY: 102 })
		);

		const latestDocument = committedDocuments.at(-1);
		expect(latestDocument?.tail).toHaveLength(2);
		expect(latestDocument?.tail[1]?.points).toEqual([
			[100, 100],
			[101, 101],
			[102, 102]
		]);

		getContextSpy.mockRestore();
	});

	it('buffers dense points and emits one canonical append when responsive editing is active', async () => {
		const ctx = createMockContext();
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);
		const committedDocuments: DrawingDocumentV2[] = [];

		render(DrawingCanvas, {
			initialDrawingDocument: createLargeEditableArtworkDocument(),
			onDocumentChange: (document: DrawingDocumentV2) => {
				committedDocuments.push(document);
			}
		});

		const canvas = document.querySelector('canvas');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected drawing canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 768,
			height: 768,
			left: 0,
			right: 768,
			top: 0,
			width: 768,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		committedDocuments.length = 0;

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 180, clientY: 220 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 181, clientY: 221 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 182, clientY: 222 }));

		expect(committedDocuments).toHaveLength(0);

		canvas.dispatchEvent(
			createPointerEvent('pointerup', { buttons: 0, clientX: 182, clientY: 222 })
		);

		expect(committedDocuments).toHaveLength(1);
		expect(committedDocuments[0]?.tail.at(-1)?.points).toEqual([
			[180, 220],
			[181, 221],
			[182, 222]
		]);

		getContextSpy.mockRestore();
	});

	it('ignores invalid pointer starts without capturing the pointer or corrupting the next stroke', async () => {
		const ctx = createMockContext();
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: true });

		const canvas = document.querySelector('canvas');
		if (!canvas) {
			throw new Error('Expected drawing canvas to render');
		}

		const setPointerCaptureSpy = vi
			.spyOn(canvas, 'setPointerCapture')
			.mockImplementation(() => undefined);
		const releasePointerCaptureSpy = vi
			.spyOn(canvas, 'releasePointerCapture')
			.mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);

		vi.clearAllMocks();
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: -1,
				clientY: 24,
				pointerId: 4,
				pointerType: 'mouse',
				isPrimary: true,
				buttons: 1
			})
		);

		expect(setPointerCaptureSpy).not.toHaveBeenCalled();
		expect(ctx.beginPath).not.toHaveBeenCalled();

		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: 24,
				clientY: 24,
				pointerId: 4,
				pointerType: 'mouse',
				isPrimary: true,
				buttons: 1
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				clientX: 80,
				clientY: 80,
				pointerId: 4,
				pointerType: 'mouse',
				isPrimary: true,
				buttons: 1
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				clientX: 80,
				clientY: 80,
				pointerId: 4,
				pointerType: 'mouse',
				isPrimary: true
			})
		);

		expect(setPointerCaptureSpy).toHaveBeenCalledTimes(1);
		expect(releasePointerCaptureSpy).toHaveBeenCalledTimes(1);
		expect(ctx.beginPath).toHaveBeenCalledTimes(2);
		expect(ctx.lineTo).toHaveBeenCalledTimes(1);

		getContextSpy.mockRestore();
	});
});
