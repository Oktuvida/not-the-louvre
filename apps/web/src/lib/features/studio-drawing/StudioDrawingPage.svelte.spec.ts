import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StudioDrawingPage from './StudioDrawingPage.svelte';

describe('StudioDrawingPage', () => {
	it('publishes the current drawing and shows a minimal success state', async () => {
		const checkImageContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const createArtworkFile = vi.fn(
			async () => new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' })
		);
		const publishDrawing = vi.fn(async () => ({
			action: 'publish' as const,
			artwork: {
				id: 'artwork-1',
				mediaUrl: '/api/artworks/artwork-1/media',
				title: 'Untitled #0001'
			},
			success: true as const
		}));

		render(StudioDrawingPage, {
			checkImageContent,
			createArtworkFile,
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});
		await page.getByPlaceholder('Give your piece a title').fill('My First Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Artwork published', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Untitled #0001' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Open gallery' })).toBeVisible();
		expect(createArtworkFile).toHaveBeenCalled();
		expect(checkImageContent).toHaveBeenCalledWith(expect.any(File), 'artwork');
		expect(publishDrawing).toHaveBeenCalledWith(expect.any(File), {
			parentArtworkId: null,
			title: 'My First Piece'
		});
	});

	it('shows a retryable publish error without leaving the draw route', async () => {
		const checkImageContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const publishDrawing = vi.fn(async () => ({
			code: 'INVALID_MEDIA_CONTENT',
			message: 'Artwork media must decode safely',
			success: false as const
		}));

		render(StudioDrawingPage, {
			checkImageContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});
		await page.getByPlaceholder('Give your piece a title').fill('Problem Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Artwork media must decode safely')).toBeVisible();
		await expect.element(page.getByText('Artwork published')).not.toBeInTheDocument();
	});

	it('shows a local export error when the browser cannot create upload media', async () => {
		const checkImageContent = vi.fn();
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			checkImageContent,
			createArtworkFile: async () => null,
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});
		await page.getByPlaceholder('Give your piece a title').fill('Export Trouble');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect
			.element(page.getByText('This browser could not export your drawing. Please try again.'))
			.toBeVisible();
		expect(checkImageContent).not.toHaveBeenCalled();
		expect(publishDrawing).not.toHaveBeenCalled();
	});

	it('requires a title before publishing', async () => {
		const checkImageContent = vi.fn();
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			checkImageContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Title is required before publishing')).toBeVisible();
		expect(checkImageContent).not.toHaveBeenCalled();
		expect(publishDrawing).not.toHaveBeenCalled();
	});

	it('shows fork context and publishes with the parent artwork id', async () => {
		const checkImageContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const publishDrawing = vi.fn(async () => ({
			action: 'publish' as const,
			artwork: {
				id: 'artwork-fork',
				mediaUrl: '/api/artworks/artwork-fork/media',
				title: 'Forked Piece'
			},
			success: true as const
		}));

		render(StudioDrawingPage, {
			checkImageContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			forkParent: {
				id: 'artwork-parent',
				mediaUrl: '/api/artworks/artwork-parent/media',
				title: 'Parent Artwork'
			},
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByText('Forking from')).toBeVisible();
		await expect.element(page.getByText('Parent Artwork')).toBeVisible();
		await page.getByPlaceholder('Give your piece a title').fill('Forked Piece');
		await page.getByRole('button', { name: 'Publish' }).click();

		expect(publishDrawing).toHaveBeenCalledWith(expect.any(File), {
			parentArtworkId: 'artwork-parent',
			title: 'Forked Piece'
		});
	});

	it('blocks publishing when the artwork filter rejects the exported image', async () => {
		const checkImageContent = vi.fn(async () => ({
			message: 'Artwork contains blocked sexual content.',
			status: 'blocked' as const
		}));
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			checkImageContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});
		await page.getByPlaceholder('Give your piece a title').fill('Blocked Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Artwork contains blocked sexual content.')).toBeVisible();
		expect(publishDrawing).not.toHaveBeenCalled();
	});

	it('blocks publishing when the artwork filter is unavailable', async () => {
		const checkImageContent = vi.fn(async () => ({
			message: 'Artwork safety check is unavailable right now. Please try again.',
			status: 'unavailable' as const
		}));
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			checkImageContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});
		await page.getByPlaceholder('Give your piece a title').fill('Retry Later Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect
			.element(page.getByText('Artwork safety check is unavailable right now. Please try again.'))
			.toBeVisible();
		expect(publishDrawing).not.toHaveBeenCalled();
	});
});
