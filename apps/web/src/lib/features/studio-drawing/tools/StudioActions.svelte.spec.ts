import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../../../routes/layout.css';
import StudioActions from './StudioActions.svelte';

describe('StudioActions', () => {
	it('hangs the drawing with one press of Publish', async () => {
		const onPublish = vi.fn();
		await render(StudioActions, { onClear: vi.fn(), onPublish });

		await page.getByRole('button', { name: 'Publish' }).click();

		expect(onPublish).toHaveBeenCalledOnce();
	});

	// Clear sits a thumb away from Publish; one stray tap must not wipe a drawing.
	it('clears the page only on a second press', async () => {
		const onClear = vi.fn();
		await render(StudioActions, { onClear, onPublish: vi.fn() });

		await page.getByRole('button', { name: 'Clear page' }).click();
		expect(onClear).not.toHaveBeenCalled();

		await page.getByRole('button', { name: 'Tap again to clear' }).click();
		expect(onClear).toHaveBeenCalledOnce();
		await expect.element(page.getByRole('button', { name: 'Clear page' })).toBeVisible();
	});

	it('forgets a first press on Clear after a moment', async () => {
		const onClear = vi.fn();
		await render(StudioActions, { confirmClearForMs: 50, onClear, onPublish: vi.fn() });

		await page.getByRole('button', { name: 'Clear page' }).click();
		await expect.element(page.getByRole('button', { name: 'Clear page' })).toBeVisible();

		await page.getByRole('button', { name: 'Clear page' }).click();
		expect(onClear).not.toHaveBeenCalled();
	});

	it('holds both buttons while a publish is on its way', async () => {
		await render(StudioActions, { isPublishing: true, onClear: vi.fn(), onPublish: vi.fn() });

		await expect.element(page.getByRole('button', { name: 'Publishing…' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Clear page' })).toBeDisabled();
	});

	it('makes Publish the bigger of the two', async () => {
		await render(StudioActions, { onClear: vi.fn(), onPublish: vi.fn() });

		const publish = page.getByRole('button', { name: 'Publish' }).element().getBoundingClientRect();
		const clear = page
			.getByRole('button', { name: 'Clear page' })
			.element()
			.getBoundingClientRect();
		expect(publish.width * publish.height).toBeGreaterThan(clear.width * clear.height);
	});
});
