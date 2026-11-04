import { describe, expect, it } from 'vitest';
import {
	chainStrokes,
	depthBuffer,
	featureEdges,
	sketchSvg,
	visibleRuns,
	type ProjectedMesh,
	type SketchFrame
} from './room-sketch';

/*
 * The studio's pencil sketch is drawn from the 3D model: the folds of every
 * surface, as the home's resting camera sees them, minus what something nearer
 * hides. These scenarios use shapes small enough to count by hand.
 */

const frame: SketchFrame = { height: 200, left: 0, top: 0, width: 200 };

/**
 * A mesh from points already seen by an orthographic camera looking down -z:
 * x and y in frame pixels (y down), depth growing away from the camera.
 */
const mesh = (points: [number, number, number][], triangles: number[]): ProjectedMesh => ({
	depth: Float64Array.from(points, ([, , depth]) => depth),
	triangles: Uint32Array.from(triangles),
	weld: Int32Array.from(points, (_, index) => index),
	x: Float64Array.from(points, ([x]) => x),
	y: Float64Array.from(points, ([, y]) => y)
});

/** A unit cube, turned and tilted so three of its faces face the camera. */
const cubeFromACorner = (): ProjectedMesh => {
	const turn = Math.PI / 4;
	const tilt = Math.PI / 6;
	const corners: [number, number, number][] = [];
	for (const x of [-1, 1])
		for (const y of [-1, 1])
			for (const z of [-1, 1]) {
				const rx = x * Math.cos(turn) + z * Math.sin(turn);
				const rz = -x * Math.sin(turn) + z * Math.cos(turn);
				const ty = y * Math.cos(tilt) - rz * Math.sin(tilt);
				const tz = y * Math.sin(tilt) + rz * Math.cos(tilt);
				corners.push([100 + rx * 40, 100 - ty * 40, 100 - tz * 40]);
			}
	// Each face as two triangles; corner index = x*4 + y*2 + z over {0, 1}.
	const quads = [
		[0, 1, 3, 2],
		[4, 6, 7, 5],
		[0, 4, 5, 1],
		[2, 3, 7, 6],
		[0, 2, 6, 4],
		[1, 5, 7, 3]
	];
	return mesh(
		corners,
		quads.flatMap(([a, b, c, d]) => [a!, b!, c!, a!, c!, d!])
	);
};

describe('the pencil sketch of the room', () => {
	it('draws the edges of a box that face the camera, and none of those behind it', () => {
		const cube = cubeFromACorner();
		const edges = featureEdges(cube, 30);
		const depth = depthBuffer([cube], frame, 2);

		const drawnLength = (edge: [number, number]) =>
			visibleRuns(cube, [edge], depth, 2).reduce(
				(length, [[ax, ay], [bx, by]]) => length + Math.hypot(bx - ax, by - ay),
				0
			);
		const drawn = edges.filter((edge) => drawnLength(edge) >= 4);

		// Its twelve edges are all folds; the three that meet at the far corner
		// are hidden behind the box itself.
		expect(edges).toHaveLength(12);
		expect(drawn).toHaveLength(9);
	});

	it('leaves out the seam where a flat surface is only split in two', () => {
		const square = mesh(
			[
				[50, 50, 10],
				[150, 50, 10],
				[150, 150, 10],
				[50, 150, 10]
			],
			[0, 1, 2, 0, 2, 3]
		);

		// The four sides are its outline; the diagonal between its two triangles is not drawn.
		expect(featureEdges(square, 30)).toHaveLength(4);
	});

	it('hides the part of a line that something nearer stands in front of', () => {
		const far = mesh(
			[
				[20, 100, 50],
				[180, 100, 50],
				[180, 180, 50],
				[20, 180, 50]
			],
			[0, 1, 2, 0, 2, 3]
		);
		const near = mesh(
			[
				[80, 60, 10],
				[120, 60, 10],
				[120, 140, 10],
				[80, 140, 10]
			],
			[0, 1, 2, 0, 2, 3]
		);
		const depth = depthBuffer([far, near], frame, 2);
		const topEdge: [number, number] = [0, 1];

		const runs = visibleRuns(far, [topEdge], depth, 2);

		// The far square's top edge shows on either side of the near one, and not across it.
		expect(runs).toHaveLength(2);
		const [left, right] = [...runs].sort((a, b) => a[0][0] - b[0][0]);
		expect(Math.max(left![0][0], left![1][0])).toBeLessThanOrEqual(80);
		expect(Math.min(right![0][0], right![1][0])).toBeGreaterThanOrEqual(120);
	});

	it('joins lines that meet end to end into one stroke, and drops crumbs', () => {
		const strokes = chainStrokes(
			[
				[
					[0, 0],
					[10, 0]
				],
				[
					[10, 0],
					[10, 10]
				],
				[
					[50, 50],
					[51, 50]
				]
			],
			4
		);

		expect(strokes).toHaveLength(1);
		expect(strokes[0]).toHaveLength(3);
	});

	it('draws the same sketch every time it is made', () => {
		const strokes = [
			[
				[0, 0],
				[40, 0],
				[40, 40]
			] satisfies [number, number][]
		];

		expect(sketchSvg(strokes, frame)).toBe(sketchSvg(strokes, frame));
	});
});
