import {
	compactDrawingDocumentLosslessly,
	normalizeDrawingStrokeExactly,
	resolveSafeRasterGuardPreset,
	SAFE_RASTER_GUARD_PRESETS,
	type SafeRasterGuardPresetId
} from './compaction';
import {
	normalizeDrawingDocumentToEditableV2,
	type DrawingDocument,
	type DrawingDocumentV2,
	type DrawingStroke
} from './document';

export const DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID: SafeRasterGuardPresetId =
	'veryConservative';
export const DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS = 1000;

export type PrepareDrawingDocumentForPublishOptions = {
	maxStrokeCoveragePixels?: number | null;
	minTailPoints?: number;
	rasterGuardPresetId?: SafeRasterGuardPresetId;
};

const resolveMinTailPoints = (value?: number) => {
	if (value === undefined) {
		return DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS;
	}

	if (!Number.isFinite(value)) {
		return DEFAULT_CLIENT_PUBLISH_MIN_TAIL_POINTS;
	}

	return Math.max(0, Math.floor(value));
};

const resolvePublishCompactionPixels = (
	document: DrawingDocumentV2,
	options: PrepareDrawingDocumentForPublishOptions
) => {
	if (Object.hasOwn(options, 'maxStrokeCoveragePixels')) {
		return options.maxStrokeCoveragePixels ?? null;
	}

	const presetId =
		options.rasterGuardPresetId ?? DEFAULT_CLIENT_PUBLISH_SAFE_RASTER_GUARD_PRESET_ID;
	if (!(presetId in SAFE_RASTER_GUARD_PRESETS)) {
		throw new Error(`Unsupported raster guard preset: ${String(presetId)}`);
	}

	return resolveSafeRasterGuardPreset(presetId, {
		height: document.height,
		width: document.width
	}).maxStrokeCoveragePixels;
};

const normalizeOrderedStrokesExactly = (document: DrawingDocumentV2) =>
	[...document.base, ...document.tail].map((stroke) => normalizeDrawingStrokeExactly(stroke));

const getProtectedTailStartIndex = (orderedStrokes: DrawingStroke[], minTailPoints: number) => {
	if (orderedStrokes.length === 0) {
		return 0;
	}

	if (minTailPoints <= 0) {
		return orderedStrokes.length;
	}

	let totalTailPoints = 0;
	for (let strokeIndex = orderedStrokes.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
		totalTailPoints += orderedStrokes[strokeIndex]!.points.length;
		if (totalTailPoints >= minTailPoints || strokeIndex === 0) {
			return strokeIndex;
		}
	}

	return 0;
};

export const prepareDrawingDocumentForPublish = (
	document: DrawingDocument,
	options: PrepareDrawingDocumentForPublishOptions = {}
): DrawingDocumentV2 => {
	const editableDocument = normalizeDrawingDocumentToEditableV2(document);
	const orderedStrokes = normalizeOrderedStrokesExactly(editableDocument);
	const minTailPoints = resolveMinTailPoints(options.minTailPoints);
	const protectedTailStartIndex = getProtectedTailStartIndex(orderedStrokes, minTailPoints);
	const prefixStrokes = orderedStrokes.slice(0, protectedTailStartIndex);
	const protectedTail = orderedStrokes.slice(protectedTailStartIndex);
	const compactedPrefix =
		prefixStrokes.length === 0
			? []
			: compactDrawingDocumentLosslessly(
					{
						...editableDocument,
						base: prefixStrokes,
						tail: []
					},
					{
						maxStrokeCoveragePixels: resolvePublishCompactionPixels(editableDocument, options)
					}
				).base;

	return {
		...editableDocument,
		base: compactedPrefix,
		tail: protectedTail
	};
};
