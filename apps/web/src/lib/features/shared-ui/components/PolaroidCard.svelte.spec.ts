import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
import PolaroidCard from './PolaroidCard.svelte';

const artwork = {
	artist: 'journey_artist',
	artistAvatar: undefined,
	authorId: 'user-journey',
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

	it('blurs NSFW artworks for non-authors and forwards viewerId for exemption', async () => {
		render(PolaroidCard, {
			artwork: { ...artwork, isNsfw: true },
			viewerId: 'other-user',
			testId: 'nsfw-polaroid-card'
		});

		const image = page.getByAltText('Pinned Study');

		await expect.element(image).toBeInTheDocument();
		await expect.element(image).toHaveAttribute('aria-label', 'Sensitive artwork, click to reveal');
	});

	it('skips blur for NSFW artwork when viewer is the author', async () => {
		render(PolaroidCard, {
			artwork: { ...artwork, isNsfw: true },
			viewerId: 'user-journey',
			testId: 'author-polaroid-card'
		});

		const image = page.getByAltText('Pinned Study');

		await expect.element(image).toBeInTheDocument();
		await expect.element(image).not.toHaveAttribute('aria-label');
	});

	it('toggles revealed state on click, removing blur', async () => {
		render(PolaroidCard, {
			artwork: { ...artwork, isNsfw: true },
			viewerId: 'other-user',
			testId: 'reveal-polaroid-card'
		});

		const image = page.getByAltText('Pinned Study');

		await expect.element(image).toBeInTheDocument();
		await expect.element(image).toHaveAttribute('aria-label', 'Sensitive artwork, click to reveal');

		// Simulate click event by invoking onclick
		const card = page.getByTestId('reveal-polaroid-card');
		await card.click();

		await expect.element(image).not.toHaveAttribute('aria-label');
	});

	it('notifies the owner of the reveal state and suppresses card selection on the reveal click', async () => {
		const onReveal = vi.fn();
		const onclick = vi.fn();

		render(PolaroidCard, {
			artwork: { ...artwork, isNsfw: true },
			viewerId: 'other-user',
			onReveal,
			onclick,
			testId: 'controlled-reveal-card'
		});

		const card = page.getByTestId('controlled-reveal-card');
		await card.click();

		expect(onReveal).toHaveBeenCalledTimes(1);
		expect(onclick).not.toHaveBeenCalled();

		await card.click();

		expect(onReveal).toHaveBeenCalledTimes(1);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('never reveals for signed-out visitors — the click falls through to selection', async () => {
		const onReveal = vi.fn();
		const onclick = vi.fn();

		render(PolaroidCard, {
			artwork: { ...artwork, isNsfw: true },
			viewerId: null,
			onReveal,
			onclick,
			testId: 'signed-out-card'
		});

		const image = page.getByAltText('Pinned Study');

		await expect.element(image).toHaveAttribute('aria-label', 'Sensitive artwork');

		await page.getByTestId('signed-out-card').click();

		expect(onReveal).not.toHaveBeenCalled();
		expect(onclick).toHaveBeenCalledTimes(1);
		await expect.element(image).toHaveAttribute('aria-label', 'Sensitive artwork');
	});

	it('honors an externally revealed state so reveals survive virtualization remounts', async () => {
		const onclick = vi.fn();

		render(PolaroidCard, {
			artwork: { ...artwork, isNsfw: true },
			viewerId: 'other-user',
			revealed: true,
			onclick,
			testId: 'external-reveal-card'
		});

		const image = page.getByAltText('Pinned Study');

		await expect.element(image).not.toHaveAttribute('aria-label');

		await page.getByTestId('external-reveal-card').click();

		expect(onclick).toHaveBeenCalledTimes(1);
	});
});
