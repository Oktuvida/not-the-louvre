/*
 * The studio, drawn in pencil from its own 3D model.
 *
 * While three.js and the model are on their way, the home page shows this
 * drawing where the room will stand (scripts/sketch-studio-room.ts makes it
 * from the model). These are its pieces, free of any file or camera: a mesh
 * comes in already seen by the camera, in composition pixels.
 *
 * A line is drawn where a surface folds, at a boundary, and where a surface
 * turns away from the camera; a software depth buffer hides the parts that
 * something nearer stands in front of.
 */

export type Point = [x: number, y: number];
export type Segment = [Point, Point];

/**
 * A mesh as an orthographic camera sees it: x and y in composition pixels,
 * y down, and depth growing away from the camera in the same pixels.
 */
export type ProjectedMesh = {
	depth: Float64Array;
	triangles: ArrayLike<number>;
	/** One id per vertex, shared by vertices at the same spot: a model splits a corner per face. */
	weld: ArrayLike<number>;
	x: Float64Array;
	y: Float64Array;
};

/** The part of the composition the sketch covers, in composition pixels. */
export type SketchFrame = { height: number; left: number; top: number; width: number };

export type DepthBuffer = {
	columns: number;
	frame: SketchFrame;
	rows: number;
	/** Raster pixels per composition pixel. */
	scale: number;
	values: Float32Array;
};

/** The nearest surface under every raster pixel of the frame. */
export const depthBuffer = (
	meshes: ProjectedMesh[],
	frame: SketchFrame,
	scale: number
): DepthBuffer => {
	const columns = Math.ceil(frame.width * scale);
	const rows = Math.ceil(frame.height * scale);
	const values = new Float32Array(columns * rows).fill(Infinity);
	const toColumn = (x: number) => (x - frame.left) * scale;
	const toRow = (y: number) => (y - frame.top) * scale;

	for (const { depth, triangles, x, y } of meshes) {
		for (let t = 0; t + 2 < triangles.length; t += 3) {
			const a = triangles[t]!;
			const b = triangles[t + 1]!;
			const c = triangles[t + 2]!;
			const [ax, ay, bx, by, cx, cy] = [
				toColumn(x[a]!),
				toRow(y[a]!),
				toColumn(x[b]!),
				toRow(y[b]!),
				toColumn(x[c]!),
				toRow(y[c]!)
			];
			const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
			if (Math.abs(area) < 1e-9) continue;

			const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
			const right = Math.min(columns - 1, Math.ceil(Math.max(ax, bx, cx)));
			const top = Math.max(0, Math.floor(Math.min(ay, by, cy)));
			const bottom = Math.min(rows - 1, Math.ceil(Math.max(ay, by, cy)));
			for (let row = top; row <= bottom; row++) {
				for (let column = left; column <= right; column++) {
					const px = column + 0.5;
					const py = row + 0.5;
					const wa = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
					const wb = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
					const wc = 1 - wa - wb;
					if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;

					const z = wa * depth[a]! + wb * depth[b]! + wc * depth[c]!;
					const index = row * columns + column;
					if (z < values[index]!) values[index] = z;
				}
			}
		}
	}

	return { columns, frame, rows, scale, values };
};

/**
 * The edges a pencil would draw: where the surface folds by more than
 * `creaseDegrees`, where it ends, and where it turns away from the camera.
 * The seam between two triangles of one flat face is left out.
 */
