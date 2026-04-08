import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	DRAWING_DOCUMENT_V2_VERSION,
	createEmptyDrawingDocument,
	normalizeDrawingDocumentToEditableV2,
	serializeDrawingDocument
} from '$lib/features/stroke-json/document';
import {
	buildDrawingDraftKey,
	createIndexedDbDrawingDraftStore
} from '$lib/features/stroke-json/drafts';
import { drawingPalette } from '$lib/features/studio-drawing/state/drawing.svelte';
import AvatarSketchpad from './AvatarSketchpad.svelte';

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

const createLargeEditableAvatarDocument = () =>
	normalizeDrawingDocumentToEditableV2({
		...createEmptyDrawingDocument('avatar'),
		strokes: Array.from({ length: 72 }, (_, strokeIndex) => ({
			color: '#6b8e7f',
			points: Array.from(
				{ length: 16 },
				(_, pointIndex) =>
					[22 + pointIndex * 12, 40 + (((strokeIndex % 6) * 26 + pointIndex * 5) % 210)] as [
						number,
						number
					]
			),
			size: 6
		}))
	});

const createMockContext = () =>
	({
		arc: vi.fn(),
		arcTo: vi.fn(),
		beginPath: vi.fn(),
		clearRect: vi.fn(),
		fill: vi.fn(),
		fillRect: vi.fn(),
		fillStyle: '#f5f0e1',
		globalAlpha: 1,
		lineDashOffset: 0,
		lineTo: vi.fn(),
		lineWidth: 1,
		moveTo: vi.fn(),
		restore: vi.fn(),
		save: vi.fn(),
		scale: vi.fn(),
		setLineDash: vi.fn(),
		setTransform: vi.fn(),
		stroke: vi.fn(),
		strokeStyle: '#000000'
	}) as unknown as CanvasRenderingContext2D;

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

