import { describe, expect, it } from 'vitest';
import type { ArtworkDetail, ArtworkFeedCard } from '#lib/server/artwork/types.js';
import { toGalleryArtwork, toGalleryArtworkDetail } from './gallery-adapter';

const feedCard: ArtworkFeedCard = {
	author: { avatarUrl: '/avatars/journey.png', id: 'user-journey', nickname: 'journey_artist' },
	commentCount: 3,
	createdAt: new Date('2026-03-28T12:00:00.000Z'),
	downvotes: 1,
	forkCount: 2,
	id: 'artwork-1',
	isNsfw: false,
	lineage: { isFork: false, parent: null, parentStatus: 'none' },
	mediaUrl: '/api/artworks/artwork-1/media',
	score: 5,
	title: 'Pinned Study',
	upvotes: 6,
	viewerVote: 'up'
};

const detail: ArtworkDetail = {
	...feedCard,
	childForks: [],
	mediaContentType: 'image/avif',
	mediaSizeBytes: 1024,
	updatedAt: new Date('2026-03-28T12:30:00.000Z')
};

describe('gallery adapter', () => {
	it('keeps the room rank when hydrating a detail so the podium medal does not vanish', () => {
		expect(toGalleryArtworkDetail(detail).rank).toBeUndefined();
		expect(toGalleryArtworkDetail(detail, 1).rank).toBe(1);
		expect(toGalleryArtwork(feedCard, 2).rank).toBe(2);
	});
});
