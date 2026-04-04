import {
	Clipper64,
	ClipType as Clipper2ClipType,
	EndType as Clipper2EndType,
	FillRule as Clipper2FillRule,
	JoinType as Clipper2JoinType,
	inflatePaths
} from 'clipper2-ts';
import {
	getRasterCoveragePixelIndices,
	normalizeDrawingStrokeExactly,
	type LosslessCompactionOptions
} from './compaction';
import {
	clampDrawingPoint,
	normalizeDrawingDocumentToV2,
	type DrawingDocument,
	type DrawingDocumentV2,
	type DrawingPoint,
	type DrawingStroke
} from './document';

type GeometryPoint = {
	x: number;
	y: number;
};

type GeometryPath = GeometryPoint[];
type GeometryPaths = GeometryPath[];

type StrokeDimensions = Pick<DrawingDocumentV2, 'height' | 'width'>;

type StrokeProjection = {
	geometryPath: GeometryPath;
	segmentStartDistances: number[];
	segmentLengths: number[];
	totalLength: number;
};

type Phase2GeometryEngine = {
	buildOccluderPolygons: (stroke: DrawingStroke) => GeometryPaths;
	clipVisibleLineFragments: (
		stroke: DrawingStroke,
		laterOccluders: GeometryPaths,
		dimensions: StrokeDimensions
	) => DrawingStroke[];
	isDotFullyHidden: (stroke: DrawingStroke, laterOccluders: GeometryPaths) => boolean;
};

const ARC_TOLERANCE = 0.25;
const DOT_POLYGON_STEPS = 24;
const GEOMETRY_SCALE = 2;
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

const cloneStroke = (stroke: DrawingStroke): DrawingStroke => ({
	color: stroke.color,
	points: stroke.points.map((point) => [point[0], point[1]] as DrawingPoint),
	size: stroke.size
});

const serializeStrokeCanonically = (stroke: DrawingStroke) =>
	JSON.stringify({
		color: stroke.color,
		size: stroke.size,
		points: stroke.points.map((point) => [point[0], point[1]])
	});

const getSerializedStrokeBytes = (strokes: DrawingStroke[]) =>
	textEncoder.encode(`[${strokes.map(serializeStrokeCanonically).join(',')}]`).byteLength;

const buildRasterOwnershipBuffer = (strokes: DrawingStroke[], dimensions: StrokeDimensions) => {
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

const isCoverageFullyHidden = (coverage: number[], ownerByPixel: Int32Array, strokeIndex: number) =>
	coverage.every((pixelIndex) => ownerByPixel[pixelIndex] > strokeIndex);

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

const collectCandidateCoverage = (fragments: DrawingStroke[], dimensions: StrokeDimensions) => {
	const coverage = new Set<number>();

	for (const fragment of fragments) {
		for (const pixelIndex of getRasterCoveragePixelIndices(fragment, dimensions)) {
			coverage.add(pixelIndex);
		}
	}

	return Array.from(coverage).sort((left, right) => left - right);
};

const pointsAreEqual = (left: GeometryPoint, right: GeometryPoint) =>
	left.x === right.x && left.y === right.y;

const isGeometryPointLike = (value: unknown): value is { x: number; y: number } => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	return 'x' in value && 'y' in value && typeof value.x === 'number' && typeof value.y === 'number';
};

const toPlainGeometryPaths = (paths: unknown): GeometryPaths => {
	if (!Array.isArray(paths)) {
		return [];
	}

	return paths.flatMap((path) => {
		if (!Array.isArray(path)) {
			return [];
		}

		return [
			path.filter(isGeometryPointLike).map((point) => ({ x: Number(point.x), y: Number(point.y) }))
		];
	});
};

const toGeometryPath = (points: DrawingPoint[]): GeometryPath =>
	points.map((point) => ({ x: point[0] * GEOMETRY_SCALE, y: point[1] * GEOMETRY_SCALE }));

const dedupeGeometryPath = (path: GeometryPath) => {
	const deduped: GeometryPath = [];

	for (const point of path) {
		if (!deduped.length || !pointsAreEqual(deduped[deduped.length - 1]!, point)) {
			deduped.push({ x: point.x, y: point.y });
		}
	}

	if (deduped.length > 1 && pointsAreEqual(deduped[0]!, deduped[deduped.length - 1]!)) {
		deduped.pop();
	}

	return deduped;
};

const getSignedArea = (path: GeometryPath) => {
	let area = 0;

	for (let index = 0; index < path.length; index += 1) {
		const current = path[index]!;
		const next = path[(index + 1) % path.length]!;
		area += current.x * next.y - next.x * current.y;
	}

	return area / 2;
};

