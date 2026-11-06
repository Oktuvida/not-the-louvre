import { SKETCHBOOK_COVER } from './cover';

/*
 * The sketchbook's bookcloth and the wear of this one book, drawn pixel by
 * pixel. `scripts/generate-sketchbook-cloth.ts` writes both to
 * `src/lib/assets/sketchbook/` as WebP, and the images are committed: they
 * are design assets to review by eye, like the og card.
 *
 *  - The cloth is a plain-weave linen tile that repeats seamlessly: threads of
 *    uneven thickness and tone, with slubs along their length and fibres
 *    running down them, crossing over and under, lit from the top left.
 *  - The wear is this book's own history over the cloth: a dark cloth spine
 *    and corners, rubbed pale where hands and the desk wear them, frayed to
 *    the board at the corner tips and the spine's ends, grime and graphite
 *    where thumbs open it, a mottle of age. It is laid over the whole cover.
 *
 * Colours are sRGB values in 0..1, the space the browser composites in, so the
 * CSS cover and the 3D shader mix the two images with the same arithmetic.
 */

export type Raster = { data: Uint8ClampedArray; height: number; width: number };
type Rgb = [number, number, number];

const random = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t
];
const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Value noise on a lattice of `cellsX` × `cellsY` cells that wraps at its edges. */
const latticeNoise = (rand: () => number, cellsX: number, cellsY: number) => {
	const values = Float64Array.from({ length: cellsX * cellsY }, rand);
	const at = (i: number, j: number) =>
		values[(((j % cellsY) + cellsY) % cellsY) * cellsX + (((i % cellsX) + cellsX) % cellsX)];
	/** Sampled in cell units. */
	return (x: number, y: number) => {
		const i = Math.floor(x);
		const j = Math.floor(y);
		const fx = x - i;
		const fy = y - j;
		const sx = fx * fx * (3 - 2 * fx);
		const sy = fy * fy * (3 - 2 * fy);
		const a = at(i, j);
		const b = at(i + 1, j);
		const c = at(i, j + 1);
		const d = at(i + 1, j + 1);
		return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
	};
};

type Noise = ReturnType<typeof latticeNoise>;

const fbm = (noise: Noise, x: number, y: number, octaves: number) => {
	let value = 0;
	let amplitude = 0.5;
	let frequency = 1;
	let total = 0;
	for (let octave = 0; octave < octaves; octave++) {
		value += amplitude * noise(x * frequency + octave * 17.31, y * frequency + octave * 9.13);
		total += amplitude;
		amplitude *= 0.5;
		frequency *= 2;
	}
	return value / total;
};

/* ------------------------------------------------------------------ cloth */

type Thread = {
	centre: number;
	half: number;
	/** Thickness along the thread: linen's slubs. */
	slub: Noise;
	slubCells: number;
	/** Tone along the thread, the yarn taking the dye unevenly. */
	streak: Noise;
	streakCells: number;
	start: number;
	tone: number;
	wobble: Noise;
	wobbleCells: number;
};

/** Lays `count` threads across `size` pixels at uneven spacing, as linen is spun. */
const layThreads = (rand: () => number, count: number, size: number): Thread[] => {
	const gaps = Array.from(
		{ length: count },
		() => 1 + 0.3 * (rand() - 0.5) + (rand() < 0.07 ? 0.4 : 0)
	);
	const scale = size / gaps.reduce((sum, gap) => sum + gap, 0);
	let start = 0;
	return gaps.map((gap) => {
		const width = gap * scale;
		const slubCells = 7 + Math.floor(rand() * 8);
		const streakCells = 14 + Math.floor(rand() * 12);
		const wobbleCells = 4 + Math.floor(rand() * 4);
		const thread: Thread = {
			centre: start + width / 2,
			half: width * (0.47 + 0.04 * rand()),
			slub: latticeNoise(rand, slubCells, 1),
			slubCells,
			start,
			streak: latticeNoise(rand, streakCells, 1),
			streakCells,
			tone: 1 + 0.06 * (rand() - 0.5),
			wobble: latticeNoise(rand, wobbleCells, 1),
			wobbleCells
		};
		start += width;
		return thread;
	});
};

const wrap = (value: number, size: number) => ((value % size) + size) % size;

