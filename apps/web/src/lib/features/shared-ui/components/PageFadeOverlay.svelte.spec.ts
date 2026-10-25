import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { PAGE_FADE_DURATION_MS } from '#lib/features/shared-ui/page-fade.js';
import PageFadeOverlay from './PageFadeOverlay.svelte';

const scrim = () => page.getByTestId('page-fade-overlay');

describe('PageFadeOverlay', () => {
	it('paints one full-bleed grey veil above everything else', async () => {
		await render(PageFadeOverlay, { direction: 'in', durationMs: 40, visible: true });

		await expect.element(scrim()).toBeInTheDocument();

		// The studio used to raise its own copy to z-9999 while the other two
		// sat at z-100; every page-to-page veil is the same layer now. The
		// utilities are asserted by name because the browser project renders
		// components without the app's global stylesheet.
		const classNames = scrim().element().className.split(/\s+/);
		expect(classNames).toEqual(
			expect.arrayContaining([
				'pointer-events-none',
				'fixed',
				'inset-0',
				'z-(--z-nav-fade)',
				'bg-scrim'
			])
		);
	});

	it('reports the veil as complete once it has finished dropping', async () => {
		const onComplete = vi.fn();
		const { rerender } = await render(PageFadeOverlay, {
			direction: 'in',
			durationMs: 60,
			onComplete,
			visible: false
		});

		expect(onComplete).not.toHaveBeenCalled();

		await rerender({ direction: 'in', durationMs: 60, onComplete, visible: true });
		await expect.element(scrim()).toBeInTheDocument();

		await vi.waitFor(() => {
			expect(onComplete).toHaveBeenCalledTimes(1);
		});
	});

	it('never reports completion twice, whatever the transition does', async () => {
		const onComplete = vi.fn();
		const { rerender } = await render(PageFadeOverlay, {
			direction: 'in',
			durationMs: 60,
			onComplete,
			visible: false
		});

		await rerender({ direction: 'in', durationMs: 60, onComplete, visible: true });
		const element = scrim().element();

		// Navigation hangs off this callback: a second `goto` for the same fade
		// is a back-button that lands the visitor two pages away.
		element.dispatchEvent(new CustomEvent('introend'));
		element.dispatchEvent(new CustomEvent('introend'));

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(onComplete).toHaveBeenCalledTimes(1);
	});

	it('completes even when the veil is painted before its transition can start', async () => {
		const onComplete = vi.fn();

		// A page that mounts with the veil already down gets no `introend` at
		// all — Svelte only plays intro transitions for blocks created after the
		// mount — so the safety net is the only thing that can navigate.
		await render(PageFadeOverlay, { direction: 'in', durationMs: 20, onComplete, visible: true });

		await vi.waitFor(() => {
			expect(onComplete).toHaveBeenCalledTimes(1);
		});
	});

	it('lifts an already opaque veil and reports when the page is clear', async () => {
		const onComplete = vi.fn();
		const { rerender } = await render(PageFadeOverlay, {
			direction: 'out',
			durationMs: 60,
			onComplete,
			visible: true
		});

		// The arrival veil is opaque from the first frame: fading it in first
		// would flash the page it is supposed to be hiding.
		await expect.element(scrim()).toBeInTheDocument();
		expect(onComplete).not.toHaveBeenCalled();

		await rerender({ direction: 'out', durationMs: 60, onComplete, visible: false });

		await vi.waitFor(() => {
			expect(onComplete).toHaveBeenCalledTimes(1);
		});
		await expect.element(scrim()).not.toBeInTheDocument();
	});

	it('does not navigate after the page is torn down mid-fade', async () => {
		const onComplete = vi.fn();
		const { rerender, unmount } = await render(PageFadeOverlay, {
			direction: 'in',
			durationMs: PAGE_FADE_DURATION_MS,
			onComplete,
			visible: false
		});

		await rerender({
			direction: 'in',
			durationMs: PAGE_FADE_DURATION_MS,
			onComplete,
			visible: true
		});
		await expect.element(scrim()).toBeInTheDocument();
		await new Promise((resolve) => setTimeout(resolve, 60));

		// An unmount means the visitor already went somewhere else; completing
		// here would pull them to this fade's destination instead.
		unmount();
		await new Promise((resolve) => setTimeout(resolve, PAGE_FADE_DURATION_MS + 400));

		expect(onComplete).not.toHaveBeenCalled();
	});
});
