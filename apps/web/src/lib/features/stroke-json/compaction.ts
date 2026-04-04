import {
	clampDrawingPoint,
	normalizeDrawingDocumentToV2,
	type DrawingDocument,
	type DrawingDocumentV2,
	type DrawingPoint,
	type DrawingStroke
} from './document';

type RasterDimensions = Pick<DrawingDocumentV2, 'height' | 'width'>;

type StrokeSample = {
	distance: number;
	point: [number, number];
};

type StrokeFragmentInterval = {
	endDistance: number;
	startDistance: number;
};

export type LosslessCompactionOptions = {
	maxStrokeCoveragePixels?: number | null;
};

export type LosslessCompactionStats = {
	largestSkippedStrokeCoveragePixels: number;
	maxStrokeCoveragePixels: number | null;
	skippedPartialCompactionStrokeCount: number;
};

export type LosslessCompactionResult = {
	document: DrawingDocumentV2;
	stats: LosslessCompactionStats;
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

const SAMPLE_STEP = 0.5;
const PIXEL_CENTER_MARGIN = Math.SQRT2 / 2;
const textEncoder = new TextEncoder();

const resolveMaxStrokeCoveragePixels = (value?: number | null) => {
	if (value === null || value === undefined) {
		return null;
	}

	if (!Number.isFinite(value)) {
		return null;
	}

	return Math.max(1, Math.floor(value));
};

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

const cloneStroke = (stroke: DrawingStroke): DrawingStroke => ({
	color: stroke.color,
	points: stroke.points.map((point) => [point[0], point[1]] as DrawingPoint),
	size: stroke.size
});

const pointsAreEqual = (left: DrawingPoint, right: DrawingPoint) =>
	left[0] === right[0] && left[1] === right[1];

const dedupeConsecutivePoints = (points: DrawingPoint[]) => {
	const deduped: DrawingPoint[] = [];

	for (const point of points) {
		if (!deduped.length || !pointsAreEqual(deduped[deduped.length - 1]!, point)) {
			deduped.push([point[0], point[1]]);
		}
	}

	return deduped;
};

const isStrictlyCollinear = (previous: DrawingPoint, current: DrawingPoint, next: DrawingPoint) => {
	const crossProduct =
		(current[0] - previous[0]) * (next[1] - previous[1]) -
		(current[1] - previous[1]) * (next[0] - previous[0]);

	if (crossProduct !== 0) {
		return false;
	}

	const minX = Math.min(previous[0], next[0]);
	const maxX = Math.max(previous[0], next[0]);
	const minY = Math.min(previous[1], next[1]);
	const maxY = Math.max(previous[1], next[1]);

	return current[0] >= minX && current[0] <= maxX && current[1] >= minY && current[1] <= maxY;
};

const serializeStrokeCanonically = (stroke: DrawingStroke) =>
	JSON.stringify({
		color: stroke.color,
		size: stroke.size,
		points: stroke.points.map((point) => [point[0], point[1]])
	});

const getSerializedStrokeBytes = (strokes: DrawingStroke[]) =>
	textEncoder.encode(`[${strokes.map(serializeStrokeCanonically).join(',')}]`).byteLength;

const distanceFromPointToSegment = (
	pointX: number,
	pointY: number,
	startX: number,
	startY: number,
	endX: number,
	endY: number
) => {
	const deltaX = endX - startX;
	const deltaY = endY - startY;

	if (deltaX === 0 && deltaY === 0) {
		return Math.hypot(pointX - startX, pointY - startY);
	}

	const projection =
		((pointX - startX) * deltaX + (pointY - startY) * deltaY) / (deltaX * deltaX + deltaY * deltaY);
	const clampedProjection = Math.max(0, Math.min(1, projection));
	const nearestX = startX + deltaX * clampedProjection;
	const nearestY = startY + deltaY * clampedProjection;

	return Math.hypot(pointX - nearestX, pointY - nearestY);
};

const addCoverageForDisc = (
	coverage: Set<number>,
	centerX: number,
	centerY: number,
	radius: number,
	dimensions: RasterDimensions
) => {
	const minX = Math.max(0, Math.floor(centerX - radius - 1));
	const maxX = Math.min(dimensions.width - 1, Math.ceil(centerX + radius));
	const minY = Math.max(0, Math.floor(centerY - radius - 1));
	const maxY = Math.min(dimensions.height - 1, Math.ceil(centerY + radius));

	for (let y = minY; y <= maxY; y += 1) {
		for (let x = minX; x <= maxX; x += 1) {
			const pixelCenterX = x + 0.5;
			const pixelCenterY = y + 0.5;

			if (Math.hypot(pixelCenterX - centerX, pixelCenterY - centerY) <= radius) {
				coverage.add(y * dimensions.width + x);
			}
		}
	}
};

const addCoverageForSegment = (
	coverage: Set<number>,
	start: DrawingPoint,
	end: DrawingPoint,
	radius: number,
	dimensions: RasterDimensions
) => {
	const minX = Math.max(0, Math.floor(Math.min(start[0], end[0]) - radius - 1));
	const maxX = Math.min(dimensions.width - 1, Math.ceil(Math.max(start[0], end[0]) + radius));
	const minY = Math.max(0, Math.floor(Math.min(start[1], end[1]) - radius - 1));
	const maxY = Math.min(dimensions.height - 1, Math.ceil(Math.max(start[1], end[1]) + radius));

	for (let y = minY; y <= maxY; y += 1) {
		for (let x = minX; x <= maxX; x += 1) {
			const pixelCenterX = x + 0.5;
			const pixelCenterY = y + 0.5;

			if (
				distanceFromPointToSegment(
					pixelCenterX,
					pixelCenterY,
					start[0],
					start[1],
					end[0],
					end[1]
				) <= radius
			) {
				coverage.add(y * dimensions.width + x);
			}
		}
	}
};

const getDiscCoveragePixelIndices = (
	point: [number, number],
	brushSize: number,
	dimensions: RasterDimensions
) => {
	const coverage = new Set<number>();
	addCoverageForDisc(coverage, point[0], point[1], brushSize / 2 + PIXEL_CENTER_MARGIN, dimensions);
	return Array.from(coverage).sort((left, right) => left - right);
};

export const getRasterCoveragePixelIndices = (
	stroke: DrawingStroke,
	dimensions: RasterDimensions
) => {
	const coverage = new Set<number>();
	const radius = stroke.size / 2 + PIXEL_CENTER_MARGIN;

	if (stroke.points.length === 1) {
		addCoverageForDisc(coverage, stroke.points[0]![0], stroke.points[0]![1], radius, dimensions);
		return Array.from(coverage).sort((left, right) => left - right);
	}

	for (let index = 0; index < stroke.points.length - 1; index += 1) {
		addCoverageForSegment(
			coverage,
			stroke.points[index]!,
			stroke.points[index + 1]!,
			radius,
			dimensions
		);
	}

	return Array.from(coverage).sort((left, right) => left - right);
};

export const normalizeDrawingStrokeExactly = (stroke: DrawingStroke): DrawingStroke => {
	const dedupedPoints = dedupeConsecutivePoints(stroke.points);

	if (dedupedPoints.length <= 2) {
		return {
			color: stroke.color,
			points: dedupedPoints,
			size: stroke.size
		};
	}

	const normalizedPoints: DrawingPoint[] = [dedupedPoints[0]!];

	for (let index = 1; index < dedupedPoints.length - 1; index += 1) {
		const previous = normalizedPoints[normalizedPoints.length - 1]!;
		const current = dedupedPoints[index]!;
		const next = dedupedPoints[index + 1]!;

		if (isStrictlyCollinear(previous, current, next)) {
			continue;
		}

		normalizedPoints.push(current);
	}

	normalizedPoints.push(dedupedPoints[dedupedPoints.length - 1]!);

	return {
		color: stroke.color,
		points: normalizedPoints,
		size: stroke.size
	};
};

const sampleStrokeCenterline = (stroke: DrawingStroke): StrokeSample[] => {
	if (stroke.points.length === 1) {
		return [{ distance: 0, point: [stroke.points[0]![0], stroke.points[0]![1]] }];
	}

	const samples: StrokeSample[] = [];
	let cumulativeDistance = 0;

	for (let index = 0; index < stroke.points.length - 1; index += 1) {
		const start = stroke.points[index]!;
		const end = stroke.points[index + 1]!;
		const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1]);

		if (index === 0) {
			samples.push({ distance: 0, point: [start[0], start[1]] });
		}

		if (segmentLength === 0) {
			continue;
		}

		const sampleCount = Math.max(1, Math.ceil(segmentLength / SAMPLE_STEP));

		for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
			const t = sampleIndex / sampleCount;
			samples.push({
				distance: cumulativeDistance + segmentLength * t,
				point: [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]
			});
		}

		cumulativeDistance += segmentLength;
	}

	return samples;
};