const normalizeGeometryPolygon = (path: GeometryPath) => {
	const deduped = dedupeGeometryPath(path);
	if (deduped.length < 3) {
		return null;
	}

	return getSignedArea(deduped) >= 0 ? deduped : [...deduped].reverse();
};

const normalizeGeometryPolygons = (paths: GeometryPaths) =>
	paths
		.map((path) => normalizeGeometryPolygon(path))
		.filter((path): path is GeometryPath => path !== null);

const buildDotOccluderPolygons = (stroke: DrawingStroke): GeometryPaths => {
	const center = toGeometryPath(stroke.points)[0];
	if (!center) {
		return [];
	}

	const polygon: GeometryPath = [];
	for (let step = 0; step < DOT_POLYGON_STEPS; step += 1) {
		const angle = (Math.PI * 2 * step) / DOT_POLYGON_STEPS;
		polygon.push({
			x: Math.round(center.x + stroke.size * Math.cos(angle)),
			y: Math.round(center.y + stroke.size * Math.sin(angle))
		});
	}

	const normalizedPolygon = normalizeGeometryPolygon(polygon);
	return normalizedPolygon ? [normalizedPolygon] : [];
};

const buildStrokeProjection = (stroke: DrawingStroke): StrokeProjection => {
	const geometryPath = toGeometryPath(stroke.points);
	const segmentLengths: number[] = [];
	const segmentStartDistances: number[] = [];
	let totalLength = 0;

	for (let index = 0; index < geometryPath.length - 1; index += 1) {
		const start = geometryPath[index]!;
		const end = geometryPath[index + 1]!;
		segmentStartDistances.push(totalLength);
		const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
		segmentLengths.push(segmentLength);
		totalLength += segmentLength;
	}

	return {
		geometryPath,
		segmentLengths,
		segmentStartDistances,
		totalLength
	};
};

