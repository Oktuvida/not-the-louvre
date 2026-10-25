import { describe, expect, it, vi } from 'vitest';
import { createEmptyDrawingDocumentV2 } from '#lib/features/stroke-json/document.js';
import {
	attachPointerReleaseSafetyNet,
	getDrawingPointInRect,
	hasLostPrimaryButton
} from './pointer-drawing';

const createPointerEvent = (type: string, init: PointerEventInit) =>
	new PointerEvent(type, { isPrimary: true, pointerId: 1, pointerType: 'mouse', ...init });

const box = (width: number, height: number) => ({ height, left: 0, top: 0, width });

describe('getDrawingPointInRect', () => {
	it('scales a client position into document pixels, whatever the canvas is shown at', () => {
		expect(
			getDrawingPointInRect(
				box(384, 384),
				{ clientX: 96, clientY: 48 },
				createEmptyDrawingDocumentV2('artwork')
			)
		).toEqual([192, 96]);
	});

	it('rejects a point outside the document bounds', () => {
		expect(
			getDrawingPointInRect(
				box(768, 768),
				{ clientX: 900, clientY: 20 },
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