export const featureEdges = (mesh: ProjectedMesh, creaseDegrees: number): [number, number][] => {
	const { depth, triangles, weld, x, y } = mesh;
	const crease = Math.cos((creaseDegrees * Math.PI) / 180);
	const faces = new Map<
		string,
		{ from: number; normals: [number, number, number][]; to: number }
	>();

	for (let t = 0; t + 2 < triangles.length; t += 3) {
		const corners = [triangles[t]!, triangles[t + 1]!, triangles[t + 2]!] as const;
		const [a, b, c] = corners;
		const [ux, uy, uz] = [x[b]! - x[a]!, y[b]! - y[a]!, depth[b]! - depth[a]!];
		const [vx, vy, vz] = [x[c]! - x[a]!, y[c]! - y[a]!, depth[c]! - depth[a]!];
		const normal: [number, number, number] = [
			uy * vz - uz * vy,
			uz * vx - ux * vz,
			ux * vy - uy * vx
		];
		const length = Math.hypot(...normal);
		if (length < 1e-12) continue;
		normal[0] /= length;
		normal[1] /= length;
		normal[2] /= length;

		for (let side = 0; side < 3; side++) {
			const from = corners[side]!;
			const to = corners[(side + 1) % 3]!;
			const [p, q] = [weld[from]!, weld[to]!];
			if (p === q) continue;
			const key = p < q ? `${p}:${q}` : `${q}:${p}`;
			const edge = faces.get(key) ?? { from, normals: [], to };
			edge.normals.push(normal);
			faces.set(key, edge);
		}
	}

	const edges: [number, number][] = [];
	for (const { from, normals, to } of faces.values()) {
		const [first, second] = normals;
		const drawn =
			normals.length === 1 ||
			(first !== undefined &&
				second !== undefined &&
				(first[0] * second[0] + first[1] * second[1] + first[2] * second[2] < crease ||
					Math.sign(first[2]) !== Math.sign(second[2])));
		if (drawn) edges.push([from, to]);
	}
	return edges;
};

/**
 * The parts of these edges nothing nearer hides, walked a composition pixel
 * at a time. `tolerance` is how far behind the nearest surface, in depth
 * pixels, a point may lie and still be seen: an edge lies on its own faces.
 */
export const visibleRuns = (
	mesh: ProjectedMesh,
	edges: [number, number][],
	buffer: DepthBuffer,
	tolerance: number
): Segment[] => {
	const { depth, x, y } = mesh;
	const { columns, frame, rows, scale, values } = buffer;
	const seen = (px: number, py: number, pz: number) => {
		const column = Math.floor((px - frame.left) * scale);
		const row = Math.floor((py - frame.top) * scale);
		if (column < 0 || row < 0 || column >= columns || row >= rows) return false;
		let nearest = Infinity;
		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				const c = column + dx;
				const r = row + dy;
				if (c < 0 || r < 0 || c >= columns || r >= rows) continue;
				nearest = Math.min(nearest, values[r * columns + c]!);
			}
		}
		return pz <= nearest + tolerance;
	};

	const runs: Segment[] = [];
	for (const [from, to] of edges) {
		const length = Math.hypot(x[to]! - x[from]!, y[to]! - y[from]!);
		const steps = Math.max(1, Math.ceil(length));
		let run: Segment | null = null;
		for (let step = 0; step <= steps; step++) {
			const t = step / steps;
			const point: Point = [x[from]! + (x[to]! - x[from]!) * t, y[from]! + (y[to]! - y[from]!) * t];
			if (seen(point[0], point[1], depth[from]! + (depth[to]! - depth[from]!) * t)) {
				if (run) run[1] = point;
				else run = [point, point];
			} else if (run) {
				runs.push(run);
				run = null;
			}
		}
		if (run) runs.push(run);
	}
	return runs.filter(([[ax, ay], [bx, by]]) => Math.hypot(bx - ax, by - ay) > 0.5);
};

