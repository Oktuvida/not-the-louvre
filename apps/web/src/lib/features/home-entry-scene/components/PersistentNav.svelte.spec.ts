import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	createEmptyDrawingDocument,
	serializeDrawingDocument
} from '$lib/features/stroke-json/document';
import { buildDrawingDraftKey } from '$lib/features/stroke-json/drafts';
import PersistentNav from './PersistentNav.svelte';

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
		await expect.element(page.getByRole('button', { name: 'Logout' })).toBeVisible();
	});

	it('hides signed-in chrome when no canonical backend user exists', async () => {
		render(PersistentNav, { previewCards: [], user: null });

		await expect.element(page.getByText('HELLO')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
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
		const savedDocument = {
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#2F4B9A',
					points: [[16, 18] as [number, number], [140, 180] as [number, number]],
					size: 10
				}
			]
		};
		const draftDocument = {
			...createEmptyDrawingDocument('avatar'),
			strokes: [
				{
					color: '#B9322E',
					points: [[28, 32] as [number, number], [220, 240] as [number, number]],
					size: 12
				}
			]
		};
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

		await page.getByRole('button', { name: 'Edit avatar for artist_1' }).click();
		await page.getByRole('button', { name: 'Done' }).click();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
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

		window.localStorage.clear();
		vi.unstubAllGlobals();
	});
});