const getVisibleIntervals = (samples: StrokeSample[], visibility: boolean[]) => {
	const intervals: StrokeFragmentInterval[] = [];
	let currentStart: number | null = null;

	for (let index = 0; index < samples.length; index += 1) {
		if (visibility[index] && currentStart === null) {
			currentStart = samples[index]!.distance;
		}

		const shouldClose =
			currentStart !== null && (!visibility[index] || index === samples.length - 1);
		if (!shouldClose) {
			continue;
		}

		const startDistance = currentStart;
		if (startDistance === null) {
			continue;
		}

		const endDistance = visibility[index]
			? samples[index]!.distance
			: (samples[index - 1]?.distance ?? startDistance);
		intervals.push({ endDistance, startDistance });
		currentStart = null;
	}

	return intervals.filter((interval) => interval.endDistance >= interval.startDistance);
};

const buildStrokeDistanceMap = (stroke: DrawingStroke) => {
	const distances = [0];

	for (let index = 1; index < stroke.points.length; index += 1) {
		const previous = stroke.points[index - 1]!;
		const current = stroke.points[index]!;
		distances.push(
			distances[index - 1]! + Math.hypot(current[0] - previous[0], current[1] - previous[1])
		);
	}

	return distances;
};

const pointAtDistance = (
	stroke: DrawingStroke,
	distances: number[],
	distance: number,
	dimensions: RasterDimensions
): DrawingPoint => {
	if (stroke.points.length === 1) {
		return [stroke.points[0]![0], stroke.points[0]![1]] as DrawingPoint;
	}

	const totalLength = distances[distances.length - 1] ?? 0;
	if (distance <= 0) {
		return [stroke.points[0]![0], stroke.points[0]![1]] as DrawingPoint;
	}
	if (distance >= totalLength) {
		const lastPoint = stroke.points[stroke.points.length - 1]!;
		return [lastPoint[0], lastPoint[1]] as DrawingPoint;
	}

	for (let index = 1; index < distances.length; index += 1) {
		const previousDistance = distances[index - 1]!;
		const currentDistance = distances[index]!;
		if (distance > currentDistance) {
			continue;
		}

		const start = stroke.points[index - 1]!;
		const end = stroke.points[index]!;
		const segmentLength = currentDistance - previousDistance;
		const t = segmentLength === 0 ? 0 : (distance - previousDistance) / segmentLength;

		return clampDrawingPoint(
			[start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t],
			dimensions
		);
	}

	const fallbackPoint = stroke.points[stroke.points.length - 1]!;
	return [fallbackPoint[0], fallbackPoint[1]] as DrawingPoint;
};

