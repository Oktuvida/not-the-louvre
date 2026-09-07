import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { drawingPalette } from '$lib/features/studio-drawing/state/drawing.svelte';
// The paper is a global utility, which the browser project does not load for a
// component under test; the tray's own sheet is what this spec is checking.
import '../../../../routes/layout.css';
import DrawingToolTray from './DrawingToolTray.svelte';

describe('DrawingToolTray', () => {
	it('triggers clear and publish actions from the tray buttons', async () => {
		const onClear = vi.fn();
		const onPublish = vi.fn();

		render(DrawingToolTray, { onClear, onPublish });

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

	it('disables publish while a publish request is in flight', async () => {
		render(DrawingToolTray, { isPublishing: true });

		await expect.element(page.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
	});

	it('is cut from the same paper as every other sheet in the museum', async () => {
		render(DrawingToolTray, {});

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

	it('shows the full color palette directly on mobile', async () => {
		render(DrawingToolTray, { mobile: true });

		await expect
			.element(page.getByRole('button', { name: `Select color ${drawingPalette[10]}` }))
			.toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /more colors/i }))
			.not.toBeInTheDocument();
	});
});
