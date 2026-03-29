import { describe, expect, it } from 'vitest';
import {
	isPremiumPodiumPosition,
	premiumArtworkFramePresets,
	resolveArtworkFrame,
	standardArtworkFramePresets
} from './frame';

describe('resolveArtworkFrame', () => {
	it('keeps the same standard frame for the same artwork across renders', () => {
		const first = resolveArtworkFrame({ artworkId: 'artwork-1' });
		const second = resolveArtworkFrame({ artworkId: 'artwork-1' });

		expect(first).toEqual(second);
		expect(first.tier).toBe('standard');
		expect(standardArtworkFramePresets).toContainEqual(first.preset);
	});

	it('uses the premium tier for podium positions one through three only', () => {
		for (const position of [1, 2, 3] as const) {
			const frame = resolveArtworkFrame({
				artworkId: `winner-${position}`,
				podiumPosition: position
			});

			expect(frame.tier).toBe('premium');
			expect(frame.isPremium).toBe(true);
			expect(premiumArtworkFramePresets).toContainEqual(frame.preset);
		}

		expect(resolveArtworkFrame({ artworkId: 'artwork-4', podiumPosition: 4 }).tier).toBe(
			'standard'
		);
	});

	it('produces variety across the standard preset pool', () => {
		const presetIds = new Set(
			['artwork-1', 'artwork-2', 'artwork-3', 'artwork-4', 'artwork-5', 'artwork-6'].map(
				(artworkId) => resolveArtworkFrame({ artworkId }).preset.id
			)
		);

		expect(presetIds.size).toBeGreaterThan(1);
	});
});

describe('isPremiumPodiumPosition', () => {
	it('accepts only podium positions one through three', () => {
		expect(isPremiumPodiumPosition(1)).toBe(true);
		expect(isPremiumPodiumPosition(2)).toBe(true);
		expect(isPremiumPodiumPosition(3)).toBe(true);
		expect(isPremiumPodiumPosition(0)).toBe(false);
		expect(isPremiumPodiumPosition(4)).toBe(false);
		expect(isPremiumPodiumPosition(undefined)).toBe(false);
	});
});
