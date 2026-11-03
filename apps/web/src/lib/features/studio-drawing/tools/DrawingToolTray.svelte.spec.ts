import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { drawingPalette, drawingTools } from '#lib/features/studio-drawing/state/drawing.svelte.js';
// The paper is a global utility, which the browser project does not load for a
// component under test; the tray's own sheet is what this spec is checking.
import '../../../../routes/layout.css';
import DrawingToolTray from './DrawingToolTray.svelte';

describe('DrawingToolTray', () => {
	// The range input used to be 8px tall: a finger or a pen missed it.
	it('has a brush size slider big enough to grab with a finger', async () => {
		await render(DrawingToolTray, {});

		const slider = page.getByRole('slider', { name: 'Brush size' }).element();
		expect(slider.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
	});

	it('offers undo and redo only when there is a line to take back or put back', async () => {
		const onRedo = vi.fn();
		const onUndo = vi.fn();
		const tray = await render(DrawingToolTray, { canRedo: false, canUndo: false, onRedo, onUndo });

		await expect.element(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Redo' })).toBeDisabled();

		await tray.rerender({ canRedo: true, canUndo: true, onRedo, onUndo });
		await page.getByRole('button', { name: 'Undo' }).click();
		await page.getByRole('button', { name: 'Redo' }).click();

		expect(onUndo).toHaveBeenCalledOnce();
		expect(onRedo).toHaveBeenCalledOnce();
	});

	it('picks up the eraser, and a paint puts the brush back in hand', async () => {
		await render(DrawingToolTray, {});
		const eraser = page.getByRole('button', { name: 'Eraser' });

		await expect.element(eraser).toHaveAttribute('aria-pressed', 'false');
		await eraser.click();
		await expect.element(eraser).toHaveAttribute('aria-pressed', 'true');
		expect(drawingTools.tool).toBe('eraser');

		await page.getByRole('button', { name: `Select color ${drawingPalette[4]}` }).click();
		await expect.element(eraser).toHaveAttribute('aria-pressed', 'false');
		expect(drawingTools.tool).toBe('brush');
	});

	it('keeps the ink out of sight until it runs low, then warns and says when it is out', async () => {
		const tray = await render(DrawingToolTray, { inkUsed: 0.6 });
		const meter = page.getByRole('meter', { name: 'Ink left' });

		await expect.element(meter).not.toBeInTheDocument();

		await tray.rerender({ inkUsed: 0.85 });
		await expect.element(meter).toHaveAttribute('aria-valuenow', '15');
		await expect.element(page.getByText('Running low on ink')).toBeVisible();

		await tray.rerender({ inkUsed: 1 });
		await expect.element(meter).toHaveAttribute('aria-valuenow', '0');
		await expect.element(page.getByText('Out of ink')).toBeVisible();
	});

	it('is a sheet of the deckled watercolour paper the drawing is made on', async () => {
		await render(DrawingToolTray, {});

		const tray = document.querySelector<HTMLElement>('.tool-tray');
		const sheet = tray?.querySelector<HTMLElement>('.tray-sheet');
		expect(sheet).not.toBeNull();

		// The same torn edge as the drawing's sheet (`.deckled-sheet`)…
		const reference = document.createElement('div');
		reference.className = 'deckled-sheet';
		document.body.append(reference);
		expect(getComputedStyle(sheet as HTMLElement).clipPath).toBe(
			getComputedStyle(reference).clipPath
		);
		expect(getComputedStyle(reference).clipPath).toContain('polygon');
		reference.remove();

		// …with a cold-press tooth of its own. Geometry stays the tray's business.
		expect(getComputedStyle(sheet as HTMLElement).backgroundImage).toContain('feTurbulence');
		expect(getComputedStyle(tray as HTMLElement).padding).toBe('20px');

		// And the swipe under "Paints" is the shared paint, not a fourth alpha.
		const swipe = document.querySelector<HTMLElement>('.tray-label-swipe');
		expect(getComputedStyle(swipe as HTMLElement).backgroundImage).toContain(
			'rgba(212, 131, 74, 0.75)'
		);
	});

	it('draws the shared focus ring on the brush size slider', async () => {
		await render(DrawingToolTray, {});

		const slider = document.querySelector<HTMLInputElement>('#brush-size');
		expect(slider).not.toBeNull();

		// A real Tab, because `:focus-visible` does not match a range input that
		// was focused from script.
		for (let step = 0; step < 40 && document.activeElement !== slider; step += 1) {
			await userEvent.tab();
		}
		expect(document.activeElement).toBe(slider);

		// The tray's scoped `outline: none` is unlayered, so it used to beat the
		// `focus-ring` utility in `@layer utilities` no matter the specificity
		// and the control was left with no keyboard focus indicator at all.
		const styles = getComputedStyle(slider as HTMLInputElement);
		expect(styles.outlineStyle).toBe('solid');
		expect(styles.outlineWidth).toBe('3px');
	});
});
