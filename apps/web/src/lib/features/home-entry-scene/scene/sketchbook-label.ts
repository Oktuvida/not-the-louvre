import { CanvasTexture } from 'three';
import { SKETCHBOOK_COVER } from '#lib/features/shared-ui/sketchbook/cover.js';

/*
 * The paper label of the sketchbook on the side table, painted the way the
 * desk's CSS label looks (DrawingBookStage, .cover-label): yellowed paper with
 * a few foxing spots, a double rule in brown ink, the name printed and the
 * motto written by hand, in the page's own fonts. Lengths are in the CSS
 * label's units, a hundredth of the cover's width (cqw).
 */

const WIDTH = 768;
const LINE_HEIGHT = 1.5;

/** One cqw, a hundredth of the cover's width, in canvas pixels. */
const CQW = WIDTH / (SKETCHBOOK_COVER.label.width * 100);
/** One CSS pixel of the 741px-wide cover the label was drawn on. */
const CSS_PX = CQW / 7.41;

/** Draws `text` centred on `x`, spaced like CSS letter-spacing (trailing space included). */
const spacedText = (
	context: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	spacing: number
) => {
	const widths = [...text].map((char) => context.measureText(char).width);
	let left = x - widths.reduce((sum, width) => sum + width + spacing, 0) / 2;
	[...text].forEach((char, index) => {
		context.fillText(char, left, y);
		left += widths[index] + spacing;
	});
};

const spot = (
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	alpha: number
) => {
	const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
	gradient.addColorStop(0, `rgb(138 88 36 / ${alpha})`);
	gradient.addColorStop(1, 'rgb(138 88 36 / 0)');
	context.fillStyle = gradient;
	context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

/** Paints the label once its fonts are in; `null` where there is no 2D canvas. */
export const paintSketchbookLabel = async (document: Document) => {
	await Promise.all(
		['600 48px Fredoka', '56px Caveat'].map((font) => document.fonts.load(font).catch(() => []))
	);
	const height = Math.round((WIDTH * SKETCHBOOK_COVER.label.height) / SKETCHBOOK_COVER.label.width);
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) return null;

	// The paper, paler where the years reached it least.
	context.fillStyle = '#ede0c3';
	context.fillRect(0, 0, WIDTH, height);
	context.save();
	context.translate(WIDTH * 0.42, height * 0.45);
	context.scale(1, (0.8 * height) / (0.9 * WIDTH));
	const glow = context.createRadialGradient(0, 0, 0, 0, 0, 0.9 * WIDTH);
	glow.addColorStop(0, 'rgb(255 251 238 / 0.62)');
	glow.addColorStop(0.72, 'rgb(255 251 238 / 0)');
	context.fillStyle = glow;
	context.fillRect(-WIDTH, -WIDTH, WIDTH * 2, WIDTH * 2);
	context.restore();

	// Yellowed toward its edges.
	const edge = 14.4 * CSS_PX;
	for (const [x0, y0, x1, y1] of [
		[0, 0, edge, 0],
		[WIDTH, 0, WIDTH - edge, 0],
		[0, 0, 0, edge],
		[0, height, 0, height - edge]
	]) {
		const gradient = context.createLinearGradient(x0, y0, x1, y1);
		gradient.addColorStop(0, 'rgb(160 118 58 / 0.2)');
		gradient.addColorStop(1, 'rgb(160 118 58 / 0)');
		context.fillStyle = gradient;
		context.fillRect(0, 0, WIDTH, height);
	}
	context.strokeStyle = 'rgb(140 100 56 / 0.2)';
	context.lineWidth = 2 * CSS_PX;
	context.strokeRect(0, 0, WIDTH, height);

	spot(context, WIDTH * 0.87, height * 0.26, 3.2 * CSS_PX, 0.3);
	spot(context, WIDTH * 0.1, height * 0.7, 4.8 * CSS_PX, 0.2);
	spot(context, WIDTH * 0.64, height * 0.86, 2.2 * CSS_PX, 0.24);

	// The double rule printed round it.
	const rule = 0.8 * CQW;
	context.lineWidth = CSS_PX;
	context.strokeStyle = 'rgb(112 60 38 / 0.55)';
	context.strokeRect(
		rule + CSS_PX / 2,
		rule + CSS_PX / 2,
		WIDTH - 2 * rule - CSS_PX,
		height - 2 * rule - CSS_PX
	);
	const outer = rule - 2.5 * CSS_PX;
	context.strokeStyle = 'rgb(112 60 38 / 0.32)';
	context.strokeRect(outer, outer, WIDTH - 2 * outer, height - 2 * outer);

	// The name, printed; a short rule; the motto, written in pencil.
	context.textBaseline = 'middle';
	context.fillStyle = 'rgb(52 34 24 / 0.92)';
	context.font = `600 ${2.45 * CQW}px Fredoka, 'Trebuchet MS', sans-serif`;
	const titleLine = 2.45 * LINE_HEIGHT;
	spacedText(context, 'NOT THE LOUVRE', WIDTH / 2, (2.5 + titleLine / 2) * CQW, 0.24 * 2.45 * CQW);
	const ruleTop = (2.5 + titleLine + 0.8) * CQW;
	context.fillStyle = 'rgb(112 60 38 / 0.35)';
	context.fillRect(WIDTH / 2 - 4.5 * CQW, ruleTop, 9 * CQW, CSS_PX);
	context.fillStyle = 'rgb(58 54 66 / 0.62)';
	context.font = `${2.9 * CQW}px Caveat, 'Segoe Script', cursive`;
	context.textAlign = 'center';
	context.fillText(
		'sketch & create',
		WIDTH / 2,
		ruleTop + CSS_PX + (0.5 + (2.9 * LINE_HEIGHT) / 2) * CQW
	);

	return new CanvasTexture(canvas);
};
