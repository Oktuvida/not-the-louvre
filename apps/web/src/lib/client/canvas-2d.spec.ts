import { describe, expect, it, vi } from 'vitest';
import { getFrequentReadCanvasContext } from './canvas-2d';

describe('getFrequentReadCanvasContext', () => {
	it('requests a 2d context with willReadFrequently enabled', () => {
		const context = { mocked: true } as unknown as CanvasRenderingContext2D;
		const getContextSpy = vi.fn().mockReturnValue(context);
		const canvas = {
			getContext: getContextSpy
		} as unknown as HTMLCanvasElement;

		expect(getFrequentReadCanvasContext(canvas)).toBe(context);
		expect(getContextSpy).toHaveBeenCalledWith('2d', { willReadFrequently: true });
	});

	it('falls back to the default 2d context when the browser rejects options', () => {
		const context = { mocked: true } as unknown as CanvasRenderingContext2D;
		const getContextSpy = vi.fn((contextId: string, options?: CanvasRenderingContext2DSettings) => {
			if (contextId === '2d' && options?.willReadFrequently) {
				throw new TypeError('Options are not supported');
			}

			if (contextId === '2d') {
				return context as unknown as ReturnType<HTMLCanvasElement['getContext']>;
			}

			return null;
		});
		const canvas = {
			getContext: getContextSpy
		} as unknown as HTMLCanvasElement;

		expect(getFrequentReadCanvasContext(canvas)).toBe(context);
		expect(getContextSpy.mock.calls).toEqual([['2d', { willReadFrequently: true }], ['2d']]);
	});
});
