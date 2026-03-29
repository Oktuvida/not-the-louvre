import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GalleryExplorationPage from './GalleryExplorationPage.svelte';
import { getGalleryRoom } from './model/rooms';

const baseArtwork = {
	artist: 'journey_artist',
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	imageUrl: '/api/artworks/artwork-1/media',
	isNsfw: false,
	score: 42,
	timestamp: Date.now(),
	upvotes: 0,
	viewerVote: null
};

describe('GalleryExplorationPage', () => {
	it('renders real discovery artwork cards from route data', async () => {
		render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Second Work' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall'
		});

		await expect.element(page.getByText('Deterministic Gallery Study')).toBeVisible();
		await expect.element(page.getByText('Second Work')).toBeVisible();
	});

	it('shows a product empty state instead of fixture content', async () => {
		render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect
			.element(page.getByText('No artworks have reached this gallery room yet.'))
			.toBeVisible();
		await expect.element(page.getByText('Sunset Over Mountains')).not.toBeInTheDocument();
	});

	it('loads and opens real artwork detail when a user selects a card', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Deterministic Gallery Study'
		}));

		render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' }],
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall',
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /Deterministic Gallery Study/ }).click();
		await expect.element(page.getByText('Artwork details')).toBeVisible();
		expect(loadArtworkDetail).toHaveBeenCalledWith('artwork-1');
	});

	it('renders a partially-filled hall-of-fame podium without duplicate key crashes', async () => {
		render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByText('CHAMPION')).toBeVisible();
		await expect.element(page.getByText('RUNNER UP')).toBeVisible();
	});

	it('blurs nsfw artworks until the viewer enables 18+ content', async () => {
		const fetchSpy = vi.fn(
			async () => new Response(JSON.stringify({ adultContentEnabled: true }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchSpy);

		render(GalleryExplorationPage, {
			adultContentEnabled: false,
			artworks: [{ ...baseArtwork, id: 'artwork-1', isNsfw: true, title: 'Adults only study' }],
			emptyStateMessage: null,
			loadArtworkDetail: async () => ({
				...baseArtwork,
				id: 'artwork-1',
				isNsfw: true,
				title: 'Adults only study'
			}),
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('Sensitive artwork', { exact: true })).toBeVisible();
		await page.getByRole('button', { exact: true, name: 'Reveal 18+ artworks' }).click();

		expect(fetchSpy).toHaveBeenCalledWith('/api/viewer/content-preferences', {
			body: JSON.stringify({ adultContentEnabled: true }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
		await expect.element(page.getByRole('button', { name: /Adults only study/ })).toBeVisible();
	});

	it('uses premium frames for the top-three podium artworks only', async () => {
		render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', rank: 1, title: 'Champion' },
				{ ...baseArtwork, id: 'artwork-2', rank: 2, title: 'Runner Up' },
				{ ...baseArtwork, id: 'artwork-3', rank: 3, title: 'Bronze Star' },
				{ ...baseArtwork, id: 'artwork-4', rank: 4, title: 'Gallery Favorite' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect
			.element(page.getByTestId('podium-frame-1'))
			.toHaveAttribute('data-frame-tier', 'premium');
		await expect
			.element(page.getByTestId('podium-frame-2'))
			.toHaveAttribute('data-frame-tier', 'premium');
		await expect
			.element(page.getByTestId('podium-frame-3'))
			.toHaveAttribute('data-frame-tier', 'premium');
		await expect
			.element(page.getByTestId('ranked-frame-artwork-4'))
			.toHaveAttribute('data-frame-tier', 'standard');
	});
});
