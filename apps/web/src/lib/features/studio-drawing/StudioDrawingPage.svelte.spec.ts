import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createEmptyDrawingDocument } from '$lib/features/stroke-json/document';

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
		const createArtworkPayload = vi.fn(async () =>
			JSON.stringify(createEmptyDrawingDocument('artwork'))
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
			createArtworkPayload,
			publishDrawing,
			user: { nickname: 'journey_artist' }
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
		expect(createArtworkPayload).toHaveBeenCalled();
		expect(checkTextContent).toHaveBeenCalledWith('My First Piece', 'artwork_title');
		expect(publishDrawing).toHaveBeenCalledWith(expect.any(String), {
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
			createArtworkPayload: async () => JSON.stringify(createEmptyDrawingDocument('artwork')),
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});
		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Problem Piece');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Artwork media must decode safely')).toBeVisible();
		await expect.element(page.getByText(/Artwork published as/)).not.toBeInTheDocument();
	});

	it('shows a local preparation error when the drawing payload cannot be created', async () => {
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const publishDrawing = vi.fn();

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkPayload: async () => null,
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});
		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Export Trouble');

		await page.getByRole('button', { name: 'Publish' }).click();

		await expect
			.element(page.getByText('This browser could not prepare your drawing. Please try again.'))
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
			createArtworkPayload: async () => JSON.stringify(createEmptyDrawingDocument('artwork')),
			publishDrawing,
			user: { nickname: 'journey_artist' }
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
			createArtworkPayload: async () => JSON.stringify(createEmptyDrawingDocument('artwork')),
			forkParent: {
				drawingDocument: createEmptyDrawingDocument('artwork'),
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			publishDrawing
		});

		await expect.element(page.getByText('Forking Parent Artwork')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await page.getByPlaceholder('Untitled genius').fill('Forked Piece');
		await page.getByRole('button', { name: 'Publish' }).click();

		expect(publishDrawing).toHaveBeenCalledWith(expect.any(String), {
			isNsfw: false,
			parentArtworkId: 'artwork-parent',
			title: 'Forked Piece'
		});
	});

	it('lets the user cancel a fork and continue as a new artwork', async () => {
		const forkDraftDocument = {
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [[24, 24] as [number, number], [120, 160] as [number, number]],
					size: 8
				}
			]
		};
		const forkDraftKey = 'drawing-draft:v1:artwork:journey_artist:artwork-parent';
		window.localStorage.setItem(forkDraftKey, JSON.stringify(forkDraftDocument));

		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const publishDrawing = vi.fn(async () => ({
			action: 'publish' as const,
			artwork: {
				id: 'artwork-new',
				mediaUrl: '/api/artworks/artwork-new/media',
				title: 'Fresh Start'
			},
			success: true as const
		}));
		const replaceStudioUrl = vi.fn();

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			checkTextContent,
			createArtworkPayload: async () => JSON.stringify(createEmptyDrawingDocument('artwork')),
			forkParent: {
				drawingDocument: createEmptyDrawingDocument('artwork'),
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			publishDrawing,
			replaceStudioUrl,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByText('Forking Parent Artwork')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Cancel fork' })).toBeEnabled();
		const cancelForkButton = Array.from(document.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('Cancel fork')
		);
		expect(cancelForkButton).not.toBeNull();
		cancelForkButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		await expect.element(page.getByText('Forking Parent Artwork')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Cancel fork' })).not.toBeInTheDocument();
		expect(window.localStorage.getItem(forkDraftKey)).toBeNull();
		expect(replaceStudioUrl).toHaveBeenCalledOnce();

		await page.getByPlaceholder('Untitled genius').fill('Fresh Start');
		await page.getByRole('button', { name: 'Publish' }).click();

		expect(checkTextContent).toHaveBeenCalledWith('Fresh Start', 'artwork_title');
		expect(publishDrawing).toHaveBeenCalledWith(expect.any(String), {
			isNsfw: false,
			parentArtworkId: null,
			title: 'Fresh Start'
		});
		window.localStorage.clear();
	});

	it('auto-opens the sketchbook for a fork once the parent artwork preload is ready', async () => {
		render(StudioDrawingPage, {
			forkParent: {
				drawingDocument: createEmptyDrawingDocument('artwork'),
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1
		});

		await expect.element(page.getByText('Forking Parent Artwork')).toBeVisible();
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
			createArtworkPayload: async () => JSON.stringify(createEmptyDrawingDocument('artwork')),
			publishDrawing,
			user: { nickname: 'journey_artist' }
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
			createArtworkPayload: async () => JSON.stringify(createEmptyDrawingDocument('artwork')),
			publishDrawing,
			user: { nickname: 'journey_artist' }
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
			createArtworkPayload: async () => JSON.stringify(createEmptyDrawingDocument('artwork')),
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});

		await openSketchbook();
		await page.getByPlaceholder('Untitled genius').fill('Figure Study');
		const nsfwToggle = document.querySelector('.postit-nsfw-btn');
		expect(nsfwToggle).not.toBeNull();
		nsfwToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await page.getByRole('button', { name: 'Publish' }).click();

		expect(publishDrawing).toHaveBeenCalledWith(expect.any(String), {
			isNsfw: true,
			parentArtworkId: null,
			title: 'Figure Study'
		});
	});
});
