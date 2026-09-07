import { describe, expect, it } from 'vitest';
import { isArtworkBlurred } from './sensitivity';

describe('isArtworkBlurred', () => {
	const nsfw = { authorId: 'user-journey', id: 'artwork-1', isNsfw: true };

	it('leaves safe artwork alone', () => {
		expect(isArtworkBlurred({ ...nsfw, isNsfw: false }, { adultContentEnabled: false })).toBe(
			false
		);
	});

	it('blurs sensitive artwork for a visitor without the 18+ preference', () => {
		expect(isArtworkBlurred(nsfw, { adultContentEnabled: false, id: 'user-other' })).toBe(true);
	});

	it('never blurs the author viewing their own piece', () => {
		expect(isArtworkBlurred(nsfw, { adultContentEnabled: false, id: 'user-journey' })).toBe(false);
	});

	it('honours the 18+ preference and an explicit reveal', () => {
		expect(isArtworkBlurred(nsfw, { adultContentEnabled: true, id: 'user-other' })).toBe(false);
		expect(
			isArtworkBlurred(nsfw, {
				adultContentEnabled: false,
				id: 'user-other',
				revealedIds: new Set(['artwork-1'])
			})
		).toBe(false);
	});

	it('answers for surfaces that know neither the author nor the reveal store', () => {
		expect(
			isArtworkBlurred({ id: 'preview-1', isNsfw: true }, { adultContentEnabled: false })
		).toBe(true);
		expect(isArtworkBlurred({ id: 'preview-1', isNsfw: true }, { adultContentEnabled: true })).toBe(
			false
		);
		// A surface that owns no reveal store may hand the slot over as null.
		expect(
			isArtworkBlurred(
				{ id: 'preview-1', isNsfw: true },
				{ adultContentEnabled: false, revealedIds: null }
			)
		).toBe(true);
	});
});
