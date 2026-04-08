import { getRenderableDrawingStrokes, type DrawingDocument, type DrawingStroke } from './document';

export const renderDrawingStroke = (context: CanvasRenderingContext2D, stroke: DrawingStroke) => {
	context.strokeStyle = stroke.color;
	context.fillStyle = stroke.color;
	context.lineWidth = stroke.size;
	context.lineCap = 'round';
	context.lineJoin = 'round';

	if (stroke.points.length === 1) {
		const [x, y] = stroke.points[0];
		context.beginPath();
		context.arc(x, y, Math.max(1, stroke.size / 2), 0, Math.PI * 2);
		context.fill();
		return;
	}

	context.beginPath();
	context.moveTo(stroke.points[0][0], stroke.points[0][1]);
	for (const [x, y] of stroke.points.slice(1)) {
		context.lineTo(x, y);
	}
	context.stroke();
};

export const renderDrawingDocumentToCanvas = (
	canvas: HTMLCanvasElement,
	document: DrawingDocument
) => {
	const context = canvas.getContext('2d');
	if (!context) return;

	context.fillStyle = document.background;
	context.fillRect(0, 0, canvas.width, canvas.height);

	for (const stroke of getRenderableDrawingStrokes(document)) {
		renderDrawingStroke(context, stroke);
	}
};
