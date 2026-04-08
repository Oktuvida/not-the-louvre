import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createEmptyDrawingDocument } from '$lib/features/stroke-json/document';
import DrawingCanvas from './DrawingCanvas.svelte';

const createMockContext = () =>
	({
		arc: vi.fn(),
		beginPath: vi.fn(),
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
			initialDrawingDocument: {
				...createEmptyDrawingDocument('artwork'),
				strokes: [
					{
						color: '#2d2420',
						points: [[24, 24] as [number, number], [200, 200] as [number, number]],
						size: 8
					}
				]
			}
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
