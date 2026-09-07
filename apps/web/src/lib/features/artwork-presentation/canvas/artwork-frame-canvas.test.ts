import { describe, expect, it } from 'vitest';
import { getArtworkFrameOpening, getArtworkFrameOpeningRatio } from './artwork-frame-canvas';
import {
	premiumArtworkFramePresets,
	standardArtworkFramePresets
} from '$lib/features/artwork-presentation/model/frame';

describe('getArtworkFrameOpeningRatio', () => {
	it('matches the default moulding + inner lip + mat of the shipped presets', () => {
		expect(getArtworkFrameOpeningRatio()).toBeCloseTo(0.08 * (1 + 0.4 + 0.35), 10);
	});

	it('agrees with the painted opening for every preset', () => {
		const size = 640;

		for (const preset of [...standardArtworkFramePresets, ...premiumArtworkFramePresets]) {
			const opening = getArtworkFrameOpening(size, size, preset.renderOptions);
			const ratio = getArtworkFrameOpeningRatio(preset.renderOptions);

			// The canvas rounds each moulding step to whole device pixels, so the
			// pure ratio may differ by at most one pixel per rounding step.
			expect(Math.abs(opening.x - ratio * size)).toBeLessThanOrEqual(2);
			expect(Math.abs(opening.w - (size - ratio * size * 2))).toBeLessThanOrEqual(4);
		}
	});

	it('does not depend on the axis it is applied to', () => {
		const options = { innerMouldingRatio: 0.5, matRatio: 0.25, mouldingRatio: 0.1 };

		expect(getArtworkFrameOpeningRatio(options)).toBeCloseTo(0.175, 10);
	});
});
