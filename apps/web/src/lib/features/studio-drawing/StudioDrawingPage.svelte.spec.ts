import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	DRAWING_DOCUMENT_V2_VERSION,
	createEmptyDrawingDocument,
	normalizeDrawingDocumentToEditableV2
} from '$lib/features/stroke-json/document';

const { goto } = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$app/navigation')>();
	return {
		...actual,
		goto
	};
});

import {
	buildDrawingDraftKey,
	createIndexedDbDrawingDraftStore
} from '$lib/features/stroke-json/drafts';
import StudioDrawingPage from './StudioDrawingPage.svelte';

const UNSAVED_DRAFT_MESSAGE = 'Latest local changes are not saved on this device yet.';

const DRAWING_DRAFTS_DB_NAME = 'drawing-drafts';
const DRAWING_DRAFTS_JOURNAL_STORE = 'journal';
const DRAWING_DRAFTS_SNAPSHOT_STORE = 'snapshots';

const resetDrawingDraftDatabase = async () =>
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.open(DRAWING_DRAFTS_DB_NAME);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(DRAWING_DRAFTS_SNAPSHOT_STORE)) {
				database.createObjectStore(DRAWING_DRAFTS_SNAPSHOT_STORE, { keyPath: 'draftKey' });
			}
			if (!database.objectStoreNames.contains(DRAWING_DRAFTS_JOURNAL_STORE)) {
				const journalStore = database.createObjectStore(DRAWING_DRAFTS_JOURNAL_STORE, {
					autoIncrement: true,
					keyPath: 'entryId'
				});
				journalStore.createIndex('by-draft-sequence', ['draftKey', 'sequence'], {
					unique: true
				});
			}
		};
		request.onsuccess = () => {
			const database = request.result;
			const transaction = database.transaction(
				[DRAWING_DRAFTS_SNAPSHOT_STORE, DRAWING_DRAFTS_JOURNAL_STORE],
				'readwrite'
			);
			transaction.objectStore(DRAWING_DRAFTS_SNAPSHOT_STORE).clear();
			transaction.objectStore(DRAWING_DRAFTS_JOURNAL_STORE).clear();
			transaction.oncomplete = () => {
				database.close();
				resolve();
			};
			transaction.onerror = () =>
				reject(transaction.error ?? new Error('Failed to reset drawing drafts DB'));
			transaction.onabort = () =>
				reject(transaction.error ?? new Error('Drawing drafts DB reset was aborted'));
		};
		request.onerror = () => reject(request.error ?? new Error('Failed to open drawing drafts DB'));
	});

const readPersistedDrawingDraft = async (draftKey: string) =>
	await createIndexedDbDrawingDraftStore().hydrate(draftKey);

const readPersistedJournalEntries = async (draftKey: string) =>
	await createIndexedDbDrawingDraftStore().listJournalEntries(draftKey);

const createLargeEditableArtworkDocument = () =>
	normalizeDrawingDocumentToEditableV2({
		...createEmptyDrawingDocument('artwork'),
		strokes: Array.from({ length: 72 }, (_, strokeIndex) => ({
			color: '#2d2420',
			points: Array.from(
				{ length: 24 },
				(_, pointIndex) =>
					[48 + pointIndex * 8, 80 + (((strokeIndex % 6) * 44 + pointIndex * 3) % 520)] as [
						number,
						number
					]
			),
			size: 8
		}))
	});

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

const defaultDesktopMediaQuery = {
	addEventListener: vi.fn(),
	addListener: vi.fn(),
	dispatchEvent: vi.fn(),
	matches: false,
	media: '(max-width: 700px)',
	onchange: null,
	removeEventListener: vi.fn(),
	removeListener: vi.fn()
} satisfies MediaQueryList;

const createMediaQueryList = (query: string) => {
	if (query === '(prefers-reduced-motion: reduce)') {
		return reducedMotionMediaQuery;
	}

	return {
		...defaultDesktopMediaQuery,
		media: query
	} satisfies MediaQueryList;
};

const createPointerEvent = (
	type: string,
	init: Partial<PointerEventInit> & { clientX?: number; clientY?: number; pointerId?: number }
) =>
	new PointerEvent(type, {
		bubbles: true,
		buttons: 1,
		clientX: init.clientX ?? 0,
		clientY: init.clientY ?? 0,
		isPrimary: true,
		pointerId: init.pointerId ?? 1,
		pointerType: 'mouse',
		...init
	});

