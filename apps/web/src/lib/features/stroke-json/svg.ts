import { inkOutline, isInkStroke } from '../../stroke/brushes';
import { getRenderableDrawingStrokes, type DrawingDocument, type DrawingStroke } from './document';

const polylinePoints = (stroke: DrawingStroke) =>
	stroke.points.map(([x, y]) => `${x},${y}`).join(' ');

const renderStrokeSvg = (stroke: DrawingStroke) => {
	if (isInkStroke(stroke)) {
		return `<path d="${inkOutline(stroke)}" fill="${stroke.color}" />`;
	}

	if (stroke.points.length === 1) {
		const [x, y] = stroke.points[0];
		return `<circle cx="${x}" cy="${y}" r="${Math.max(1, stroke.size / 2)}" fill="${stroke.color}" />`;
	}

	return `<polyline points="${polylinePoints(stroke)}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.size}" stroke-linecap="round" stroke-linejoin="round" />`;
};

/**
 * The drawing as SVG. Without its paper (`paper: false`) the strokes stand on
 * a transparent ground, to be laid over the image a fork was drawn on.
 */
export const drawingDocumentToSvg = (
	document: DrawingDocument,
	options: { paper?: boolean } = {}
) =>
	[
		`<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">`,
		...(options.paper === false
			? []
			: [`<rect width="100%" height="100%" fill="${document.background}" />`]),
		...getRenderableDrawingStrokes(document).map(renderStrokeSvg),
		'</svg>'
	].join('');