const buildStrokeFragments = (
	stroke: DrawingStroke,
	intervals: StrokeFragmentInterval[],
	dimensions: RasterDimensions
) => {
	if (stroke.points.length === 1) {
		return intervals.length ? [cloneStroke(stroke)] : [];
	}

	const distances = buildStrokeDistanceMap(stroke);
	const fragments: DrawingStroke[] = [];

	for (const interval of intervals) {
		const nextPoints: DrawingPoint[] = [];
		const startPoint = pointAtDistance(stroke, distances, interval.startDistance, dimensions);
		const endPoint = pointAtDistance(stroke, distances, interval.endDistance, dimensions);

		nextPoints.push(startPoint);

		for (let index = 1; index < stroke.points.length - 1; index += 1) {
			const distance = distances[index]!;
			if (distance <= interval.startDistance || distance >= interval.endDistance) {
				continue;
			}

			nextPoints.push([stroke.points[index]![0], stroke.points[index]![1]] as DrawingPoint);
		}

		if (!pointsAreEqual(nextPoints[nextPoints.length - 1]!, endPoint)) {
			nextPoints.push(endPoint);
		}

		const dedupedPoints = dedupeConsecutivePoints(nextPoints);
		if (!dedupedPoints.length) {
			continue;
		}

		fragments.push({
			color: stroke.color,
			points: dedupedPoints,
			size: stroke.size
		});
	}

	return fragments;
};

const buildOwnershipBuffer = (strokes: DrawingStroke[], dimensions: RasterDimensions) => {
	const ownerByPixel = new Int32Array(dimensions.width * dimensions.height).fill(-1);
	const coverageByStroke = strokes.map((stroke) =>
		getRasterCoveragePixelIndices(stroke, dimensions)
	);

	for (let strokeIndex = 0; strokeIndex < coverageByStroke.length; strokeIndex += 1) {
		for (const pixelIndex of coverageByStroke[strokeIndex]!) {
			ownerByPixel[pixelIndex] = strokeIndex;
		}
	}

	return { coverageByStroke, ownerByPixel };
};

const isSampleHidden = (
	sample: StrokeSample,
	strokeIndex: number,
	stroke: DrawingStroke,
	ownerByPixel: Int32Array,
	dimensions: RasterDimensions
) => {
	for (const pixelIndex of getDiscCoveragePixelIndices(sample.point, stroke.size, dimensions)) {
		if (ownerByPixel[pixelIndex] <= strokeIndex) {
			return false;
		}
	}

	return true;
};

