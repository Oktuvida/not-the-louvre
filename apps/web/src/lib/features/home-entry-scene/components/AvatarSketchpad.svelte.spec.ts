import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AvatarSketchpad from './AvatarSketchpad.svelte';

describe('AvatarSketchpad', () => {
	const enterGalleryButton = () => page.getByRole('button', { name: 'Enter the gallery' });

	it('blocks avatar save when the image filter rejects the exported image', async () => {
		const checkImageContent = vi.fn(async () => ({
			message: 'Avatar contains blocked sexual content.',
			status: 'blocked' as const
		}));
		const saveAvatar = vi.fn();
		const onContinue = vi.fn();

		render(AvatarSketchpad, {
			checkImageContent,
			createAvatarFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' }),
			nickname: 'journey_artist',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect.element(page.getByText('Avatar contains blocked sexual content.')).toBeVisible();
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();
	});

	it('blocks avatar save when the image filter is unavailable', async () => {
		const checkImageContent = vi.fn(async () => ({
			message: 'Avatar safety check is unavailable right now. Please try again.',
			status: 'unavailable' as const
		}));
		const saveAvatar = vi.fn();
		const onContinue = vi.fn();

		render(AvatarSketchpad, {
			checkImageContent,
			createAvatarFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' }),
			nickname: 'journey_artist',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('Avatar safety check is unavailable right now. Please try again.'))
			.toBeVisible();
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();
	});
	it('saves the exported avatar and continues into the gallery on success', async () => {
		const checkImageContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(
			async () => new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' })
		);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			checkImageContent,
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
		const checkImageContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(
			async () => new File([new Uint8Array([1, 2, 3])], 'avatar.png', { type: 'image/png' })
		);
		const saveAvatar = vi.fn(async () => ({
			message: 'Avatar media must be PNG',
			success: false as const
		}));

		render(AvatarSketchpad, {
			checkImageContent,
			createAvatarFile,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect.element(page.getByText('Avatar media must be PNG')).toBeVisible();
		expect(onContinue).not.toHaveBeenCalled();
	});

	it('surfaces an unsupported export error when the browser cannot create a valid avatar file', async () => {
		const checkImageContent = vi.fn();
		const onContinue = vi.fn();
		const createAvatarFile = vi.fn(async () => null);
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(AvatarSketchpad, {
			checkImageContent,
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
		expect(checkImageContent).not.toHaveBeenCalled();
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it('logs the exact export error when avatar file creation throws', async () => {
		const checkImageContent = vi.fn();
		const onContinue = vi.fn();
		const exportError = new Error('AVIF encoder crashed');
		const createAvatarFile = vi.fn(async () => {
			throw exportError;
		});
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(AvatarSketchpad, {
			checkImageContent,
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
		expect(checkImageContent).not.toHaveBeenCalled();
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it('logs the exact default export error when png blob creation fails', async () => {
		const checkImageContent = vi.fn();
		const onContinue = vi.fn();
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const toBlobSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'toBlob')
			.mockImplementation((callback) => {
				callback(null);
			});

		render(AvatarSketchpad, { checkImageContent, nickname: 'artist_1', onContinue, saveAvatar });

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('This browser could not export your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Failed to create avatar file',
			expect.objectContaining({ message: 'Canvas export returned no blob for image/png output.' })
		);
		expect(checkImageContent).not.toHaveBeenCalled();
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		toBlobSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});
});