const projectPointToStrokeDistance = (projection: StrokeProjection, point: GeometryPoint) => {
	if (projection.geometryPath.length <= 1) {
		return 0;
	}

	let bestDistance = 0;
	let bestSquaredDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < projection.geometryPath.length - 1; index += 1) {
		const start = projection.geometryPath[index]!;
		const end = projection.geometryPath[index + 1]!;
		const deltaX = end.x - start.x;
		const deltaY = end.y - start.y;
		const segmentLength = projection.segmentLengths[index] ?? 0;

		let t = 0;
		if (segmentLength > 0) {
			t =
				((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
				(deltaX * deltaX + deltaY * deltaY);
			t = Math.max(0, Math.min(1, t));
		}

		const nearestX = start.x + deltaX * t;
		const nearestY = start.y + deltaY * t;
		const squaredDistance = (point.x - nearestX) ** 2 + (point.y - nearestY) ** 2;

		if (squaredDistance < bestSquaredDistance) {
			bestSquaredDistance = squaredDistance;
			bestDistance = (projection.segmentStartDistances[index] ?? 0) + segmentLength * t;
		}
	}

	return bestDistance;
};

const geometryPointToDrawingPoint = (point: GeometryPoint, dimensions: StrokeDimensions) =>
	clampDrawingPoint([point.x / GEOMETRY_SCALE, point.y / GEOMETRY_SCALE], dimensions);

const convertGeometryOpenPathsToFragments = (
	stroke: DrawingStroke,
	paths: GeometryPaths,
	dimensions: StrokeDimensions
) => {
	const projection = buildStrokeProjection(stroke);

	return paths
		.map((path) => dedupeGeometryPath(path))
		.filter((path) => path.length > 0)
		.map((path) => {
			let orderedPath = path;
			let startDistance = projectPointToStrokeDistance(projection, orderedPath[0]!);
			const endDistance = projectPointToStrokeDistance(
				projection,
				orderedPath[orderedPath.length - 1]!
			);

			if (startDistance > endDistance) {
				orderedPath = [...orderedPath].reverse();
				startDistance = endDistance;
			}

			const fragment = normalizeDrawingStrokeExactly({
				color: stroke.color,
				points: orderedPath.map((point) => geometryPointToDrawingPoint(point, dimensions)),
				size: stroke.size
			});

			return {
				fragment,
				sortDistance: startDistance
			};
		})
		.filter((result) => result.fragment.points.length > 0)
		.sort((left, right) => left.sortDistance - right.sortDistance)
		.map((result) => result.fragment);
};

const normalizeDocumentForPhase2Benchmark = (document: DrawingDocument): DrawingDocumentV2 => {
	const normalizedDocument = normalizeDrawingDocumentToV2(document);

	return {
		...normalizedDocument,
		base: normalizedDocument.base.map((stroke) => normalizeDrawingStrokeExactly(stroke)),
		tail: normalizedDocument.tail.map((stroke) => normalizeDrawingStrokeExactly(stroke))
	};
};

const compactDocumentWithGeometryEngine = (
	normalizedDocument: DrawingDocumentV2,
	engine: Phase2GeometryEngine,
	options: LosslessCompactionOptions = {}
): DrawingDocumentV2 => {
	const orderedStrokes = [...normalizedDocument.base, ...normalizedDocument.tail];
	const dimensions = {
		height: normalizedDocument.height,
		width: normalizedDocument.width
	};
	const { coverageByStroke, ownerByPixel } = buildRasterOwnershipBuffer(orderedStrokes, dimensions);
	const maxStrokeCoveragePixels = resolveMaxStrokeCoveragePixels(options.maxStrokeCoveragePixels);
	const compactedGroupsInReverse: DrawingStroke[][] = [];
	const laterOccluders: GeometryPaths = [];

	for (let strokeIndex = orderedStrokes.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
		const stroke = orderedStrokes[strokeIndex]!;
		const originalCoverage = coverageByStroke[strokeIndex]!;
		let keptStrokes: DrawingStroke[];

		if (originalCoverage.length === 0) {
			keptStrokes = [];
		} else if (isCoverageFullyHidden(originalCoverage, ownerByPixel, strokeIndex)) {
			keptStrokes = [];
		} else if (
			laterOccluders.length > 0 &&
			maxStrokeCoveragePixels !== null &&
			originalCoverage.length > maxStrokeCoveragePixels
		) {
			keptStrokes = [cloneStroke(stroke)];
		} else if (laterOccluders.length === 0) {
			keptStrokes = [cloneStroke(stroke)];
		} else if (stroke.points.length === 1) {
			keptStrokes = [cloneStroke(stroke)];
		} else {
			const fragments = engine.clipVisibleLineFragments(stroke, laterOccluders, dimensions);
			if (fragments.length === 0) {
				keptStrokes = [cloneStroke(stroke)];
			} else if (
				coverageDifferenceIsHidden(
					originalCoverage,
					collectCandidateCoverage(fragments, dimensions),
					ownerByPixel,
					strokeIndex
				) &&
				getSerializedStrokeBytes(fragments) < getSerializedStrokeBytes([stroke])
			) {
				keptStrokes = fragments;
			} else {
				keptStrokes = [cloneStroke(stroke)];
			}
		}

		compactedGroupsInReverse.push(keptStrokes);
		laterOccluders.push(...engine.buildOccluderPolygons(stroke));
	}

	return {
		...normalizedDocument,
		base: compactedGroupsInReverse.reverse().flatMap((strokes) => strokes),
		tail: []
	};
};

const buildClipper2Engine = (): Phase2GeometryEngine => ({
	buildOccluderPolygons: (stroke) => {
		if (stroke.points.length === 1) {
			return buildDotOccluderPolygons(stroke);
		}

		return normalizeGeometryPolygons(
			toPlainGeometryPaths(
				inflatePaths(
					[toGeometryPath(stroke.points)],
					stroke.size,
					Clipper2JoinType.Round,
					Clipper2EndType.Round,
					2,
					ARC_TOLERANCE
				)
			)
		);
	},
	clipVisibleLineFragments: (stroke, laterOccluders, dimensions) => {
		const clipper = new Clipper64();
		const solutionClosed: GeometryPaths = [];
		const solutionOpen: GeometryPaths = [];

		clipper.addOpenSubject([toGeometryPath(stroke.points)]);
		clipper.addClip(laterOccluders);
		clipper.execute(
			Clipper2ClipType.Difference,
			Clipper2FillRule.NonZero,
			solutionClosed,
			solutionOpen
		);

		return convertGeometryOpenPathsToFragments(stroke, solutionOpen, dimensions);
	},
	isDotFullyHidden: (stroke, laterOccluders) => {
		const clipper = new Clipper64();
		const solutionClosed: GeometryPaths = [];

		clipper.addSubject(buildDotOccluderPolygons(stroke));
		clipper.addClip(laterOccluders);
		clipper.execute(Clipper2ClipType.Difference, Clipper2FillRule.NonZero, solutionClosed);

		return solutionClosed.length === 0;
	}
});

export const compactDocumentWithClipper2 = async (
	document: DrawingDocument,
	options: LosslessCompactionOptions = {}
): Promise<DrawingDocumentV2> => {
	const normalizedDocument = normalizeDocumentForPhase2Benchmark(document);

	return compactDocumentWithGeometryEngine(normalizedDocument, buildClipper2Engine(), options);
};
