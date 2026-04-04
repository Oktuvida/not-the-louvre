import simplifyJs from 'simplify-js';
import {
	normalizeDrawingDocumentToV2,
	type DrawingDocument,
	type DrawingDocumentV2,
	type DrawingPoint,
	type DrawingStroke
} from './document';

type SimplifyJsPoint = {
	x: number;
	y: number;
};

export type SimplifyJsPhase1Options = {
	simplifyJsHighQuality: boolean;
	simplifyJsTolerance: number;
};

export const DEFAULT_SIMPLIFY_JS_PHASE1_OPTIONS: SimplifyJsPhase1Options = {
	simplifyJsHighQuality: false,
	simplifyJsTolerance: 1
};

const resolveSimplifyJsPhase1Options = (
	options: Partial<SimplifyJsPhase1Options> = {}
): SimplifyJsPhase1Options => ({
	...DEFAULT_SIMPLIFY_JS_PHASE1_OPTIONS,
	...options,
	simplifyJsTolerance: Math.max(
		0,
		options.simplifyJsTolerance ?? DEFAULT_SIMPLIFY_JS_PHASE1_OPTIONS.simplifyJsTolerance
	)
});

const cloneStroke = (stroke: DrawingStroke): DrawingStroke => ({
	color: stroke.color,
	points: stroke.points.map((point) => [point[0], point[1]] as DrawingPoint),
	size: stroke.size
});

const toSimplifyJsPoints = (points: DrawingPoint[]): SimplifyJsPoint[] =>
	points.map((point) => ({ x: point[0], y: point[1] }));

const fromSimplifyJsPoints = (points: SimplifyJsPoint[]): DrawingPoint[] =>
	points.map((point) => [point.x, point.y] as DrawingPoint);

const simplifyStrokeWithSimplifyJs = (
	stroke: DrawingStroke,
	options: SimplifyJsPhase1Options
): DrawingStroke => {
	if (stroke.points.length <= 2) {
		return cloneStroke(stroke);
	}

	const simplifiedPoints = simplifyJs(
		toSimplifyJsPoints(stroke.points),
		options.simplifyJsTolerance,
		options.simplifyJsHighQuality
	);

	return {
		...stroke,
		points: fromSimplifyJsPoints(simplifiedPoints)
	};
};

export const simplifyDocumentWithSimplifyJs = (
	document: DrawingDocument,
	options: Partial<SimplifyJsPhase1Options> = {}
): DrawingDocumentV2 => {
	const normalizedDocument = normalizeDrawingDocumentToV2(document);
	const resolvedOptions = resolveSimplifyJsPhase1Options(options);

	return {
		...normalizedDocument,
		base: normalizedDocument.base.map((stroke) =>
			simplifyStrokeWithSimplifyJs(stroke, resolvedOptions)
		),
		tail: normalizedDocument.tail.map((stroke) =>
			simplifyStrokeWithSimplifyJs(stroke, resolvedOptions)
		)
	};
};