const coverageDifferenceIsHidden = (
	originalCoverage: number[],
	candidateCoverage: number[],
	ownerByPixel: Int32Array,
	strokeIndex: number
) => {
	const originalSet = new Set(originalCoverage);
	const candidateSet = new Set(candidateCoverage);

	for (const pixelIndex of originalCoverage) {
		if (!candidateSet.has(pixelIndex) && ownerByPixel[pixelIndex] <= strokeIndex) {
			return false;
		}
	}

	for (const pixelIndex of candidateCoverage) {
		if (!originalSet.has(pixelIndex) && ownerByPixel[pixelIndex] <= strokeIndex) {
			return false;
		}
	}

	return true;
};

const collectCandidateCoverage = (fragments: DrawingStroke[], dimensions: RasterDimensions) => {
	const coverage = new Set<number>();

	for (const fragment of fragments) {
		for (const pixelIndex of getRasterCoveragePixelIndices(fragment, dimensions)) {
			coverage.add(pixelIndex);
		}
	}

	return Array.from(coverage).sort((left, right) => left - right);
};

const normalizeDocumentStrokesExactly = (document: DrawingDocument): DrawingDocumentV2 => {
	const normalizedDocument = normalizeDrawingDocumentToV2(document);

	return {
		...normalizedDocument,
		base: normalizedDocument.base.map(normalizeDrawingStrokeExactly),
		tail: normalizedDocument.tail.map(normalizeDrawingStrokeExactly)
	};
};

export const compactDrawingDocumentLosslesslyWithReport = (
	document: DrawingDocument,
	options: LosslessCompactionOptions = {}
): LosslessCompactionResult => {
	const normalizedDocument = normalizeDocumentStrokesExactly(document);
	const orderedStrokes = [...normalizedDocument.base, ...normalizedDocument.tail];
	const dimensions = { height: normalizedDocument.height, width: normalizedDocument.width };
	const { coverageByStroke, ownerByPixel } = buildOwnershipBuffer(orderedStrokes, dimensions);
	const maxStrokeCoveragePixels = resolveMaxStrokeCoveragePixels(options.maxStrokeCoveragePixels);
	const compactedBase: DrawingStroke[] = [];
	let skippedPartialCompactionStrokeCount = 0;
	let largestSkippedStrokeCoveragePixels = 0;

	for (let strokeIndex = 0; strokeIndex < orderedStrokes.length; strokeIndex += 1) {
		const stroke = orderedStrokes[strokeIndex]!;
		const originalCoverage = coverageByStroke[strokeIndex]!;
		const hasLaterStrokes = strokeIndex < orderedStrokes.length - 1;

		if (!originalCoverage.length) {
			continue;
		}

		if (originalCoverage.every((pixelIndex) => ownerByPixel[pixelIndex] > strokeIndex)) {
			continue;
		}

		if (
			hasLaterStrokes &&
			maxStrokeCoveragePixels !== null &&
			originalCoverage.length > maxStrokeCoveragePixels
		) {
			skippedPartialCompactionStrokeCount += 1;
			largestSkippedStrokeCoveragePixels = Math.max(
				largestSkippedStrokeCoveragePixels,
				originalCoverage.length
			);
			compactedBase.push(cloneStroke(stroke));
			continue;
		}

		const samples = sampleStrokeCenterline(stroke);
		const visibility = samples.map(
			(sample) => !isSampleHidden(sample, strokeIndex, stroke, ownerByPixel, dimensions)
		);

		if (visibility.every(Boolean)) {
			compactedBase.push(cloneStroke(stroke));
			continue;
		}

		const intervals = getVisibleIntervals(samples, visibility);
		if (!intervals.length) {
			continue;
		}

		const candidateFragments = buildStrokeFragments(stroke, intervals, dimensions);
		if (!candidateFragments.length) {
			compactedBase.push(cloneStroke(stroke));
			continue;
		}

		const candidateCoverage = collectCandidateCoverage(candidateFragments, dimensions);
		if (
			!coverageDifferenceIsHidden(originalCoverage, candidateCoverage, ownerByPixel, strokeIndex)
		) {
			compactedBase.push(cloneStroke(stroke));
			continue;
		}

		if (getSerializedStrokeBytes(candidateFragments) >= getSerializedStrokeBytes([stroke])) {
			compactedBase.push(cloneStroke(stroke));
			continue;
		}

		compactedBase.push(...candidateFragments.map(cloneStroke));
	}

	return {
		document: {
			background: normalizedDocument.background,
			base: compactedBase,
			height: normalizedDocument.height,
			kind: normalizedDocument.kind,
			tail: [],
			version: normalizedDocument.version,
			width: normalizedDocument.width
		},
		stats: {
			largestSkippedStrokeCoveragePixels,
			maxStrokeCoveragePixels,
			skippedPartialCompactionStrokeCount
		}
	};
};

export const compactDrawingDocumentLosslessly = (
	document: DrawingDocument,
	options: LosslessCompactionOptions = {}
): DrawingDocumentV2 => compactDrawingDocumentLosslesslyWithReport(document, options).document;
