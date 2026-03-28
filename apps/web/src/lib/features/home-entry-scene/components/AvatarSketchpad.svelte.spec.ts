import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AvatarSketchpad from './AvatarSketchpad.svelte';

describe('AvatarSketchpad', () => {
	it('continues into the gallery after the local mock save completes', async () => {
		const onContinue = vi.fn();
		render(AvatarSketchpad, { nickname: 'artist_1', onContinue });

		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await vi.waitFor(() => {
			expect(onContinue).toHaveBeenCalled();
		});
	});

	it('shows a saving state on the button during the local mock save', async () => {
		const onContinue = vi.fn();
		render(AvatarSketchpad, { nickname: 'artist_1', onContinue });

		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await expect.element(page.getByText('Saving...')).toBeInTheDocument();
		await vi.waitFor(() => {
			expect(onContinue).toHaveBeenCalled();
		});
	});
});