/** The thread whose share of the cloth holds `position`. */
const threadIndexAt = (threads: Thread[], position: number) => {
	let low = 0;
	let high = threads.length - 1;
	while (low < high) {
		const middle = (low + high + 1) >> 1;
		if (threads[middle].start <= position) low = middle;
		else high = middle - 1;
	}
	return low;
};

type LoomOptions = { seed?: number; size?: number; warp?: number; weft?: number };

const WARP_COLOUR: Rgb = [0.84, 0.776, 0.665];
const WEFT_COLOUR: Rgb = [0.814, 0.746, 0.63];
const GAP_COLOUR: Rgb = [0.5, 0.435, 0.35];

/**
 * The cloth as a function of position, repeating every `size` pixels both
 * ways. Warp threads run down the tile and weft threads across it; at every
 * crossing one of them rides over the other, alternating like a plain weave.
 */
export const loomBookcloth = ({
	seed = 1907,
	size = 512,
	warp = 92,
	weft = 100
}: LoomOptions = {}) => {
	const rand = random(seed);
	// A plain weave only meets itself across the edge with an even count.
	const warpThreads = layThreads(rand, warp + (warp % 2), size);
	const weftThreads = layThreads(rand, weft + (weft % 2), size);
	const fibreCells = Math.round(size / 1.6);
	const fibreAlong = Math.max(1, Math.round(size / 22));
	const warpFibre = latticeNoise(rand, fibreCells, fibreAlong);
	const weftFibre = latticeNoise(rand, fibreAlong, fibreCells);

	/** How far a thread rides up between the crossings either side of `along`. */
	const crimp = (crossings: Thread[], along: number, index: number, overAtEven: boolean) => {
		// The crossing at or before `along`, and the one after it, unwrapped
		// around the tile's edge so that `from <= along < to`.
		let at = threadIndexAt(crossings, along);
		let from = crossings[at].centre;
		if (along < from) {
			at = (at - 1 + crossings.length) % crossings.length;
			from = crossings[at].centre - (at === crossings.length - 1 ? size : 0);
		}
		const next = (at + 1) % crossings.length;
		let to = crossings[next].centre;
		if (to <= from) to += size;
		const t = (along - from) / (to - from);
		const over = ((index + at) % 2 === 0) === overAtEven;
		const lift = over ? (1 + Math.cos(Math.PI * t)) / 2 : (1 - Math.cos(Math.PI * t)) / 2;
		return 0.4 + 0.6 * lift;
	};

	/** The tallest thread at a point: its height, which set it belongs to, its tone there. */
	const topThread = (x: number, y: number) => {
		let best = 0;
		let bestIndex = -1;
		let bestIsWarp = true;
		let bestTone = 1;

		const consider = (
			threads: Thread[],
			across: number,
			along: number,
			crossings: Thread[],
			isWarp: boolean
		) => {
			const home = threadIndexAt(threads, across);
			const t = along / size;
			for (let offset = -1; offset <= 1; offset++) {
				const index = (home + offset + threads.length) % threads.length;
				const thread = threads[index];
				const wobble = (thread.wobble(t * thread.wobbleCells, 0) - 0.5) * 1.2;
				const slubNoise = thread.slub(t * thread.slubCells, 0);
				const slub = 0.88 + 0.24 * slubNoise + 0.3 * Math.max(0, slubNoise - 0.8) * 5;
				const half = thread.half * slub;
				let distance = across - (thread.centre + wobble);
				distance -= Math.round(distance / size) * size;
				if (Math.abs(distance) >= half) continue;
				const profile = Math.sqrt(1 - (distance / half) ** 2);
				const height = profile * crimp(crossings, along, index, isWarp) * (0.94 + 0.1 * slub);
				if (height > best) {
					best = height;
					bestIndex = index;
					bestIsWarp = isWarp;
					// Slubs, thicker, catch more light; the dye sits unevenly along the yarn.
					bestTone =
						thread.tone *
						(1 + 0.07 * (slub - 1)) *
						(1 + 0.08 * (thread.streak(t * thread.streakCells, 0) - 0.5));
				}
			}
		};

		consider(warpThreads, x, y, weftThreads, true);
		consider(weftThreads, y, x, warpThreads, false);
		return { height: best, index: bestIndex, isWarp: bestIsWarp, tone: bestTone };
	};

	const heightAt = (x: number, y: number) => topThread(wrap(x, size), wrap(y, size)).height;

	/** The cloth's colour at any point, in sRGB 0..1. */
	const sample = (rawX: number, rawY: number): Rgb => {
		const x = wrap(rawX, size);
		const y = wrap(rawY, size);
		const top = topThread(x, y);
		if (top.index < 0) return [...GAP_COLOUR];

		// Lit from the top left, as the CSS cover's light falls.
		const step = 0.5;
		const dx = (heightAt(x + step, y) - heightAt(x - step, y)) / (2 * step);
		const dy = (heightAt(x, y + step) - heightAt(x, y - step)) / (2 * step);
		const relief = 1.15;
		const nx = -dx * relief;
		const ny = -dy * relief;
		const length = Math.hypot(nx, ny, 1);
		const light = [-0.42, -0.5, 0.76] as const;
		const diffuse = (nx * light[0] + ny * light[1] + light[2]) / length / light[2];
		const lit = 1 + (diffuse - 1) * 0.4;
		const occlusion = 0.74 + 0.26 * smoothstep(0, 0.85, top.height);

		const fibre = top.isWarp
			? warpFibre((x / size) * fibreCells, (y / size) * fibreAlong)
			: weftFibre((x / size) * fibreAlong, (y / size) * fibreCells);
		const base = top.isWarp ? WARP_COLOUR : WEFT_COLOUR;
		const shade = top.tone * (0.95 + 0.1 * fibre) * lit * occlusion;
		const colour = base.map((channel) => channel * shade) as Rgb;
		return mix(GAP_COLOUR, colour, smoothstep(0, 0.2, top.height));
	};

	return { sample, size };
};

