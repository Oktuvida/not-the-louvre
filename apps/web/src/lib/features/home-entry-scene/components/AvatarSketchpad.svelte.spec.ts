import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AvatarSketchpad from './AvatarSketchpad.svelte';

describe('AvatarSketchpad', () => {
	const enterGalleryButton = () => page.getByRole('button', { name: 'Enter the gallery' });

	it('shows a fuller palette and brush slider without a redundant nickname field', async () => {
		render(AvatarSketchpad, {
			nickname: 'artist_1'
		});

		await expect.element(page.getByRole('slider', { name: 'Brush size' })).toBeVisible();
		await expect
			.element(page.getByText('Sketch a quick self-portrait for artist_1.'))
			.toBeVisible();
		await expect.element(page.getByRole('textbox')).not.toBeInTheDocument();
	});

	it('keeps palette swatches clickable beside the brush slider', async () => {
		render(AvatarSketchpad, {
			nickname: 'artist_1'
		});

		const firstSwatch = page.getByRole('button', { name: 'Select color #F4EBDD' });
		const targetSwatch = page.getByRole('button', { name: 'Select color #2B2622' });

		await expect.element(firstSwatch).toHaveAttribute('aria-pressed', 'true');
		await targetSwatch.click();
		await expect.element(targetSwatch).toHaveAttribute('aria-pressed', 'true');
		await expect.element(firstSwatch).toHaveAttribute('aria-pressed', 'false');
	});

	it('keeps the brush preview footprint stable while the dot size and color change', async () => {
		render(AvatarSketchpad, {
			nickname: 'artist_1'
		});

		const readPreviewMetrics = () =>
			(() => {
				const shell = document.querySelector('[data-testid="brush-preview-shell"]');
				const dot = document.querySelector('[data-testid="brush-preview-dot"]');

				if (!(shell instanceof HTMLElement) || !(dot instanceof HTMLElement)) {
					throw new Error('Brush preview elements are missing.');
				}

				return {
					dotColor: getComputedStyle(dot).backgroundColor,
					dotHeight: dot.offsetHeight,
					dotWidth: dot.offsetWidth,
					shellHeight: shell.offsetHeight,
					shellWidth: shell.offsetWidth
				};
			})();

		const initialMetrics = await readPreviewMetrics();

		const slider = document.querySelector('input[aria-label="Brush size"]');

		if (!(slider instanceof HTMLInputElement)) {
			throw new Error('Brush size slider is missing.');
		}

		slider.value = '0';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		slider.dispatchEvent(new Event('change', { bubbles: true }));

		await vi.waitFor(() => {
			expect(readPreviewMetrics().dotWidth).toBeLessThan(initialMetrics.dotWidth);
			expect(readPreviewMetrics().dotHeight).toBeLessThan(initialMetrics.dotHeight);
		});

		const resizedMetrics = await readPreviewMetrics();
		expect(resizedMetrics.shellWidth).toBe(initialMetrics.shellWidth);
		expect(resizedMetrics.shellHeight).toBe(initialMetrics.shellHeight);

		await page.getByRole('button', { name: 'Select color #2B2622' }).click();

		const recoloredMetrics = await readPreviewMetrics();
		expect(recoloredMetrics.dotColor).toBe('rgb(43, 38, 34)');
	});

	it('saves the exported avatar and continues into the gallery on success', async () => {
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(
			async () => new File([new Uint8Array([1, 2, 3])], 'avatar.webp', { type: 'image/webp' })
		);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			createAvatarFile,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await vi.waitFor(() => {
			expect(saveAvatar).toHaveBeenCalled();
			expect(onContinue).toHaveBeenCalled();
		});
	});

	it('shows a retryable save error and stays in the avatar step when persistence fails', async () => {
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(
			async () => new File([new Uint8Array([1, 2, 3])], 'avatar.webp', { type: 'image/webp' })
		);
		const saveAvatar = vi.fn(async () => ({
			message: 'Avatar media must be WebP',
			success: false as const
		}));

		render(AvatarSketchpad, {
			createAvatarFile,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect.element(page.getByText('Avatar media must be WebP')).toBeVisible();
		expect(onContinue).not.toHaveBeenCalled();
	});

	it('surfaces an unsupported export error when the browser cannot create a valid avatar file', async () => {
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(async () => null);
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(AvatarSketchpad, {
			createAvatarFile,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('This browser could not export your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Failed to create avatar file',
			expect.objectContaining({ message: 'createAvatarFile returned no file' })
		);
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it('logs the exact export error when avatar file creation throws', async () => {
		const onContinue = vi.fn();
		const exportError = new Error('AVIF encoder crashed');
		const createAvatarFile = vi.fn(async () => {
			throw exportError;
		});
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(AvatarSketchpad, {
			createAvatarFile,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('This browser could not export your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create avatar file', exportError);
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it('logs the exact default export error when webp blob creation fails', async () => {
		const onContinue = vi.fn();
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const toBlobSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'toBlob')
			.mockImplementation((callback) => {
				callback(null);
			});

		render(AvatarSketchpad, { nickname: 'artist_1', onContinue, saveAvatar });

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('This browser could not export your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Failed to create avatar file',
			expect.objectContaining({ message: 'Canvas export returned no blob for image/webp output.' })
		);
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		toBlobSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});
});
