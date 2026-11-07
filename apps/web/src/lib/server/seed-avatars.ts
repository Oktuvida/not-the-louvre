import {
	AVATAR_DRAWING_DIMENSIONS,
	createEmptyDrawingDocument,
	type DrawingDocumentV1
} from '#lib/features/stroke-json/document.js';

/*
 * The self-portraits the seeded artists drew on their way in: a face in its
 * own ink, tilted a little differently each, over a pair of shoulders. The
 * local gallery (`bun run db:seed`) and the journeys' gallery hang their
 * artworks by artists with faces, so the cards and their wax seals are seen
 * the way visitors see them. Deterministic: the same index draws the same face.
 */

const INKS = ['#2d2420', '#1d3557', '#7c3a2d', '#2a6f62', '#5b3a8c'];
const SHIRTS = ['#e76f51', '#457b9d', '#e9c46a', '#2a9d8f', '#f72585'];

const ellipse = (
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	from: number,
	to: number,
	steps: number
): [number, number][] =>
	Array.from({ length: steps + 1 }, (_, step) => {
		const angle = from + ((to - from) * step) / steps;
		return [Math.round(cx + Math.cos(angle) * rx), Math.round(cy + Math.sin(angle) * ry)];
	});

export const seedAvatarDrawing = (index: number): DrawingDocumentV1 => {
	const ink = INKS[index % INKS.length]!;
	const shirt = SHIRTS[index % SHIRTS.length]!;
	const centre = AVATAR_DRAWING_DIMENSIONS.width / 2 + ((index % 5) - 2) * 6;
	const grin = 10 + (index % 3) * 5;

	return {
		...createEmptyDrawingDocument('avatar'),
		strokes: [
			{
				color: shirt,
				points: ellipse(170, 340, 112, 104, Math.PI * 1.08, Math.PI * 1.92, 20),
				size: 14
			},
			{ color: ink, points: ellipse(centre, 128, 66, 76, 0, Math.PI * 2, 36), size: 8 },
			{
				color: ink,
				points: [
					[centre - 24, 112],
					[centre - 22, 128]
				],
				size: 10
			},
			{
				color: ink,
				points: [
					[centre + 24, 112],
					[centre + 22, 128]
				],
				size: 10
			},
			{
				color: ink,
				points: ellipse(centre, 150, 26, grin, Math.PI * 0.15, Math.PI * 0.85, 12),
				size: 7
			}
		]
	};
};