const toRaster = (width: number, height: number, pixel: (x: number, y: number) => number[]) => {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const value = pixel(x, y);
			const index = (y * width + x) * 4;
			data[index] = Math.round(clamp01(value[0]) * 255);
			data[index + 1] = Math.round(clamp01(value[1]) * 255);
			data[index + 2] = Math.round(clamp01(value[2]) * 255);
			data[index + 3] = Math.round(clamp01(value[3] ?? 1) * 255);
		}
	}
	return { data, height, width } satisfies Raster;
};

/** One tile of the bookcloth, supersampled four times per pixel. */
export const weaveBookcloth = (options: LoomOptions = {}): Raster => {
	const loom = loomBookcloth(options);
	const offsets = [0.25, 0.75];
	return toRaster(loom.size, loom.size, (x, y) => {
		const sum = [0, 0, 0];
		for (const oy of offsets) {
			for (const ox of offsets) {
				const colour = loom.sample(x + ox, y + oy);
				sum[0] += colour[0];
				sum[1] += colour[1];
				sum[2] += colour[2];
			}
		}
		return [sum[0] / 4, sum[1] / 4, sum[2] / 4, 1];
	});
};

/* ------------------------------------------------------------------- wear */

/** The dark cloth lies at this opacity over the linen tile, so its weave still shows. */
const DARK_OPACITY = 0.84;
const DARK_CLOTH: Rgb = [0.08, 0.05, 0.03];
const DARK_CLOTH_RUBBED: Rgb = [0.28, 0.225, 0.175];
const DARK_CLOTH_FRAYED: Rgb = [0.46, 0.4, 0.33];
const BOARD: Rgb = [0.64, 0.6, 0.52];
const LINEN_RUBBED: Rgb = [0.96, 0.935, 0.87];
const GRIME: Rgb = [0.33, 0.26, 0.18];
const GRAPHITE: Rgb = [0.26, 0.26, 0.29];
const AGE_LIGHT: Rgb = [0.98, 0.955, 0.89];
const AGE_DARK: Rgb = [0.4, 0.31, 0.21];
const SHADOW: Rgb = [0.04, 0.03, 0.02];
/** Toward the light, in image coordinates (y down): the top left. */
const LIGHT_XY = [-0.64, -0.77] as const;

type WearOptions = { seed?: number; size?: number };

/**
 * This book's wear over the cloth, as straight-alpha RGBA: transparent where
 * the linen shows as woven, mostly opaque where the dark cloth or the bare
 * board covers it. Drawn for a square cover (see SKETCHBOOK_COVER).
 */
