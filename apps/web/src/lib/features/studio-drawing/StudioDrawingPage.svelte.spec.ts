import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$app/navigation')>();
	return {
		...actual,
		goto
	};
});

import StudioDrawingPage from './StudioDrawingPage.svelte';

const forkParentPreviewDataUrl =
	'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2" viewBox="0 0 2 2"%3E%3Crect width="1" height="2" fill="%23d66b4d"/%3E%3Crect x="1" width="1" height="2" fill="%23406c8f"/%3E%3C/svg%3E';

const reducedMotionMediaQuery = {
	addEventListener: vi.fn(),
	addListener: vi.fn(),
	dispatchEvent: vi.fn(),
	matches: true,
	media: '(prefers-reduced-motion: reduce)',
	onchange: null,
	removeEventListener: vi.fn(),
	removeListener: vi.fn()
} satisfies MediaQueryList;

async function openSketchbook() {
	await page.getByRole('button', { name: 'Open sketchbook' }).click();
	await expect.element(page.getByPlaceholder('Untitled genius')).toBeVisible();
}

describe('StudioDrawingPage', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it('starts with a closed sketchbook and hides active studio controls', async () => {
		render(StudioDrawingPage, { openingDurationMs: 1 });

		await expect.element(page.getByTestId('ambient-particle-overlay')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Open sketchbook' })).toBeVisible();
		await expect.element(page.getByPlaceholder('Untitled genius')).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
	});

	it('reveals the drawing controls after the sketchbook opens', async () => {
		render(StudioDrawingPage, { openingDurationMs: 1 });

		await openSketchbook();

		await expect.element(page.getByRole('button', { name: 'Clear' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await expect.element(page.getByPlaceholder('Untitled genius')).toBeVisible();
	});

	it('keeps the sketchbook opening animation duration even when reduced motion is requested', async () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => reducedMotionMediaQuery)
		);

		render(StudioDrawingPage, {
			openingDurationMs: 300
		});

		await page.getByRole('button', { name: 'Open sketchbook' }).click();
		await new Promise((resolve) => setTimeout(resolve, 120));

		await expect.element(page.getByPlaceholder('Untitled genius')).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Publish' })).not.toBeInTheDocument();

		await new Promise((resolve) => setTimeout(resolve, 240));

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
	});

	it('closes the sketchbook before starting the exit fade', async () => {
		goto.mockReset();

		render(StudioDrawingPage, { openingDurationMs: 120 });

		await openSketchbook();
		await page.getByRole('link', { name: 'Exit Studio' }).click();

		await expect.element(page.getByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(goto).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 620));
		expect(goto).toHaveBeenCalledWith(expect.stringContaining('?from=studio'));
	});

	it('publishes the current drawing and shows a minimal success state', async () => {
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
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
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile,
			publishDrawing
		});
		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('My First Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Artwork published as Untitled #0001')).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Untitled #0001' })).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Exit Studio' }))
			.toHaveAttribute('data-sticker-variant', 'secondary');
		await expect.element(page.getByRole('link', { name: 'Open gallery' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Draw again' }))
			.toHaveAttribute('data-sticker-variant', 'accent');
		expect(createArtworkFile).toHaveBeenCalled();
		expect(checkTextContent).toHaveBeenCalledWith('My First Piece', 'artwork_title');
		expect(publishDrawing).toHaveBeenCalledWith(expect.any(File), {
			isNsfw: false,
			parentArtworkId: null,
			title: 'My First Piece'
		});
	});

	it('shows a retryable publish error without leaving the draw route', async () => {
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const publishDrawing = vi.fn(async () => ({
			code: 'INVALID_MEDIA_CONTENT',
			message: 'Artwork media must decode safely',
			success: false as const
		}));

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing
		});
		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Problem Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Artwork media must decode safely')).toBeVisible();
		await expect.element(page.getByText(/Artwork published as/)).not.toBeInTheDocument();
	});

	it('shows a local export error when the browser cannot create upload media', async () => {
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile: async () => null,
			publishDrawing
		});
		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Export Trouble');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect
			.element(page.getByText('This browser could not export your drawing. Please try again.'))
			.toBeVisible();
		expect(checkTextContent).toHaveBeenCalledWith('Export Trouble', 'artwork_title');
		expect(publishDrawing).not.toHaveBeenCalled();
	});

	it('requires a title before publishing', async () => {
		const checkTextContent = vi.fn();
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing
		});

		await openSketchbook();

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Title is required before publishing')).toBeVisible();
		expect(checkTextContent).not.toHaveBeenCalled();
		expect(publishDrawing).not.toHaveBeenCalled();
	});

	it('shows fork context and publishes with the parent artwork id', async () => {
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
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
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			forkParent: {
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			publishDrawing
		});

		await expect.element(page.getByText('Forking')).toBeVisible();
		await expect.element(page.getByText('Parent Artwork')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await page.getByPlaceholder('Untitled genius').fill('Forked Piece');
		await page.getByRole('button', { name: 'Publish' }).click();

		expect(publishDrawing).toHaveBeenCalledWith(expect.any(File), {
			isNsfw: false,
			parentArtworkId: 'artwork-parent',
			title: 'Forked Piece'
		});
	});

	it('auto-opens the sketchbook for a fork once the parent artwork preload is ready', async () => {
		render(StudioDrawingPage, {
			forkParent: {
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1
		});

		await expect.element(page.getByText('Forking')).toBeVisible();
		await expect.element(page.getByText('Parent Artwork')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await expect.element(page.getByPlaceholder('Untitled genius')).toBeEnabled();
	});

	it('blocks publishing when the artwork title filter rejects the title', async () => {
		const checkTextContent = vi.fn(async () => ({
			message: 'Choose a different artwork title.',
			status: 'blocked' as const
		}));
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing
		});
		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Blocked Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Choose a different artwork title.')).toBeVisible();
		expect(publishDrawing).not.toHaveBeenCalled();
	});

	it('blocks publishing when the artwork title filter is unavailable', async () => {
		const checkTextContent = vi.fn(async () => ({
			message: 'Artwork title safety check is unavailable right now. Please try again.',
			status: 'unavailable' as const
		}));
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing
		});
		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Retry Later Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect
			.element(
				page.getByText('Artwork title safety check is unavailable right now. Please try again.')
			)
			.toBeVisible();
		expect(publishDrawing).not.toHaveBeenCalled();
	});

	it('passes the creator nsfw label when selected', async () => {
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const publishDrawing = vi.fn(async () => ({
			action: 'publish' as const,
			artwork: {
				id: 'artwork-1',
				isNsfw: true,
				mediaUrl: '/api/artworks/artwork-1/media',
				title: 'Figure Study'
			},
			success: true as const
		}));

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkFile: async () =>
				new File([new Uint8Array([1, 2, 3])], 'art.webp', { type: 'image/webp' }),
			publishDrawing
		});

		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Figure Study');
		await page.getByRole('checkbox').click();
		await page.getByRole('button', { name: 'Publish' }).click();

		expect(publishDrawing).toHaveBeenCalledWith(expect.any(File), {
			isNsfw: true,
			parentArtworkId: null,
			title: 'Figure Study'
		});
	});
});
