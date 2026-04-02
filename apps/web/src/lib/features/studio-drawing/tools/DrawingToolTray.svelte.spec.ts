import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { drawingPalette } from '$lib/features/studio-drawing/state/drawing.svelte';
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

		await expect.element(page.getByRole('button', { name: 'Publishing...' })).toBeDisabled();
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
