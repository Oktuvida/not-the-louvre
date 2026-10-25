import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { drawingPalette, drawingTools } from '#lib/features/studio-drawing/state/drawing.svelte.js';
// The paper is a global utility, which the browser project does not load for a
// component under test; the tray's own sheet is what this spec is checking.
import '../../../../routes/layout.css';
import DrawingToolTray from './DrawingToolTray.svelte';

describe('DrawingToolTray', () => {
	it('triggers clear and publish actions from the tray buttons', async () => {
		const onClear = vi.fn();
		const onPublish = vi.fn();

		await render(DrawingToolTray, { onClear, onPublish });

		await expect
			.element(page.getByRole('button', { name: 'Clear' }))
			.toHaveAttribute('data-sticker-variant', 'danger');
		await expect
			.element(page.getByRole('button', { name: 'Publish' }))
			.toHaveAttribute('data-sticker-variant', 'secondary');
		await page.getByRole('button', { name: 'Clear' }).click();
		await page.getByRole('button', { name: 'Publish' }).click();

		expect(onClear).toHaveBeenCalled();
		expect(onPublish).toHaveBeenCalled();
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

	it('disables publish while a publish request is in flight', async () => {
		await render(DrawingToolTray, { isPublishing: true });

		await expect.element(page.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
	});

	it('is cut from the same paper as every other sheet in the museum', async () => {
		await render(DrawingToolTray, {});

		const tray = document.querySelector<HTMLElement>('.tool-tray');
		expect(tray).not.toBeNull();

		// The tray used to print its own sheet, and had drifted to a shadow 12%
		// lighter (0.28/0.16) than the auth sheet a click away. Same numbers as
		// `PaperSheet.svelte.spec.ts` asserts, on purpose.
		const styles = getComputedStyle(tray as HTMLElement);
		expect(styles.backgroundColor).toBe('rgb(251, 247, 240)');
		expect(styles.borderRadius).toBe('3px');
		expect(styles.boxShadow).toContain('rgba(0, 0, 0, 0.32) 4px 6px 16px');
		expect(styles.boxShadow).toContain('rgba(0, 0, 0, 0.18) 1px 2px 4px');
		// Geometry stays the tray's own business.
		expect(styles.padding).toBe('20px');
		expect(getComputedStyle(tray as HTMLElement, '::before').backgroundImage).toContain(
			'feTurbulence'
		);

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

	it('shows the full color palette directly on mobile', async () => {
		await render(DrawingToolTray, { mobile: true });

		await expect
			.element(page.getByRole('button', { name: `Select color ${drawingPalette[10]}` }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /more colors/i }))
			.not.toBeInTheDocument();
	});
});
