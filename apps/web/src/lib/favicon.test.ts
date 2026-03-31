import { describe, expect, it } from 'vitest';
import { resolveFaviconState, sketchFaviconHref } from './favicon';

describe('favicon state', () => {
	it('returns the sketch favicon when there is no authenticated user', () => {
		expect(resolveFaviconState(null)).toEqual({
			href: sketchFaviconHref,
			kind: 'sketch'
		});
	});

	it('returns the sketch favicon for authenticated users who still need avatar onboarding', () => {
		expect(
			resolveFaviconState({
				avatarOnboardingCompletedAt: null,
				avatarUrl: null,
				id: 'user-1',
				updatedAt: new Date('2026-03-29T12:30:00.000Z')
			})
		).toEqual({
			href: sketchFaviconHref,
			kind: 'sketch'
		});
	});

	it('returns the uploaded avatar endpoint with a cache-busting version for completed users', () => {
		expect(
			resolveFaviconState({
				avatarOnboardingCompletedAt: new Date('2026-03-29T11:00:00.000Z'),
				avatarUrl: 'avatars/user-1.avif',
				id: 'user-1',
				updatedAt: new Date('2026-03-29T12:30:00.000Z')
			})
		).toEqual({
			href: '/api/users/user-1/favicon?v=1774787400000',
			kind: 'avatar'
		});
	});
});
