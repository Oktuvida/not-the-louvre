import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
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
		await expect.element(page.getByText(/Signed in as/)).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Logout' })).toBeVisible();
	});

	it('hides signed-in chrome when no canonical backend user exists', async () => {
		render(PersistentNav, { previewCards: [], user: null });

		await expect.element(page.getByText('HELLO')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
	});

	it('renders real homepage top-artwork preview cards from route data', async () => {
		render(PersistentNav, { previewCards: topArtworks, user: null });

		await expect.element(page.getByTestId('home-preview-frame-1')).toBeVisible();
		await expect
			.element(page.getByTestId('home-preview-frame-1'))
			.toHaveAttribute('data-frame-tier', 'premium');
	});

	it('marks top-artwork previews as sensitive until 18+ content is enabled', async () => {
		render(PersistentNav, {
			adultContentEnabled: false,
			previewCards: [{ ...topArtworks[0], isNsfw: true, title: 'Adults only study' }],
			user: null
		});

		await expect.element(page.getByText('18+', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Sensitive preview', { exact: true })).toBeVisible();
	});

	it('does not render fake preview cards when the homepage teaser is empty', async () => {
		render(PersistentNav, { previewCards: [], user: null });

		await expect.element(page.getByAltText('Sunset Over Mountains')).not.toBeInTheDocument();
	});

	it('uses shared sticker links for the primary homepage CTAs', async () => {
		render(PersistentNav, { previewCards: [], user: null });

		await expect
			.element(page.getByRole('link', { name: 'GALLERY' }))
			.toHaveAttribute('data-sticker-size', 'lg');
		await expect
			.element(page.getByRole('link', { name: 'MYSTERY' }))
			.toHaveAttribute('data-sticker-variant', 'accent');
	});
});
