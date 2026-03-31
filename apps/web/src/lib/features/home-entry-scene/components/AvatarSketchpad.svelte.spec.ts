import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	createEmptyDrawingDocument,
	serializeDrawingDocument
} from '$lib/features/stroke-json/document';
import { buildDrawingDraftKey } from '$lib/features/stroke-json/drafts';
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
		const avatarPayload = serializeDrawingDocument(createEmptyDrawingDocument('avatar'));
		const createAvatarPayload = vi.fn(async () => avatarPayload);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			createAvatarPayload,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await vi.waitFor(() => {
			expect(saveAvatar).toHaveBeenCalledWith(avatarPayload);
			expect(onContinue).toHaveBeenCalled();
		});
	});

	it('recovers a saved local draft before publishing', async () => {
		const draftDocument = {
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2B2622',
					points: [[24, 24] as [number, number], [80, 80] as [number, number]],
					size: 8
				}
			]
		};
		const draftKey = buildDrawingDraftKey({
			schemaVersion: draftDocument.version,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		window.localStorage.setItem(draftKey, serializeDrawingDocument(draftDocument));
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			draftUserKey: 'artist_1',
			nickname: 'artist_1',
			saveAvatar
		});

		await enterGalleryButton().click();

		expect(saveAvatar).toHaveBeenCalledWith(serializeDrawingDocument(draftDocument));
		window.localStorage.clear();
	});

	it('publishes the stored avatar drawing document when reopening the editor', async () => {
		const storedDocument = {
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2F4B9A',
					points: [[16, 18] as [number, number], [140, 180] as [number, number]],
					size: 10
				}
			]
		};
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			initialDrawingDocument: storedDocument,
			nickname: 'artist_1',
			saveAvatar
		});

		await enterGalleryButton().click();

		expect(saveAvatar).toHaveBeenCalledWith(serializeDrawingDocument(storedDocument));
	});

	it('shows a retryable save error and stays in the avatar step when persistence fails', async () => {
		const onContinue = vi.fn();
		const createAvatarPayload = vi.fn(async () =>
			serializeDrawingDocument(createEmptyDrawingDocument('avatar'))
		);
		const saveAvatar = vi.fn(async () => ({
			message: 'Avatar save requires an avatar drawing document',
			success: false as const
		}));

		render(AvatarSketchpad, {
			createAvatarPayload,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('Avatar save requires an avatar drawing document'))
			.toBeVisible();
		expect(onContinue).not.toHaveBeenCalled();
	});

	it('surfaces an unsupported payload error when the browser cannot create a valid avatar payload', async () => {
		const onContinue = vi.fn();
		const createAvatarPayload = vi.fn(async () => null);
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(AvatarSketchpad, {
			createAvatarPayload,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('This browser could not prepare your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'Failed to create avatar payload',
			expect.objectContaining({ message: 'createAvatarPayload returned no payload' })
		);
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it('logs the exact payload error when avatar payload creation throws', async () => {
		const onContinue = vi.fn();
		const payloadError = new Error('Avatar serializer crashed');
		const createAvatarPayload = vi.fn(async () => {
			throw payloadError;
		});
		const saveAvatar = vi.fn();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(AvatarSketchpad, {
			createAvatarPayload,
			nickname: 'artist_1',
			onContinue,
			saveAvatar
		});

		await enterGalleryButton().click();

		await expect
			.element(page.getByText('This browser could not prepare your avatar. Please try again.'))
			.toBeVisible();
		expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create avatar payload', payloadError);
		expect(saveAvatar).not.toHaveBeenCalled();
		expect(onContinue).not.toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});
});