export const wearSketchbookCover = ({ seed = 1888, size = 1024 }: WearOptions = {}): Raster => {
	const rand = random(seed);
	const coarse = latticeNoise(rand, 64, 64);
	const fine = latticeNoise(rand, 512, 512);
	const grain = latticeNoise(rand, 1024, 1024);
	const S = size;
	// Every length below is in pixels of the 1024-pixel original.
	const px = S / 1024;

	const colour = new Float32Array(S * S * 3);
	const alpha = new Float32Array(S * S);

	const over = (index: number, rgb: Rgb, a: number) => {
		if (a <= 0) return;
		const below = alpha[index];
		const out = a + below * (1 - a);
		for (let channel = 0; channel < 3; channel++) {
			const current = colour[index * 3 + channel];
			colour[index * 3 + channel] = (rgb[channel] * a + current * below * (1 - a)) / out;
		}
		alpha[index] = out;
	};
	const isOnDarkCloth = (index: number) =>
		alpha[index] * (1 - luma([colour[index * 3], colour[index * 3 + 1], colour[index * 3 + 2]])) >
		0.45;

	const spineEdge = (y: number) =>
		S * SKETCHBOOK_COVER.spine + (fbm(coarse, 3.1, y / (14 * px), 2) - 0.5) * 1.4 * px;
	const cornerLeg = (along: number) =>
		S * SKETCHBOOK_COVER.corner + (fbm(coarse, along / (14 * px), 7.7, 2) - 0.5) * 1.4 * px;

	/**
	 * The cut edge of the linen where it overlaps the dark cloth: it catches the
	 * light where it faces it, and is shaded, casting a hairline of shadow, where
	 * it faces away. `distance` is positive on the linen side.
	 */
	const ridge = (index: number, distance: number, normal: readonly [number, number]) => {
		const facing = normal[0] * LIGHT_XY[0] + normal[1] * LIGHT_XY[1];
		const width = 3 * px;
		if (distance > -0.5 && distance < width) {
			const strength = clamp01(1 - distance / width) * clamp01(distance + 0.5);
			if (facing > 0) over(index, LINEN_RUBBED, 0.9 * facing * strength);
			else over(index, SHADOW, 0.4 * -facing * strength);
		}
		if (facing < 0 && distance < 0 && distance > -3.5 * px) {
			over(index, SHADOW, 0.35 * -facing * (1 + distance / (3.5 * px)));
		}
	};

	/** Dark cloth, rubbed toward brown-grey by `rub` (0..1), over `coverage` of the pixel. */
	const darkCloth = (index: number, rub: number, coverage: number) => {
		const worn = clamp01(rub);
		over(
			index,
			mix(DARK_CLOTH, DARK_CLOTH_RUBBED, worn * 0.8),
			(DARK_OPACITY - 0.08 * worn) * coverage
		);
	};

	for (let y = 0; y < S; y++) {
		for (let x = 0; x < S; x++) {
			const index = y * S + x;
			const u = (x + 0.5) / S;
			const v = (y + 0.5) / S;
			const X = x / px;
			const Y = y / px;

			// Age: the cloth darkened and faded unevenly over the years.
			const age =
				(fbm(coarse, X / 260, Y / 260, 3) - 0.5) * 1.2 +
				(fbm(coarse, X / 90, Y / 90, 2) - 0.5) * 0.35;
			// One colour running smoothly from dark to light, so the image stays
			// cheap to compress where the age barely shows.
			over(
				index,
				mix(AGE_DARK, AGE_LIGHT, smoothstep(-0.12, 0.12, age)),
				Math.min(0.11, Math.abs(age) * 0.33)
			);

			// Grime where the book is held and opened: the fore-edge, low down.
			const held =
				smoothstep(0.78, 0.985, u) *
				(0.4 + 0.6 * fbm(coarse, X / 70, Y / 110, 3)) *
				(0.45 + 0.55 * Math.exp(-(((v - 0.6) / 0.22) ** 2)));
			over(index, GRIME, 0.2 * held);

			// Graphite from the fingers of someone who draws in it.
			for (const [cx, cy, rx, ry, turn] of [
				[0.9, 0.6, 0.05, 0.017, -0.35],
				[0.93, 0.7, 0.04, 0.013, -0.25],
				[0.885, 0.77, 0.032, 0.012, -0.45]
			]) {
				const ox = u - cx;
				const oy = v - cy;
				const along = ox * Math.cos(turn) + oy * Math.sin(turn);
				const across = -ox * Math.sin(turn) + oy * Math.cos(turn);
				const falloff = Math.exp(-((along / rx) ** 2 + (across / ry) ** 2));
				const streak = 0.5 + 0.5 * fbm(fine, along * 700, across * 120, 2);
				over(index, GRAPHITE, 0.17 * falloff * streak);
			}

			// The dark cloth spine, reaching onto the board.
			const toSpine = spineEdge(y) - (x + 0.5);
			if (toSpine > -0.5) {
				const ends = 1 - smoothstep(0, 0.08, Math.min(v, 1 - v));
				const rub =
					smoothstep(0.3, 0.9, fbm(coarse, X / 70, Y / 200, 3)) * 0.32 +
					ends * 0.6 +
					(1 - smoothstep(0, 0.018, u)) * 0.4;
				darkCloth(index, rub, clamp01(toSpine + 0.5));

				// The joint the cover hinges on, pressed into the cloth: shaded on
				// the side away from the light, lit on the other.
				const groove = (u - 0.047) / 0.011;
				if (Math.abs(groove) < 1) {
					const depth = 1 - Math.abs(groove);
					if (groove < 0) over(index, SHADOW, 0.4 * depth * depth);
					else over(index, DARK_CLOTH_RUBBED, 0.28 * depth);
				}
			}
			ridge(index, -toSpine, [-1, 0]);

			// The dark cloth corners on the open side.
			for (const [cornerY, normalY] of [
				[0, -1],
				[S, 1]
			] as const) {
				const fromEdge = S - (x + 0.5);
				const fromHead = Math.abs(cornerY - (y + 0.5));
				const leg = cornerLeg(cornerY === 0 ? x : S - x + 300 * px);
				const inside = (leg - fromEdge - fromHead) / Math.SQRT2;
				if (inside > -0.5) {
					const tip = Math.hypot(fromEdge, fromHead) / S;
					const rub =
						smoothstep(0.35, 0.9, fbm(coarse, X / 60, Y / 60, 3)) * 0.25 +
						(1 - smoothstep(0, 0.1, tip)) * 0.9;
					darkCloth(index, rub, clamp01(inside + 0.5));
				}
				ridge(index, -inside, [Math.SQRT1_2, normalY * Math.SQRT1_2]);
			}

			// Every edge of the board rubbed pale along its threads, the fore-edge
			// most of all where the book is opened.
			const fromLeft = x + 0.5;
			const fromRight = S - 0.5 - x;
			const fromTop = y + 0.5;
			const fromBottom = S - 0.5 - y;
			const edge = Math.min(fromLeft, fromRight, fromTop, fromBottom) / S;
			const alongEdge = Math.min(fromLeft, fromRight) < Math.min(fromTop, fromBottom);
			const opened = (1 - smoothstep(0, 0.012, 1 - u)) * Math.exp(-(((v - 0.6) / 0.24) ** 2));
			const rubbed =
				(1 - smoothstep(0, 0.0095, edge)) * (0.5 + 0.5 * fbm(coarse, X / 22, Y / 22, 2)) +
				0.42 * opened;
			const fibres = alongEdge ? grain(X / 1.2, Y / 3.4) : grain(X / 3.4, Y / 1.2);
			const worn = clamp01((rubbed - fibres) * 2);
			if (worn > 0) {
				over(index, isOnDarkCloth(index) ? DARK_CLOTH_FRAYED : LINEN_RUBBED, 0.68 * worn);
			}

			// Frayed through to the board at the corner tips and the spine's ends.
			const cornerTip = Math.min(Math.hypot(S - x, y), Math.hypot(S - x, S - y)) / S;
			const spineEnd = x < spineEdge(y) ? Math.min(v, 1 - v) + u * 0.3 : 1;
			const fray = 1 - smoothstep(0, 0.04, Math.min(cornerTip, spineEnd));
			if (fray > 0) {
				const n = spineEnd < cornerTip ? fine(X / 1.2, Y / 3) : fine(X / 2, Y / 2);
				if (n < fray) over(index, DARK_CLOTH_FRAYED, 0.85 * smoothstep(0, 0.2, fray - n));
				if (n < fray - 0.4) over(index, BOARD, 0.95 * smoothstep(0, 0.15, fray - 0.4 - n));
			}
		}
	}

	return toRaster(S, S, (x, y) => {
		const index = y * S + x;
		return [colour[index * 3], colour[index * 3 + 1], colour[index * 3 + 2], alpha[index]];
	});
};
