import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StudioLoadingFallback from './StudioLoadingFallback.svelte';

describe('StudioLoadingFallback', () => {
	it('renders as a non-blocking localized scene placeholder', async () => {
		render(StudioLoadingFallback);

		const fallback = page.getByTestId('studio-scene-fallback');
		await expect.element(fallback).toBeVisible();
		await expect.element(fallback).toHaveAttribute('aria-live', 'polite');
		expect(document.querySelector('[data-testid="studio-scene-fallback"]')?.className).toContain(
			'pointer-events-none'
		);
	});
});
