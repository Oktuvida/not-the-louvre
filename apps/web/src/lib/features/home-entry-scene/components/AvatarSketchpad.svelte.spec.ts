import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AvatarSketchpad from './AvatarSketchpad.svelte';

describe('AvatarSketchpad', () => {
	it('saves the exported avatar and continues into the gallery on success', async () => {
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(
			async () => new File([new Uint8Array([1, 2, 3])], 'avatar.avif', { type: 'image/avif' })
		);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, { createAvatarFile, nickname: 'artist_1', onContinue, saveAvatar });

		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await vi.waitFor(() => {
			expect(saveAvatar).toHaveBeenCalled();
			expect(onContinue).toHaveBeenCalled();
		});
	});

	it('shows a retryable save error and stays in the avatar step when persistence fails', async () => {
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(
			async () => new File([new Uint8Array([1, 2, 3])], 'avatar.avif', { type: 'image/avif' })
		);
		const saveAvatar = vi.fn(async () => ({
			message: 'Avatar media must be AVIF',
			success: false as const
		}));

		render(AvatarSketchpad, { createAvatarFile, nickname: 'artist_1', onContinue, saveAvatar });

		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await expect.element(page.getByText('Avatar media must be AVIF')).toBeVisible();
		expect(onContinue).not.toHaveBeenCalled();
	});

	it('surfaces an unsupported export error when the browser cannot create a valid avatar file', async () => {
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(async () => null);
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(AvatarSketchpad, { createAvatarFile, nickname: 'artist_1', onContinue, saveAvatar });

		await page.getByRole('button', { name: 'Enter the gallery' }).click();

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

		render(AvatarSketchpad, { createAvatarFile, nickname: 'artist_1', onContinue, saveAvatar });

		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await expect
			.element(page.getByText('This browser could not export your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create avatar file', exportError);
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it('logs the exact default export error when avif blob creation fails', async () => {
		const onContinue = vi.fn();
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const toBlobSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'toBlob')
			.mockImplementation((callback) => {
				callback(null);
			});

		render(AvatarSketchpad, { nickname: 'artist_1', onContinue, saveAvatar });

		await page.getByRole('button', { name: 'Enter the gallery' }).click();

		await expect
			.element(page.getByText('This browser could not export your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Failed to create avatar file',
			expect.objectContaining({ message: 'Canvas export returned no blob for image/avif output.' })
		);
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		toBlobSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});
});
