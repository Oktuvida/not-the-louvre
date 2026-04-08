type RasterDimensions = {
	height: number;
	width: number;
};

export const SAFE_RASTER_GUARD_PRESETS = {
	canonical: {
		coverageAreaRatio: null,
		label: 'Canonical (no max area)'
	},
	conservative: {
		coverageAreaRatio: 0.015,
		label: 'Conservative (1.5% canvas)'
	},
	veryConservative: {
		coverageAreaRatio: 0.005,
		label: 'Very conservative (0.50% canvas)'
	}
} as const;

export type SafeRasterGuardPresetId = keyof typeof SAFE_RASTER_GUARD_PRESETS;

export const DEFAULT_SAFE_RASTER_GUARD_PRESET_ID: SafeRasterGuardPresetId = 'canonical';

export const resolveSafeRasterGuardPreset = (
	presetId: SafeRasterGuardPresetId,
	dimensions: RasterDimensions
) => {
	const preset = SAFE_RASTER_GUARD_PRESETS[presetId];

	return {
		id: presetId,
		label: preset.label,
		maxStrokeCoveragePixels:
			preset.coverageAreaRatio === null
				? null
				: Math.max(1, Math.round(dimensions.width * dimensions.height * preset.coverageAreaRatio))
	};
};
