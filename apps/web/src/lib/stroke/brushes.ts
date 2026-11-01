import { getStroke } from 'perfect-freehand';
import type { DrawingStroke } from '../features/stroke-json/document';

/*
 * How a brush turns a stroke into ink, shared by the studio canvas (Path2D)
 * and the published image (an SVG path resvg fills), so what the visitor
 * draws is what the wall shows.
 *
 * `ink@1` is perfect-freehand's variable-width outline, driven by the pen's
 * real pressure. Its settings are part of the brush's name: changing them is
 * `ink@2`, and every drawing made with `ink@1` keeps rendering as it was.
 * The round brush and the eraser stay the constant-width line they always were.
 */

const INK_1 = {
	last: true,
	simulatePressure: false,
	smoothing: 0.5,
	streamline: 0.35,
	thinning: 0.6
} as const;

/** Whether a stroke is drawn as a filled pressure outline rather than a line. */
export const isInkStroke = (stroke: DrawingStroke) =>
	stroke.brush === 'ink@1' && stroke.pressures !== undefined;

// Two decimals keep the path short and the same on every engine.
const fixed = (value: number) => value.toFixed(2);
const midpoint = (a: number[], b: number[]) => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];

/**
 * The outline as SVG path data: a quadratic curve through the midpoints of
 * perfect-freehand's polygon, closed.
 */
export const inkOutline = (stroke: DrawingStroke): string => {
	const polygon = getStroke(
		stroke.points.map(([x, y], index) => [x, y, stroke.pressures?.[index] ?? 0.5]),
		{ ...INK_1, size: stroke.size }
	);

	if (polygon.length < 4) {
		// Too short to curve through: a dot the size of the pen.
		const [x, y] = stroke.points[0]!;
		const radius = stroke.size / 2;
		return `M${fixed(x - radius)},${fixed(y)} a${fixed(radius)},${fixed(radius)} 0 1,0 ${fixed(radius * 2)},0 a${fixed(radius)},${fixed(radius)} 0 1,0 ${fixed(-radius * 2)},0 Z`;
	}

	const [first, second, third] = [polygon[0]!, polygon[1]!, polygon[2]!];
	const commands = [
		`M${fixed(first[0]!)},${fixed(first[1]!)}`,
		`Q${fixed(second[0]!)},${fixed(second[1]!)} ${midpoint(second, third).map(fixed).join(',')}`,
		'T'
	];
	for (let index = 2; index < polygon.length - 1; index += 1) {
		commands.push(
			midpoint(polygon[index]!, polygon[index + 1]!)
				.map(fixed)
				.join(',')
		);
	}
	commands.push('Z');
	return commands.join(' ');
};
