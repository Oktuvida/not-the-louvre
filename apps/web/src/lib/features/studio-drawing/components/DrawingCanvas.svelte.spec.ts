import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DrawingCanvas from './DrawingCanvas.svelte';

class MockCanvasImage {
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;

	set src(_value: string) {
		queueMicrotask(() => {
			this.onload?.();
		});
	}
}

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
		const ctx = {
			beginPath: vi.fn(),
			fillRect: vi.fn(),
			lineCap: 'round',
			lineJoin: 'round',
			lineTo: vi.fn(),
			moveTo: vi.fn(),
			stroke: vi.fn(),
			strokeStyle: '#000000',
			lineWidth: 1
		} as unknown as CanvasRenderingContext2D;
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
		const ctx = {
			beginPath: vi.fn(),
			fillRect: vi.fn(),
			lineCap: 'round',
			lineJoin: 'round',
			lineTo: vi.fn(),
			moveTo: vi.fn(),
			stroke: vi.fn(),
			strokeStyle: '#000000',
			lineWidth: 1
		} as unknown as CanvasRenderingContext2D;
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: true });

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

		canvas.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true, buttons: 1, clientX: 24, clientY: 24 })
		);
		canvas.dispatchEvent(
			new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 80, clientY: 80 })
		);
		canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

		expect(ctx.beginPath).toHaveBeenCalled();
		expect(ctx.moveTo).toHaveBeenCalled();
		expect(ctx.lineTo).toHaveBeenCalled();
		expect(ctx.stroke).toHaveBeenCalled();
		getContextSpy.mockRestore();
	});

	it('keeps drawing when the pointer leaves and re-enters with the mouse still pressed', async () => {
		const ctx = {
			beginPath: vi.fn(),
			fillRect: vi.fn(),
			lineCap: 'round',
			lineJoin: 'round',
			lineTo: vi.fn(),
			moveTo: vi.fn(),
			stroke: vi.fn(),
			strokeStyle: '#000000',
			lineWidth: 1
		} as unknown as CanvasRenderingContext2D;
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: true });

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

		canvas.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true, buttons: 1, clientX: 24, clientY: 24 })
		);
		canvas.dispatchEvent(
			new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 80, clientY: 80 })
		);
		canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, buttons: 1 }));
		canvas.dispatchEvent(
			new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 120, clientY: 120 })
		);

		expect(ctx.lineTo).toHaveBeenCalledTimes(2);
		getContextSpy.mockRestore();
	});

	it('stops drawing after the mouse is released outside the canvas', async () => {
		const ctx = {
			beginPath: vi.fn(),
			fillRect: vi.fn(),
			lineCap: 'round',
			lineJoin: 'round',
			lineTo: vi.fn(),
			moveTo: vi.fn(),
			stroke: vi.fn(),
			strokeStyle: '#000000',
			lineWidth: 1
		} as unknown as CanvasRenderingContext2D;
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		render(DrawingCanvas, { interactive: true });

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

		canvas.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true, buttons: 1, clientX: 24, clientY: 24 })
		);
		canvas.dispatchEvent(
			new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 80, clientY: 80 })
		);
		window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
		canvas.dispatchEvent(
			new MouseEvent('mousemove', { bubbles: true, buttons: 0, clientX: 120, clientY: 120 })
		);

		expect(ctx.lineTo).toHaveBeenCalledTimes(1);
		getContextSpy.mockRestore();
	});

	it('hydrates the canvas with a flat initial image when provided', async () => {
		const ctx = {
			drawImage: vi.fn(),
			fillRect: vi.fn(),
			fillStyle: '#fdfbf7'
		} as unknown as CanvasRenderingContext2D;
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(((contextId: string) =>
				contextId === '2d' ? ctx : null) as HTMLCanvasElement['getContext']);

		vi.stubGlobal('Image', MockCanvasImage);

		render(DrawingCanvas, {
			initialImageUrl: '/api/artworks/artwork-parent/media'
		});

		await vi.waitFor(() => {
			expect(ctx.drawImage).toHaveBeenCalled();
		});

		getContextSpy.mockRestore();
	});
});