/** Joins segments that meet end to end into strokes, and drops strokes shorter than `minLength`. */
export const chainStrokes = (segments: Segment[], minLength: number): Point[][] => {
	const cell = ([px, py]: Point) => `${Math.round(px)},${Math.round(py)}`;
	const ends = new Map<string, [index: number, end: 0 | 1][]>();
	segments.forEach((segment, index) => {
		for (const end of [0, 1] as const) {
			const key = cell(segment[end]);
			ends.set(key, [...(ends.get(key) ?? []), [index, end]]);
		}
	});

	const used = new Uint8Array(segments.length);
	const following = (point: Point) =>
		(ends.get(cell(point)) ?? []).find(([index]) => !used[index]) ?? null;
	const strokes: Point[][] = [];
	segments.forEach((segment, index) => {
		if (used[index]) return;
		used[index] = 1;
		const line: Point[] = [segment[0], segment[1]];
		for (let next = following(line.at(-1)!); next; next = following(line.at(-1)!)) {
			used[next[0]] = 1;
			line.push(segments[next[0]]![next[1] === 0 ? 1 : 0]);
		}
		for (let next = following(line[0]!); next; next = following(line[0]!)) {
			used[next[0]] = 1;
			line.unshift(segments[next[0]]![next[1] === 0 ? 1 : 0]);
		}
		const length = line
			.slice(1)
			.reduce((total, [px, py], k) => total + Math.hypot(px - line[k]![0], py - line[k]![1]), 0);
		if (length >= minLength) strokes.push(line);
	});
	return strokes;
};

/** How many beats the drawing is sketched in, longest strokes first. */
const BEATS = 10;

/**
 * The strokes as an SVG drawn by hand: each wobbles a little across its
 * length and runs past its ends, and the drawing sketches itself in beats,
 * the long lines of the room first. The same strokes always make the same file.
 */
export const sketchSvg = (strokes: Point[][], frame: SketchFrame, seed = 7): string => {
	let state = seed;
	const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
	const wobble = () => (random() - 0.5) * 1.1;
	const past = (point: Point, from: Point, distance: number): Point => {
		const length = Math.hypot(point[0] - from[0], point[1] - from[1]) || 1;
		return [
			point[0] + ((point[0] - from[0]) / length) * distance,
			point[1] + ((point[1] - from[1]) / length) * distance
		];
	};
	const strokeLength = (line: Point[]) =>
		line
			.slice(1)
			.reduce((total, [px, py], k) => total + Math.hypot(px - line[k]![0], py - line[k]![1]), 0);

	const paths = strokes
		.map((line) => ({ length: strokeLength(line), line }))
		.sort((a, b) => b.length - a.length)
		.map(({ line }) => {
			const points = line.filter(
				(point, k) =>
					k === 0 ||
					k === line.length - 1 ||
					Math.hypot(point[0] - line[k - 1]![0], point[1] - line[k - 1]![1]) > 2.5
			);
			points[0] = past(points[0]!, points[1]!, 1 + random() * 2.5);
			points[points.length - 1] = past(points.at(-1)!, points.at(-2)!, 1 + random() * 2.5);
			const d = points
				.map(
					([px, py], k) =>
						`${k ? 'L' : 'M'}${(px + wobble()).toFixed(1)} ${(py + wobble()).toFixed(1)}`
				)
				.join('');
			const shade = random() < 0.3 ? ' class="soft"' : '';
			return `<path pathLength="1" d="${d}"${shade}/>`;
		});

	const perBeat = Math.max(1, Math.ceil(paths.length / BEATS));
	const beats = Array.from({ length: Math.ceil(paths.length / perBeat) }, (_, beat) =>
		paths.slice(beat * perBeat, (beat + 1) * perBeat).join('')
	);
	const delays = beats
		.map((_, beat) =>
			beat ? `g:nth-of-type(${beat + 1}) path{animation-delay:${(beat * 0.12).toFixed(2)}s}` : ''
		)
		.join('');
	const style =
		'path{fill:none;stroke:#3f3a35;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;' +
		'stroke-dasharray:1 2;stroke-dashoffset:1.05;animation:draw .7s ease-out forwards}' +
		'.soft{stroke-opacity:.72}' +
		delays +
		'@keyframes draw{to{stroke-dashoffset:0}}' +
		'@media (prefers-reduced-motion:reduce){path{animation:none;stroke-dashoffset:0}}';
	const viewBox = `${frame.left} ${frame.top} ${frame.width} ${frame.height}`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><style>${style}</style>${beats
		.map((beat) => `<g>${beat}</g>`)
		.join('')}</svg>`;
};