describe('AvatarSketchpad', () => {
	const enterGalleryButton = () => page.getByRole('button', { name: 'Enter the gallery' });

	beforeEach(async () => {
		window.localStorage.clear();
		await resetDrawingDraftDatabase();
	});

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

	it('keeps the avatar drawing frame square across breakpoints', async () => {
		render(AvatarSketchpad, {
			nickname: 'artist_1'
		});

		const frame = document.querySelector('[data-testid="avatar-sketchpad-frame"]');
		expect(frame).not.toBeNull();
		expect(frame?.className).toContain('aspect-square');
	});

	it('keeps palette swatches clickable beside the brush slider', async () => {
		render(AvatarSketchpad, {
			nickname: 'artist_1'
		});

		const defaultSwatch = page.getByRole('button', {
			name: `Select color ${drawingPalette[4]}`
		});
		const targetSwatch = page.getByRole('button', {
			name: `Select color ${drawingPalette[10]}`
		});

		await expect.element(defaultSwatch).toHaveAttribute('aria-pressed', 'true');
		await targetSwatch.click();
		await expect.element(targetSwatch).toHaveAttribute('aria-pressed', 'true');
		await expect.element(defaultSwatch).toHaveAttribute('aria-pressed', 'false');
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

		await page.getByRole('button', { name: `Select color ${drawingPalette[4]}` }).click();

		const recoloredMetrics = await readPreviewMetrics();
		expect(recoloredMetrics.dotColor).toBe('rgb(253, 188, 180)');
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
		const indexedDraftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		window.localStorage.setItem(draftKey, serializeDrawingDocument(draftDocument));
		const createAvatarPayload = vi.fn(
			async (document: Parameters<typeof serializeDrawingDocument>[0]) =>
				serializeDrawingDocument(document)
		);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			createAvatarPayload,
			draftUserKey: 'artist_1',
			nickname: 'artist_1',
			saveAvatar
		});

		await enterGalleryButton().click();

		await vi.waitFor(() => {
			expect(saveAvatar).toHaveBeenCalledWith(
				serializeDrawingDocument(normalizeDrawingDocumentToEditableV2(draftDocument))
			);
		});
		expect(window.localStorage.getItem(draftKey)).toBeNull();
		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(indexedDraftKey)).toBeNull();
		});
	});

	it('publishes the stored avatar drawing document when reopening the editor', async () => {
		const storedDocument = normalizeDrawingDocumentToEditableV2({
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2F4B9A',
					points: [[16, 18] as [number, number], [140, 180] as [number, number]],
					size: 10
				}
			]
		});
		const createAvatarPayload = vi.fn(
			async (document: Parameters<typeof serializeDrawingDocument>[0]) =>
				serializeDrawingDocument(document)
		);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			createAvatarPayload,
			initialDrawingDocument: storedDocument,
			nickname: 'artist_1',
			saveAvatar
		});

		await enterGalleryButton().click();

		await vi.waitFor(() => {
			expect(saveAvatar).toHaveBeenCalledWith(serializeDrawingDocument(storedDocument));
		});
	});

	it('defers avatar draft writes until a large responsive stroke is committed', async () => {
		const initialDrawingDocument = createLargeEditableAvatarDocument();
		const draftKey = buildDrawingDraftKey({
			schemaVersion: initialDrawingDocument.version,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});

		render(AvatarSketchpad, {
			draftUserKey: 'artist_1',
			initialDrawingDocument,
			nickname: 'artist_1'
		});

		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(draftKey)).not.toBeNull();
		});

		const initialDraft = await readPersistedDrawingDraft(draftKey);
		if (!initialDraft) {
			throw new Error('Expected the initial avatar draft to be persisted');
		}

		const canvas = document.querySelector('canvas');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected avatar sketch canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 340,
			height: 340,
			left: 0,
			right: 340,
			top: 0,
			width: 340,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 80, clientY: 96 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 81, clientY: 97 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 82, clientY: 98 }));
		await Promise.resolve();

		expect(await readPersistedDrawingDraft(draftKey)).toEqual(initialDraft);

		canvas.dispatchEvent(createPointerEvent('pointerup', { buttons: 0, clientX: 82, clientY: 98 }));

		await vi.waitFor(async () => {
			const committedDraft = await readPersistedDrawingDraft(draftKey);
			expect(committedDraft).not.toBeNull();
			expect(committedDraft?.tail.at(-1)?.points).toEqual([
				[80, 96],
				[81, 97],
				[82, 98]
			]);
		});
	});

	it('appends exactly one journal entry when a large responsive avatar stroke is committed', async () => {
		const initialDrawingDocument = createLargeEditableAvatarDocument();
		const draftKey = buildDrawingDraftKey({
			schemaVersion: initialDrawingDocument.version,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});

		render(AvatarSketchpad, {
			draftUserKey: 'artist_1',
			initialDrawingDocument,
			nickname: 'artist_1'
		});

		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(draftKey)).not.toBeNull();
		});

		const canvas = document.querySelector('canvas');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected avatar sketch canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 340,
			height: 340,
			left: 0,
			right: 340,
			top: 0,
			width: 340,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 80, clientY: 96 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 81, clientY: 97 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 82, clientY: 98 }));
		await Promise.resolve();

		expect(await readPersistedJournalEntries(draftKey)).toEqual([]);

		canvas.dispatchEvent(createPointerEvent('pointerup', { buttons: 0, clientX: 82, clientY: 98 }));

		await vi.waitFor(async () => {
			expect(await readPersistedJournalEntries(draftKey)).toEqual([
				{
					color: drawingPalette[4] ?? '#1a1a1a',
					points: [
						[80, 96],
						[81, 97],
						[82, 98]
					],
					size: 10
				}
			]);
		});
	});

	it('surfaces an unsaved-draft warning when avatar draft persistence fails while keeping the current drawing', async () => {
		const backingStore = createIndexedDbDrawingDraftStore();
		const failingStore = {
			...backingStore,
			appendCommittedStroke: async () => {
				throw new Error('IndexedDB write failed');
			}
		};
		const initialDrawingDocument = createLargeEditableAvatarDocument();
		const draftKey = buildDrawingDraftKey({
			schemaVersion: initialDrawingDocument.version,
			scope: 'profile',
			surface: 'avatar',
			userKey: 'artist_1'
		});
		const createAvatarPayload = vi.fn(async (document) => serializeDrawingDocument(document));

		render(AvatarSketchpad, {
			createAvatarPayload,
			draftStore: failingStore,
			draftUserKey: 'artist_1',
			initialDrawingDocument,
			nickname: 'artist_1',
			saveAvatar: async () => ({ message: 'Retry later', success: false as const })
		});

		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(draftKey)).not.toBeNull();
		});

		const canvas = document.querySelector('canvas');
		if (!(canvas instanceof HTMLCanvasElement)) {
			throw new Error('Expected avatar sketch canvas to render');
		}

		vi.spyOn(canvas, 'setPointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 340,
			height: 340,
			left: 0,
			right: 340,
			top: 0,
			width: 340,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		canvas.dispatchEvent(createPointerEvent('pointerdown', { clientX: 80, clientY: 96 }));
		canvas.dispatchEvent(createPointerEvent('pointermove', { clientX: 81, clientY: 97 }));
		canvas.dispatchEvent(createPointerEvent('pointerup', { buttons: 0, clientX: 81, clientY: 97 }));

		await expect.element(page.getByText(UNSAVED_DRAFT_MESSAGE)).toBeVisible();
		expect((await readPersistedDrawingDraft(draftKey))?.tail).toHaveLength(
			initialDrawingDocument.tail.length
		);

		await enterGalleryButton().click();

		await vi.waitFor(() => {
			expect(createAvatarPayload).toHaveBeenCalled();
		});
		expect(createAvatarPayload.mock.calls.at(-1)?.[0].tail).toHaveLength(
			initialDrawingDocument.tail.length + 1
		);
	});

	it('clears to a blank avatar when configured for the authenticated editor flow', async () => {
		const storedDocument = normalizeDrawingDocumentToEditableV2({
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2F4B9A',
					points: [[20, 24] as [number, number], [120, 180] as [number, number]],
					size: 10
				}
			]
		});
		const createAvatarPayload = vi.fn(
			async (document: Parameters<typeof serializeDrawingDocument>[0]) =>
				serializeDrawingDocument(document)
		);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));

		render(AvatarSketchpad, {
			clearMode: 'blank',
			createAvatarPayload,
			initialDrawingDocument: storedDocument,
			nickname: 'artist_1',
			saveAvatar
		});

		await page.getByRole('button', { name: 'Clear' }).click();
		await enterGalleryButton().click();

		await vi.waitFor(() => {
			expect(saveAvatar).toHaveBeenCalledWith(
				serializeDrawingDocument(
					normalizeDrawingDocumentToEditableV2(createEmptyDrawingDocument('avatar'))
				)
			);
		});
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

	it('ignores invalid pointer starts near the edge and prevents drag takeover before a valid stroke', async () => {
		const ctx = createMockContext();
		const originalGetContext = HTMLCanvasElement.prototype.getContext as (
			...args: unknown[]
		) => unknown;
		const getContextSpy = vi
			.spyOn(HTMLCanvasElement.prototype, 'getContext')
			.mockImplementation(function (
				this: HTMLCanvasElement,
				contextId: '2d' | 'bitmaprenderer' | 'webgl' | 'webgl2' | 'webgpu'
			) {
				if (contextId !== '2d') {
					return originalGetContext.call(this, contextId);
				}

				if (this.width === 340 && this.height === 340) {
					return ctx;
				}

				return originalGetContext.call(this, contextId);
			} as HTMLCanvasElement['getContext']);
		const saveAvatar = vi.fn(async () => ({ success: true as const }));
		const createAvatarPayload = vi.fn(
			async (document: Parameters<typeof serializeDrawingDocument>[0]) =>
				serializeDrawingDocument(document)
		);

		render(AvatarSketchpad, {
			createAvatarPayload,
			nickname: 'artist_1',
			saveAvatar
		});

		const canvas = document.querySelector('canvas');
		if (!canvas) {
			throw new Error('Expected avatar canvas to render');
		}

		const setPointerCaptureSpy = vi
			.spyOn(canvas, 'setPointerCapture')
			.mockImplementation(() => undefined);
		const releasePointerCaptureSpy = vi
			.spyOn(canvas, 'releasePointerCapture')
			.mockImplementation(() => undefined);
		vi.spyOn(canvas, 'hasPointerCapture').mockReturnValue(true);
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			bottom: 320,
			height: 320,
			left: 0,
			right: 320,
			top: 0,
			width: 320,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect);

		const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true });
		canvas.dispatchEvent(dragStartEvent);
		expect(dragStartEvent.defaultPrevented).toBe(true);

		canvas.dispatchEvent(
			createPointerEvent('pointerdown', { clientX: -1, clientY: 24, pointerId: 7 })
		);

		expect(setPointerCaptureSpy).not.toHaveBeenCalled();

		canvas.dispatchEvent(
			createPointerEvent('pointerdown', { clientX: 24, clientY: 24, pointerId: 7 })
		);
		canvas.dispatchEvent(
			createPointerEvent('pointermove', { clientX: 80, clientY: 80, pointerId: 7 })
		);
		canvas.dispatchEvent(
			createPointerEvent('pointerup', {
				buttons: 0,
				clientX: 80,
				clientY: 80,
				pointerId: 7
			})
		);

		await enterGalleryButton().click();
		await vi.waitFor(() => {
			expect(saveAvatar).toHaveBeenCalledTimes(1);
		});
		const savedPayload = saveAvatar.mock.calls.at(0)?.at(0);
		const savedDocument = JSON.parse(typeof savedPayload === 'string' ? savedPayload : 'null');

		expect(setPointerCaptureSpy).toHaveBeenCalledTimes(1);
		expect(releasePointerCaptureSpy).toHaveBeenCalledTimes(1);
		expect(savedDocument.version).toBe(2);
		expect(savedDocument.tail).toHaveLength(1);
		expect(savedDocument.tail[0]?.points).toHaveLength(2);

		getContextSpy.mockRestore();
	});
});
