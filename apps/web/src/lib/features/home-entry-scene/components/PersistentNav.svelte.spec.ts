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
import PersistentNav from './PersistentNav.svelte';

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

const topArtworks = [
	{
		accent: '#f3c64c',
		artist: 'PaintMaster42',
		artistAvatar: undefined,
		id: 'artwork-1',
		imageUrl: '/api/artworks/artwork-1/media',
		isNsfw: false,
		rank: 1,
		rotation: -2,
		title: 'Sunset Over Mountains'
	}
];

describe('PersistentNav', () => {
	beforeEach(async () => {
		window.localStorage.clear();
		await resetDrawingDraftDatabase();
	});

	it('shows backend-backed signed-in chrome only when a canonical user is present', async () => {
		render(PersistentNav, {
			previewCards: topArtworks,
			user: {
				authUserId: 'auth-user-1',
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});

		await expect.element(page.getByText('HELLO')).toBeVisible();
		await expect.element(page.getByText('artist_1', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('button', { name: /logout/i })).toBeVisible();
	});

	it('hides signed-in chrome when no canonical backend user exists', async () => {
		render(PersistentNav, { previewCards: [], user: null });

		await expect.element(page.getByText('HELLO')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /logout/i })).not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'GALLERY' })).toBeVisible();
	});

	it('renders real homepage top-artwork preview cards from route data', async () => {
		render(PersistentNav, { previewCards: topArtworks, user: null });

		await expect.element(page.getByTestId('home-preview-frame-1')).toBeVisible();
		await expect
			.element(page.getByTestId('home-preview-frame-1'))
			.toHaveAttribute('data-frame-tier', 'premium');
		await expect.element(page.getByText('#1')).not.toBeInTheDocument();
	});

	it('keeps the homepage preview stack desktop-only through responsive classes', async () => {
		render(PersistentNav, { previewCards: topArtworks, user: null });

		const previewStack = document.querySelector('[data-testid="home-preview-stack"]');
		expect(previewStack).not.toBeNull();
		expect(previewStack?.className).toContain('hidden');
		expect(previewStack?.className).toContain('md:block');
	});

	it('marks top-artwork previews as sensitive until 18+ content is enabled', async () => {
		render(PersistentNav, {
			adultContentEnabled: false,
			previewCards: [{ ...topArtworks[0], isNsfw: true, title: 'Adults only study' }],
			user: null
		});

		await expect.element(page.getByText('18+', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Sensitive preview', { exact: true })).toBeVisible();
		await expect.element(page.getByText('18+ artworks', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Sign in to reveal 18+ artworks.')).toBeVisible();
	});

	it('decodes the above-the-fold preview imagery without deferring it', async () => {
		render(PersistentNav, {
			previewCards: [{ ...topArtworks[0], artistAvatar: '/api/users/artist-1/avatar' }],
			user: null
		});

		const preview = page.getByAltText('Sunset Over Mountains');
		await expect.element(preview).toHaveAttribute('decoding', 'async');
		expect(preview.element().getAttribute('loading')).toBeNull();

		await expect.element(page.getByAltText('PaintMaster42')).toHaveAttribute('loading', 'eager');
	});

	it('censors sensitive previews with the one shared NSFW treatment', async () => {
		render(PersistentNav, {
			adultContentEnabled: false,
			previewCards: [{ ...topArtworks[0], isNsfw: true, title: 'Adults only study' }],
			user: null
		});

		const image = page.getByAltText('Adults only study');
		await expect.element(image).toBeVisible();

		// Same blur and scrim as every other room, read from --nsfw-* with the
		// shared fallbacks — not a fourth set of numbers.
		const treatment = getComputedStyle(image.element());
		expect(treatment.filter).toContain('blur(20px)');
		expect(image.element().className).not.toContain('blur-xl');

		const scrim = document.querySelector('.nsfw-scrim');
		expect(scrim).not.toBeNull();
		expect(getComputedStyle(scrim!).backgroundColor).toBe('rgba(45, 36, 32, 0.68)');
	});

	it('does not render fake preview cards when the homepage teaser is empty', async () => {
		render(PersistentNav, { previewCards: [], user: null });

		await expect.element(page.getByAltText('Sunset Over Mountains')).not.toBeInTheDocument();
	});

	it('uses shared sticker links for the primary homepage CTA', async () => {
		render(PersistentNav, { previewCards: [], user: null });

		await expect
			.element(page.getByRole('link', { name: 'GALLERY' }))
			.toHaveAttribute('data-sticker-size', 'lg');
		await expect
			.element(page.getByRole('link', { name: 'GALLERY' }))
			.toHaveAttribute('data-sticker-variant', 'secondary');
		await expect.element(page.getByRole('link', { name: 'MYSTERY' })).not.toBeInTheDocument();
	});

	it('shows the studio-bound gallery destination only for authenticated users', async () => {
		render(PersistentNav, {
			previewCards: [],
			user: {
				authUserId: 'auth-user-1',
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});

		await expect.element(page.getByRole('button', { name: 'GALLERY' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'GALLERY' })).not.toBeInTheDocument();
	});

	it('discards the authenticated avatar draft when the editor is closed without saving', async () => {
		const savedDocument = normalizeDrawingDocumentToEditableV2({
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2F4B9A',
					points: [[16, 18] as [number, number], [140, 180] as [number, number]],
					size: 10
				}
			]
		});
		const draftDocument = normalizeDrawingDocumentToEditableV2({
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#B9322E',
					points: [[28, 32] as [number, number], [220, 240] as [number, number]],
					size: 12
				}
			]
		});
		const user = {
			authUserId: 'auth-user-1',
			email: 'artist_1@not-the-louvre.local',
			id: 'product-user-1',
			nickname: 'artist_1',
			role: 'user',
			avatarDrawingDocument: savedDocument
		};
		const draftKey = buildDrawingDraftKey({
			schemaVersion: draftDocument.version,
			scope: 'profile',
			surface: 'avatar',
			userKey: user.id
		});
		const indexedDraftKey = buildDrawingDraftKey({
			schemaVersion: DRAWING_DOCUMENT_V2_VERSION,
			scope: 'profile',
			surface: 'avatar',
			userKey: user.id
		});
		window.localStorage.setItem(draftKey, serializeDrawingDocument(draftDocument));

		const fetchSpy = vi.fn(async () => ({
			json: async () => ({ avatarUrl: '/avatars/product-user-1.png' }),
			ok: true
		}));
		vi.stubGlobal('fetch', fetchSpy);

		render(PersistentNav, { previewCards: topArtworks, user });

		await page.getByRole('button', { name: 'Edit avatar for artist_1' }).click();
		await page.getByRole('button', { name: 'Close' }).click();

		expect(window.localStorage.getItem(draftKey)).toBeNull();
		await vi.waitFor(async () => {
			expect(await readPersistedDrawingDraft(indexedDraftKey)).toBeNull();
		});

		await page.getByRole('button', { name: 'Edit avatar for artist_1' }).click();
		await page.getByRole('button', { name: 'Done' }).click();

		await vi.waitFor(() => {
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});
		const fetchCalls = fetchSpy.mock.calls as unknown as Array<[string, RequestInit]>;
		const call = fetchCalls[0];
		expect(call).toBeDefined();
		const url = call?.[0];
		const request = call?.[1];
		expect(url).toBe('/api/users/product-user-1/avatar');
		expect(request?.method).toBe('PUT');
		expect(request?.body).toBeInstanceOf(FormData);
		expect((request?.body as FormData).get('drawingDocument')).toBe(
			serializeDrawingDocument(savedDocument)
		);

		vi.unstubAllGlobals();
	});

	it('takes the leaving chrome out of the tab order while the page exits', async () => {
		const user = {
			authUserId: 'auth-user-1',
			email: 'artist_1@not-the-louvre.local',
			id: 'product-user-1',
			nickname: 'artist_1',
			role: 'user'
		};

		const { rerender } = render(PersistentNav, { previewCards: topArtworks, user });

		const previewStack = document.querySelector('[data-testid="home-preview-stack"]')!;
		expect(previewStack.hasAttribute('inert')).toBe(false);

		await rerender({ isExiting: true, previewCards: topArtworks, user });

		expect(previewStack.hasAttribute('inert')).toBe(true);
		expect(
			[...document.querySelectorAll('[inert]')].some((element) =>
				element.querySelector('form[action="?/signOut"]')
			)
		).toBe(true);
	});

	it('keeps keyboard focus inside the avatar editor and hands it back on close', async () => {
		render(PersistentNav, {
			previewCards: topArtworks,
			user: {
				authUserId: 'auth-user-1',
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});

		await page.getByRole('button', { name: 'Edit avatar for artist_1' }).click();

		const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
		expect(dialog.contains(document.activeElement)).toBe(true);

		document.activeElement?.dispatchEvent(
			new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab', shiftKey: true })
		);
		expect(dialog.contains(document.activeElement)).toBe(true);

		await page.getByRole('button', { name: 'Close' }).click();

		await vi.waitFor(() => {
			expect(document.activeElement?.getAttribute('aria-label')).toContain(
				'Edit avatar for artist_1'
			);
		});
	});

	it('closes the avatar editor on Escape from inside the sheet', async () => {
		render(PersistentNav, {
			previewCards: topArtworks,
			user: {
				authUserId: 'auth-user-1',
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});

		await page.getByRole('button', { name: 'Edit avatar for artist_1' }).click();
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();

		// Focus starts on the close tape inside the sheet, whose wrapper swallows
		// the events the backdrop closes on — Escape has to get through anyway.
		document.activeElement?.dispatchEvent(
			new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
		);

		await vi.waitFor(() => {
			expect(document.querySelector('[role="dialog"]')).toBeNull();
		});
	});

	it('uses a scrollable avatar editor dialog shell on small screens', async () => {
		render(PersistentNav, {
			previewCards: topArtworks,
			user: {
				authUserId: 'auth-user-1',
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});

		await page.getByRole('button', { name: 'Edit avatar for artist_1' }).click();

		const panel = [...document.querySelectorAll('div')].find(
			(element) =>
				element.className.includes('max-h-[calc(100dvh-1.5rem)]') &&
				element.className.includes('overflow-y-auto')
		);
		expect(panel).not.toBeNull();
	});

	// One paper, one tape: the avatar sheet used to print its own copy of both,
	// and the auth sheet a click away printed a third.
	it('builds the avatar editor out of the shared paper and tape', async () => {
		render(PersistentNav, {
			previewCards: topArtworks,
			user: {
				authUserId: 'auth-user-1',
				email: 'artist_1@not-the-louvre.local',
				id: 'product-user-1',
				nickname: 'artist_1',
				role: 'user'
			}
		});

		await page.getByRole('button', { name: 'Edit avatar for artist_1' }).click();

		const sheet = document.querySelector<HTMLElement>('.paper-sheet');
		expect(sheet).not.toBeNull();
		// The sheet scrolls, so it hands its grain to the inner element.
		expect(sheet?.classList.contains('paper-grain')).toBe(false);
		expect(document.querySelector('.avatar-sheet-inner')?.classList.contains('paper-grain')).toBe(
			true
		);
		expect(document.querySelector('.avatar-sheet-swipe')?.classList.contains('paint-swipe')).toBe(
			true
		);

		// The tape carries its own clip-path, so it needs no global stylesheet.
		const close = page.getByRole('button', { name: 'Close' }).element();
		expect(close.classList.contains('washi-tape')).toBe(true);
		expect(getComputedStyle(close).clipPath).toContain('polygon');
	});
});
