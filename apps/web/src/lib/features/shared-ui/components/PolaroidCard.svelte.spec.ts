import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import PolaroidCard from './PolaroidCard.svelte';

const artwork = {
	artist: 'journey_artist',
	artistAvatar: undefined,
	commentCount: 0,
	comments: [],
	downvotes: 0,
	forkCount: 0,
	id: 'artwork-1',
	imageUrl: '/api/artworks/artwork-1/media',
	isNsfw: false,
	lineage: { isFork: false, parent: null, parentStatus: 'none' },
	score: 12,
	timestamp: Date.now(),
	title: 'Pinned Study',
	upvotes: 0,
	viewerVote: null
} satisfies Artwork;

describe('PolaroidCard', () => {
	it('renders avatar, title-author column, and right-aligned metrics', async () => {
		render(PolaroidCard, {
			artwork: {
				...artwork,
				commentCount: 5,
				score: 12
			},
			testId: 'polaroid-card'
		});

		await expect.element(page.getByText('Pinned Study')).toBeVisible();
		await expect.element(page.getByText('journey_artist')).toBeVisible();
		await expect.element(page.getByTestId('polaroid-card-score')).toHaveTextContent('⭐ 12');
		await expect.element(page.getByTestId('polaroid-card-comments')).toHaveTextContent('💬 5');
	});

	it('shows fork lineage on forked artworks', async () => {
		render(PolaroidCard, {
			artwork: {
				...artwork,
				lineage: {
					isFork: true,
					parent: {
						author: { avatarUrl: null, id: 'user-parent', nickname: 'origin_artist' },
						id: 'artwork-parent',
						title: 'Fork Source'
					},
					parentStatus: 'available'
				}
			}
		});

		await expect.element(page.getByText('Forked')).toBeVisible();
		await expect.element(page.getByText('From Fork Source')).toBeVisible();
	});

	it('marks the artwork image for progressive loading', async () => {
		render(PolaroidCard, { artwork });

		const image = page.getByAltText('Pinned Study');

		await expect.element(image).toHaveAttribute('loading', 'lazy');
		await expect.element(image).toHaveAttribute('decoding', 'async');
	});
});
