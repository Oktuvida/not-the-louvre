import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { goto, invalidateAll } = vi.hoisted(() => ({
	goto: vi.fn(),
	invalidateAll: vi.fn(async () => {})
}));

vi.mock('$app/navigation', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$app/navigation')>();
	return {
		...actual,
		goto,
		invalidateAll
	};
});

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

const createDeferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((innerResolve) => {
		resolve = innerResolve;
	});

	return { promise, resolve };
};

describe('GalleryExplorationPage', () => {
	beforeEach(() => {
		vi.unstubAllGlobals?.();
		window.scrollTo(0, 0);
	});

	it('renders real discovery artwork cards from route data', async () => {
		render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', title: 'Deterministic Gallery Study' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Second Work' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('Deterministic Gallery Study')).toBeVisible();
		await expect.element(page.getByText('Second Work')).toBeVisible();
	});

	it('renders the hot wall as a coming-soon placeholder', async () => {
		render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', title: 'Lead Heat' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Second Spark' },
				{ ...baseArtwork, id: 'artwork-3', title: 'Third Spark' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall'
		});

		await expect.element(page.getByTestId('hot-wall-coming-soon')).toBeVisible();
		await expect.element(page.getByText('Proximamente.')).toBeVisible();
	});

	it('shows a stable fallback while the hot wall room module loads on demand', async () => {
		const deferredRoom =
			createDeferred<
				Awaited<typeof import('$lib/features/gallery-exploration/rooms/HotWallRoom.svelte')>
			>();

		render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Lead Heat' }],
			emptyStateMessage: null,
			loadHotWallRoom: () => deferredRoom.promise,
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall'
		});

		await expect.element(page.getByTestId('gallery-room-loading')).toBeVisible();

		deferredRoom.resolve(await import('./rooms/HotWallRoom.svelte'));

		await expect.element(page.getByTestId('hot-wall-coming-soon')).toBeVisible();
	});

	it('loads room-specific UI when the visitor switches into the mystery room', async () => {
		const deferredRoom =
			createDeferred<
				Awaited<typeof import('$lib/features/gallery-exploration/rooms/MysteryRoom.svelte')>
			>();
		const screen = render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Mystery Pick' }],
			emptyStateMessage: null,
			loadMysteryRoom: () => deferredRoom.promise,
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame'
		});

		await expect.element(page.getByText('#1 CHAMPION')).toBeVisible();

		await screen.rerender({
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Mystery Pick' }],
			emptyStateMessage: null,
			loadMysteryRoom: () => deferredRoom.promise,
			room: getGalleryRoom('mystery'),
			roomId: 'mystery'
		});

		await expect.element(page.getByTestId('gallery-room-loading')).toBeVisible();

		deferredRoom.resolve(await import('./rooms/MysteryRoom.svelte'));

		await expect.element(page.getByTestId('film-reel')).toBeVisible();
	});

	it('keeps hall-of-fame podium hero artwork eager while deferring ranked cards', async () => {
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

		await expect.element(page.getByAltText('Champion')).toHaveAttribute('loading', 'eager');
		await expect.element(page.getByAltText('Champion')).toHaveAttribute('decoding', 'sync');
		await expect.element(page.getByAltText('Gallery Favorite')).toHaveAttribute('loading', 'lazy');
		await expect
			.element(page.getByAltText('Gallery Favorite'))
			.toHaveAttribute('decoding', 'async');
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

	it('hides authenticated-only gallery chrome from signed-out visitors', async () => {
		render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'No artworks have reached this gallery room yet.',
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame',
			viewer: null
		});

		await expect.element(page.getByRole('link', { name: 'Your Studio' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Create Art' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
		await expect
			.element(page.getByText('New pieces will appear here as artists publish them.'))
			.toBeVisible();
	});

	it('shows authenticated gallery chrome and personal empty-state guidance for users', async () => {
		invalidateAll.mockReset();

		render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'You have not published any artworks yet.',
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByRole('link', { name: 'Your Studio' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Create Art' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
		await expect
			.element(page.getByText('Publish a new piece from the studio and it will show up here.'))
			.toBeVisible();

		await page.getByRole('button', { name: 'Refresh' }).click();
		expect(invalidateAll).toHaveBeenCalledTimes(1);
	});

	it('uses the shared studio background and draw overlay in gallery', async () => {
		render(GalleryExplorationPage, {
			artworks: [],
			emptyStateMessage: 'You have not published any artworks yet.',
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByTestId('ambient-particle-overlay')).toBeVisible();
		await expect
			.element(page.getByTestId('gallery-wall-bricks'))
			.toHaveAttribute('style', expect.stringContaining('background-image: url('));
		await expect
			.element(page.getByTestId('gallery-room-shell'))
			.toHaveAttribute('style', expect.stringContaining('background-color: #252018;'));
		await expect
			.element(page.getByTestId('gallery-wall-bricks'))
			.toHaveAttribute('style', expect.stringContaining('background-size: 512px 512px;'));
	});

	it('renders the your studio room note in normal flow above the artworks', async () => {
		render(GalleryExplorationPage, {
			artworks: [{ ...baseArtwork, id: 'artwork-1', title: 'Desk Study' }],
			emptyStateMessage: null,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByTestId('your-studio-room-note-flow')).toBeVisible();
		await expect.element(page.getByText(getGalleryRoom('your-studio').description)).toBeVisible();
		await expect.element(page.getByRole('button', { name: /Desk Study/ })).toBeVisible();
	});

	it('does not request artwork detail during initial gallery render', async () => {
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
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect
			.element(page.getByRole('button', { name: /Deterministic Gallery Study/ }))
			.toBeVisible();
		expect(loadArtworkDetail).not.toHaveBeenCalled();
	});

	it('does not request artwork detail while scrolling the virtualized studio grid', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-1',
			title: 'Artwork 1'
		}));
		const loadMoreArtworks = vi.fn(async () => ({
			artworks: Array.from({ length: 12 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 25}`,
				title: `Artwork ${index + 25}`
			})),
			pageInfo: { hasMore: false, nextCursor: null }
		}));

		render(GalleryExplorationPage, {
			artworks: Array.from({ length: 24 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: true, nextCursor: 'cursor-1' },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadArtworkDetail,
			loadMoreArtworks,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		window.scrollTo(0, 10000);
		window.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => {
			expect(loadMoreArtworks).toHaveBeenCalledTimes(1);
		});
		expect(loadArtworkDetail).not.toHaveBeenCalled();
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
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		await page.getByRole('button', { name: /Deterministic Gallery Study/ }).click();
		await vi.waitFor(() => {
			expect(loadArtworkDetail).toHaveBeenCalledWith('artwork-1');
		});
		await expect
			.element(
				page.getByRole('dialog', { name: 'Artwork details for Deterministic Gallery Study' })
			)
			.toBeVisible();
	});

	it('opens artwork detail from a visible virtualized studio card without losing room context', async () => {
		const loadArtworkDetail = vi.fn(async () => ({
			...baseArtwork,
			forkCount: 0,
			id: 'artwork-18',
			title: 'Artwork 18'
		}));

		render(GalleryExplorationPage, {
			artworks: Array.from({ length: 24 }, (_, index) => ({
				...baseArtwork,
				id: `artwork-${index + 1}`,
				title: `Artwork ${index + 1}`
			})),
			discovery: {
				pageInfo: { hasMore: false, nextCursor: null },
				request: { authorId: 'user-1', limit: 24, sort: 'recent', window: null }
			},
			emptyStateMessage: null,
			loadArtworkDetail,
			room: getGalleryRoom('your-studio'),
			roomId: 'your-studio',
			viewer: { id: 'user-1', role: 'user' }
		});

		window.scrollTo(0, 1200);
		window.dispatchEvent(new Event('scroll'));

		await page.getByRole('button', { name: /Artwork 18/ }).click();

		await expect
			.element(page.getByRole('dialog', { name: 'Artwork details for Artwork 18' }))
			.toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Your Studio' })).toBeVisible();
		expect(loadArtworkDetail).toHaveBeenCalledWith('artwork-18');
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

		await expect.element(page.getByText('#1 CHAMPION')).toBeVisible();
		await expect.element(page.getByText('#2 RUNNER UP')).toBeVisible();
	});

	it('blurs nsfw artworks until the viewer enables 18+ content', async () => {
		const fetchSpy = vi.fn(
			async () => new Response(JSON.stringify({ adultContentEnabled: true }), { status: 200 })
		);
		vi.stubGlobal('fetch', fetchSpy);

		render(GalleryExplorationPage, {
			adultContentEnabled: false,
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', isNsfw: true, rank: 1, title: 'Adults only study' }
			],
			emptyStateMessage: null,
			loadArtworkDetail: async () => ({
				...baseArtwork,
				id: 'artwork-1',
				isNsfw: true,
				title: 'Adults only study'
			}),
			room: getGalleryRoom('hall-of-fame'),
			roomId: 'hall-of-fame',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByText('18+ artworks', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Sensitive artwork', { exact: true })).toBeVisible();
		await page.getByRole('button', { exact: true, name: 'Reveal 18+ artworks' }).click();

		expect(fetchSpy).toHaveBeenCalledWith('/api/viewer/content-preferences', {
			body: JSON.stringify({ adultContentEnabled: true }),
			headers: { 'content-type': 'application/json' },
			method: 'PATCH'
		});
		await expect.element(page.getByRole('button', { name: /Adults only study/ })).toBeVisible();
	});

	it('uses frames only for the top-three podium artworks in hall of fame', async () => {
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
		await expect.element(page.getByTestId('podium-plaque-1')).toBeVisible();
		await expect.element(page.getByTestId('podium-plaque-2')).toBeVisible();
		await expect.element(page.getByTestId('podium-plaque-3')).toBeVisible();
		await expect.element(page.getByTestId('ranked-polaroid-artwork-4')).toBeVisible();
		await expect.element(page.getByTestId('ranked-frame-artwork-4')).not.toBeInTheDocument();
	});

	it.skip('uses polaroids for the hot wall secondary grid artworks', async () => {
		render(GalleryExplorationPage, {
			artworks: [
				{ ...baseArtwork, id: 'artwork-1', title: 'Lead Heat' },
				{ ...baseArtwork, id: 'artwork-2', title: 'Second Spark' },
				{ ...baseArtwork, id: 'artwork-3', title: 'Third Spark' },
				{ ...baseArtwork, id: 'artwork-4', title: 'Fourth Spark' },
				{ ...baseArtwork, id: 'artwork-5', title: 'Fifth Spark' }
			],
			emptyStateMessage: null,
			room: getGalleryRoom('hot-wall'),
			roomId: 'hot-wall',
			viewer: { id: 'user-1', role: 'user' }
		});

		await expect.element(page.getByTestId('hot-wall-frame-artwork-1')).toBeVisible();
		await expect.element(page.getByTestId('hot-wall-polaroid-artwork-5')).toBeVisible();
		await expect.element(page.getByTestId('hot-wall-riser-artwork-5')).not.toBeInTheDocument();
	});
});
