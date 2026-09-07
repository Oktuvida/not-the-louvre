import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';

import AmbientParticleOverlay from './AmbientParticleOverlay.svelte';

const setVisibilityState = (value: DocumentVisibilityState) => {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => value
	});
	document.dispatchEvent(new Event('visibilitychange'));
};

const animatedLayer = () => document.querySelector('.ambient-motion');

describe('AmbientParticleOverlay', () => {
	afterEach(() => {
		Reflect.deleteProperty(Document.prototype, 'visibilityState');
		setVisibilityState('visible');
	});

	it('runs the ambience while the layer is on screen and the tab is visible', async () => {
		render(AmbientParticleOverlay, {});

		await expect.element(page.getByTestId('ambient-particle-overlay')).toBeVisible();

		const layer = animatedLayer();
		expect(layer?.getAttribute('data-running')).toBe('true');
		expect(layer?.classList.contains('is-paused')).toBe(false);
	});

	it('pauses 23 permanently-animating elements when the tab is hidden', async () => {
		render(AmbientParticleOverlay, {});

		await expect.element(page.getByTestId('ambient-particle-overlay')).toBeVisible();

		setVisibilityState('hidden');
		await expect.poll(() => animatedLayer()?.getAttribute('data-running')).toBe('false');

		const layer = animatedLayer();
		expect(layer?.classList.contains('is-paused')).toBe(true);
		// Paused, not unmounted: the particles keep their phase so coming back
		// finds the ambience where it was instead of restarted in unison.
		expect(document.querySelectorAll('.ambient-particle')).toHaveLength(18);
		expect(document.querySelectorAll('.paint-blob').length).toBeGreaterThan(0);
	});

	it('resumes when the tab comes back', async () => {
		render(AmbientParticleOverlay, {});

		await expect.element(page.getByTestId('ambient-particle-overlay')).toBeVisible();

		setVisibilityState('hidden');
		await expect.poll(() => animatedLayer()?.getAttribute('data-running')).toBe('false');

		setVisibilityState('visible');
		await expect.poll(() => animatedLayer()?.getAttribute('data-running')).toBe('true');
	});
});
