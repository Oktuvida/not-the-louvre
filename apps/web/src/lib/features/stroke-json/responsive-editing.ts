import {
	cloneDrawingDocumentV2,
	countDrawingPoints,
	getRenderableDrawingStrokes,
	type DrawingDocumentV2,
	type DrawingPoint,
	type DrawingStroke
} from './document';

export const RESPONSIVE_DRAWING_THRESHOLDS = {
	maxImmediatePointCount: 1200,
	maxImmediateStrokeCount: 64
} as const;

const cloneDrawingStroke = (stroke: DrawingStroke): DrawingStroke => ({
	color: stroke.color,
	points: stroke.points.map((point) => [point[0], point[1]] as DrawingPoint),
	size: stroke.size
});

export const shouldUseResponsiveDrawing = (document: DrawingDocumentV2) => {
	const strokeCount = getRenderableDrawingStrokes(document).length;
	const pointCount = countDrawingPoints(document);

	return (
		strokeCount >= RESPONSIVE_DRAWING_THRESHOLDS.maxImmediateStrokeCount ||
		pointCount >= RESPONSIVE_DRAWING_THRESHOLDS.maxImmediatePointCount
	);
};

export const createBufferedStroke = (input: {
	color: string;
	point: DrawingPoint;
	size: number;
}): DrawingStroke => ({
	color: input.color,
	points: [input.point],
	size: input.size
});

export const appendBufferedStrokePoint = (stroke: DrawingStroke, point: DrawingPoint) => {
	const lastPoint = stroke.points.at(-1);
	if (lastPoint && point[0] === lastPoint[0] && point[1] === lastPoint[1]) {
		return false;
	}

	stroke.points.push(point);
	return true;
};

export const appendCommittedStroke = (
	document: DrawingDocumentV2,
	stroke: DrawingStroke
): DrawingDocumentV2 => {
	const nextDocument = cloneDrawingDocumentV2(document);
	nextDocument.tail.push(cloneDrawingStroke(stroke));
	return nextDocument;
};
