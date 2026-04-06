import { describe, expect, it } from 'vitest';
import { applyMuseumWallWillChange } from './museum-wall-will-change';

const createElements = () => ({
	frameVisualElement: { style: { willChange: '' } } as HTMLDivElement,
	overlayElement: { style: { willChange: '' } } as HTMLDivElement,
	wallSceneElement: { style: { willChange: '' } } as HTMLDivElement,
	wallTextureElement: { style: { willChange: '' } } as HTMLDivElement
});

describe('applyMuseumWallWillChange', () => {
	it('limits the entry animation hint to the transformed wall scene only', () => {
		const elements = createElements();

		applyMuseumWallWillChange(elements, true);

		expect(elements.wallSceneElement.style.willChange).toBe('transform');
		expect(elements.overlayElement.style.willChange).toBe('');
		expect(elements.wallTextureElement.style.willChange).toBe('');
		expect(elements.frameVisualElement.style.willChange).toBe('');
	});

	it('clears all hints when the entry animation finishes', () => {
		const elements = createElements();

		applyMuseumWallWillChange(elements, true);
		applyMuseumWallWillChange(elements, false);

		expect(elements.wallSceneElement.style.willChange).toBe('');
		expect(elements.overlayElement.style.willChange).toBe('');
		expect(elements.wallTextureElement.style.willChange).toBe('');
		expect(elements.frameVisualElement.style.willChange).toBe('');
	});
});
