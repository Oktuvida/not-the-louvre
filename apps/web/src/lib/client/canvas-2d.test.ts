import { describe, expect, it, vi } from 'vitest';
import { getCanvasContext, getFrequentReadCanvasContext } from './canvas-2d';

const fakeCanvas = (getContext: (type: string, options?: unknown) => unknown) =>
	({ getContext }) as unknown as HTMLCanvasElement;

describe('canvas-2d contexts', () => {
	it('asks for a CPU-backed context when the canvas is read back pixel by pixel', () => {
		const context = {} as CanvasRenderingContext2D;
		const getContext = vi.fn(() => context);

		expect(getFrequentReadCanvasContext(fakeCanvas(getContext))).toBe(context);
		expect(getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
	});

	it('falls back to a plain context when the options bag is rejected', () => {
		const context = {} as CanvasRenderingContext2D;
		const getContext = vi.fn((_type: string, options?: unknown) => {
			if (options) throw new Error('unsupported context attributes');
			return context;
		});

		expect(getFrequentReadCanvasContext(fakeCanvas(getContext))).toBe(context);
		expect(getContext).toHaveBeenCalledTimes(2);
	});

	it('never asks for the CPU-backed bitmap on a canvas that only composites', () => {
		const context = {} as CanvasRenderingContext2D;
		const getContext = vi.fn(() => context);

		expect(getCanvasContext(fakeCanvas(getContext))).toBe(context);
		expect(getContext).toHaveBeenCalledWith('2d');
	});

	it('reports a missing 2D context instead of throwing', () => {
		const getContext = vi.fn(() => {
			throw new Error('no 2d context');
		});

		expect(getCanvasContext(fakeCanvas(getContext))).toBeNull();
	});
});