async function openSketchbook() {
	await page.getByRole('button', { name: 'Open sketchbook' }).click();
	await expect.element(page.getByPlaceholder('Untitled genius')).toBeVisible();
}

describe('StudioDrawingPage', () => {
	beforeEach(async () => {
		vi.unstubAllGlobals();
		vi.stubGlobal(
			'matchMedia',
			vi.fn((query: string) => createMediaQueryList(query))
		);
		window.localStorage.clear();
		await resetDrawingDraftDatabase();
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

	it('keeps the mobile studio canvas card square', async () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn((query: string) => ({
				addEventListener: vi.fn(),
				addListener: vi.fn(),
				dispatchEvent: vi.fn(),
				matches: query === '(max-width: 700px)',
				media: query,
				onchange: null,
				removeEventListener: vi.fn(),
				removeListener: vi.fn()
			}))
		);

		render(StudioDrawingPage, { openingDurationMs: 1 });

		const mobileCanvasCard = document.querySelector('[data-testid="studio-mobile-canvas-card"]');
		expect(mobileCanvasCard).not.toBeNull();
		expect(mobileCanvasCard?.className).toContain('studio-mobile-canvas-card');
	});

	it('keeps the sketchbook opening animation duration even when reduced motion is requested', async () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn((query: string) => createMediaQueryList(query))
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
		await vi.waitFor(() => {
			expect(goto).toHaveBeenCalledWith(expect.stringContaining('?from=studio'));
		});
	});

	it('does not reopen or drop fork context while exiting a forked artwork', async () => {
		goto.mockReset();

		const { unmount } = render(StudioDrawingPage, {
			forkParent: {
				drawingDocument: normalizeDrawingDocumentToEditableV2(
					createEmptyDrawingDocument('artwork')
				),
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 120,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByText('Forking Parent Artwork')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();

		await page.getByRole('link', { name: 'Exit Studio' }).click();

		await expect.element(page.getByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 260));

		await expect.element(page.getByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
		await expect.element(page.getByText('Forking Parent Artwork')).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();

		await new Promise((resolve) => setTimeout(resolve, 420));
		await vi.waitFor(() => {
			expect(goto).toHaveBeenCalledWith(expect.stringContaining('?from=studio'));
		});

		unmount();

		render(StudioDrawingPage, {
			openingDurationMs: 1,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByText('Forking Parent Artwork')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
	});

	it('publishes the current drawing and shows a minimal success state', async () => {
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const createArtworkPayload = vi.fn(async () =>
			JSON.stringify(createEmptyDrawingDocument('artwork'))
		);
		const replaceStudioUrl = vi.fn();
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
			replaceStudioUrl,
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
		expect(replaceStudioUrl).not.toHaveBeenCalled();
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
		const replaceStudioUrl = vi.fn();
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
				drawingDocument: normalizeDrawingDocumentToEditableV2(
					createEmptyDrawingDocument('artwork')
				),
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			publishDrawing,
			replaceStudioUrl,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByText('Forking Parent Artwork')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await page.getByPlaceholder('Untitled genius').fill('Forked Piece');
		await page.getByRole('button', { name: 'Publish' }).click();

		await expect.element(page.getByText('Artwork published as Forked Piece')).toBeVisible();
		expect(replaceStudioUrl).toHaveBeenCalledOnce();
		await expect.element(page.getByText('Forking Parent Artwork')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Cancel fork' })).not.toBeInTheDocument();

		expect(publishDrawing).toHaveBeenCalledWith(expect.any(String), {
			isNsfw: false,
			parentArtworkId: 'artwork-parent',
			title: 'Forked Piece'
		});
		expect(window.localStorage.getItem('studio-fork-context:journey_artist')).toBeNull();

		await page.getByRole('button', { name: 'Draw again' }).click();

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		await expect.element(page.getByText('Forking Parent Artwork')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Cancel fork' })).not.toBeInTheDocument();
	});

	it('keeps fork drawing edits local until publish and persists the new stroke in the draft', async () => {
		const createArtworkPayload = vi.fn(async () =>
			JSON.stringify(createEmptyDrawingDocument('artwork'))
		);
		const forkParentDocument = normalizeDrawingDocumentToEditableV2({
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [[48, 48] as [number, number], [180, 180] as [number, number]],
					size: 8
				}
			]
		});

		render(StudioDrawingPage, {
			createArtworkPayload,
			forkParent: {
				drawingDocument: forkParentDocument,
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();

		const canvas = document.querySelector('canvas[aria-disabled]');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected drawing canvas to render');
		}

		const setPointerCaptureSpy = vi
			.spyOn(canvas, 'setPointerCapture')
			.mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 200, clientY: 220 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 260, clientY: 280 }));
		canvas.dispatchEvent(
			createPointerEvent('pointerup', { buttons: 0, clientX: 260, clientY: 280 })
		);

		expect(setPointerCaptureSpy).toHaveBeenCalledOnce();
		expect(createArtworkPayload).not.toHaveBeenCalled();

		const draftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'journey_artist'
		});

		await vi.waitFor(async () => {
			const persistedDraft = await readPersistedDrawingDraft(draftKey);
			expect(persistedDraft).not.toBeNull();
			if (!persistedDraft) {
				throw new Error('Expected the responsive artwork draft to be persisted');
			}
			expect(persistedDraft.tail).toHaveLength(2);
			expect(persistedDraft.tail[1]?.points).toEqual([
				[192, 282],
				[250, 358]
			]);
		});
	});

	it('does not rewrite the draft until a large responsive stroke is committed', async () => {
		const forkParentDocument = createLargeEditableArtworkDocument();

		render(StudioDrawingPage, {
			forkParent: {
				drawingDocument: forkParentDocument,
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();

		const draftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'journey_artist'
		});

		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(draftKey)).not.toBeNull();
		});

		const initialDraft = await readPersistedDrawingDraft(draftKey);
		if (!initialDraft) {
			throw new Error('Expected the initial large draft to be persisted');
		}

		const canvas = document.querySelector('canvas[aria-disabled]');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected drawing canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 200, clientY: 220 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 240, clientY: 260 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 280, clientY: 300 }));
		await Promise.resolve();

		expect(await readPersistedDrawingDraft(draftKey)).toEqual(initialDraft);

		canvas.dispatchEvent(
			createPointerEvent('pointerup', { buttons: 0, clientX: 280, clientY: 300 })
		);

		await vi.waitFor(async () => {
			const persistedDraft = await readPersistedDrawingDraft(draftKey);
			expect(persistedDraft).not.toBeNull();
			if (!persistedDraft) {
				throw new Error('Expected the committed artwork draft to be persisted');
			}
			expect(persistedDraft.tail.at(-1)?.points).toEqual([
				[192, 282],
				[230, 333],
				[269, 384]
			]);
		});
	});

	it('appends exactly one journal entry when a large responsive artwork stroke is committed', async () => {
		const forkParentDocument = createLargeEditableArtworkDocument();

		render(StudioDrawingPage, {
			forkParent: {
				drawingDocument: forkParentDocument,
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();

		const draftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'journey_artist'
		});

		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(draftKey)).not.toBeNull();
		});

		const canvas = document.querySelector('canvas[aria-disabled]');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected drawing canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 200, clientY: 220 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 240, clientY: 260 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 280, clientY: 300 }));
		await Promise.resolve();

		expect(await readPersistedJournalEntries(draftKey)).toEqual([]);

		canvas.dispatchEvent(
			createPointerEvent('pointerup', { buttons: 0, clientX: 280, clientY: 300 })
		);

		await vi.waitFor(async () => {
			expect(await readPersistedJournalEntries(draftKey)).toEqual([
				{
					color: '#FDBCB4',
					points: [
						[192, 282],
						[230, 333],
						[269, 384]
					],
					size: 6
				}
			]);
		});
	});

	it('surfaces an unsaved-draft warning when draft persistence fails while keeping the in-memory drawing', async () => {
		const backingStore = createIndexedDbDrawingDraftStore();
		const failingStore = {
			...backingStore,
			appendCommittedStroke: async () => {
				throw new Error('IndexedDB write failed');
			}
		};
		const checkTextContent = vi.fn(async () => ({ status: 'allowed' as const }));
		const createArtworkPayload = vi.fn(async (documentState) => JSON.stringify(documentState));
		const publishDrawing = vi.fn(async () => ({ message: 'Retry later', success: false as const }));
		const forkParentDocument = createLargeEditableArtworkDocument();

		render(StudioDrawingPage, {
			checkTextContent,
			createArtworkPayload,
			draftStore: failingStore,
			forkParent: {
				drawingDocument: forkParentDocument,
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1,
			publishDrawing,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();

		const draftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'journey_artist'
		});

		const canvas = document.querySelector('canvas[aria-disabled]');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected drawing canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 600,
			height: 600,
			left: 0,
			right: 800,
			top: 0,
			width: 800,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 200, clientY: 220 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 240, clientY: 260 }));
		canvas.dispatchEvent(
			createPointerEvent('pointerup', { buttons: 0, clientX: 240, clientY: 260 })
		);

		await expect.element(page.getByText(UNSAVED_DRAFT_MESSAGE)).toBeVisible();

		const persistedDraft = await readPersistedDrawingDraft(draftKey);
		expect(persistedDraft?.tail).toHaveLength(forkParentDocument.tail.length);

		await page.getByPlaceholder('Untitled genius').fill('Unsaved Piece');
		await page.getByRole('button', { name: 'Publish' }).click();

		await vi.waitFor(() => {
			expect(createArtworkPayload).toHaveBeenCalled();
		});
		expect(createArtworkPayload.mock.calls.at(-1)?.[0].tail).toHaveLength(
			forkParentDocument.tail.length + 1
		);
	});

	it('restores a fork draft on reload instead of resetting back to the fork base', async () => {
		const forkParentDocument = normalizeDrawingDocumentToEditableV2({
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [[48, 48] as [number, number], [180, 180] as [number, number]],
					size: 8
				}
			]
		});
		const forkDraftDocument = normalizeDrawingDocumentToEditableV2({
			...createEmptyDrawingDocument('artwork'),
			strokes: [
				{
					color: '#2d2420',
					points: [[48, 48] as [number, number], [180, 180] as [number, number]],
					size: 8
				},
				{
					color: '#c84f4f',
					points: [[220, 240] as [number, number], [280, 320] as [number, number]],
					size: 10
				}
			]
		});
		const draftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'journey_artist'
		});
		window.localStorage.setItem(draftKey, JSON.stringify(forkDraftDocument));

		render(StudioDrawingPage, {
			forkParent: {
				drawingDocument: forkParentDocument,
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();

		await vi.waitFor(async () => {
			const persistedDraft = await readPersistedDrawingDraft(draftKey);
			expect(persistedDraft).not.toBeNull();
			if (!persistedDraft) {
				throw new Error('Expected the fork draft to be restored');
			}
			expect(persistedDraft.tail).toHaveLength(2);
			expect(persistedDraft.tail[1]?.points).toEqual([
				[220, 240],
				[280, 320]
			]);
		});
	});

	it('stores only lightweight fork resume metadata in localStorage', async () => {
		render(StudioDrawingPage, {
			forkParent: {
				drawingDocument: normalizeDrawingDocumentToEditableV2(
					createEmptyDrawingDocument('artwork')
				),
				id: 'artwork-parent',
				mediaUrl: forkParentPreviewDataUrl,
				title: 'Parent Artwork'
			},
			openingDurationMs: 1,
			user: { nickname: 'journey_artist' }
		});

		await expect.element(page.getByRole('button', { name: 'Publish' })).toBeVisible();

		const storedForkContext = window.localStorage.getItem('studio-fork-context:journey_artist');
		expect(storedForkContext).not.toBeNull();
		expect(storedForkContext).toContain('artwork-parent');
		expect(storedForkContext).not.toContain('drawingDocument');
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
		const indexedDraftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'artwork-parent',
			surface: 'artwork',
			userKey: 'journey_artist'
		});
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
				drawingDocument: normalizeDrawingDocumentToEditableV2(
					createEmptyDrawingDocument('artwork')
				),
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
		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(indexedDraftKey)).toBeNull();
		});
		expect(window.localStorage.getItem('studio-fork-context:journey_artist')).toBeNull();
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
				drawingDocument: normalizeDrawingDocumentToEditableV2(
					createEmptyDrawingDocument('artwork')
				),
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
