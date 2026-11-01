import { DRAWING_LIMITS, type DrawingLimits } from '../shared/artwork/drawing-limits';
import { StrokeDocumentError } from './legacy';

/*
 * Version 3 of the drawing document: what the studio records, kept small.
 *
 * Each stroke stores its points as columns (x, y, time, pressure), the first
 * value whole and the rest as differences from the one before, which gzip
 * shrinks to under a third of the same points written as tuples. Positions
 * are whole quarters of a pixel, pressure is ten bits and time is whole
 * milliseconds since the stroke began; each stroke also says how long after
 * the previous one it began, which is all a timelapse needs.
 *
 * A brush is named with its version, so a published drawing keeps rendering
 * the way it was drawn after the brush changes. A fork names the artwork it
 * was drawn on in `parent` and holds only its own strokes.
 *
 * Columns are checked with a plain loop: schema libraries fall back to slow
 * interpretation on Workers, where eval is off, and a drawing can hold
 * hundreds of thousands of points.
 */

export const BRUSH_IDS = ['round@1', 'ink@1', 'eraser@1'] as const;
export type BrushId = (typeof BRUSH_IDS)[number];

export const POINTER_KINDS = ['mouse', 'pen', 'touch'] as const;
export type PointerKind = (typeof POINTER_KINDS)[number];

export type InkStroke = {
	brush: BrushId;
	/** The eraser's is the paper's. */
	color: string;
	pointer: PointerKind;
	/** 0 to 1, one per point; only for a pen that reports real pressure. */
	pressures?: number[];
	/** Document pixels, to the quarter. */
	points: [number, number][];
	size: number;
	/** Milliseconds after the previous stroke began (after the start, for the first). */
	start: number;
	/** Milliseconds after this stroke began, one per point. */
	times: number[];
};

export type ParentReference = {
	artwork: string;
	/** Where the parent's drawing is stored. */
	document: string;
	/** Where the parent's published image is stored. */
	image: string;
};

export type InkDocument = {
	background: string;
	height: number;
	kind: 'artwork' | 'avatar';
	parent?: ParentReference;
	strokes: InkStroke[];
	width: number;
};

export const XY_SCALE = 4;
export const PRESSURE_MAX = 1023;

type WireStroke = {
	brush: number;
	color?: string;
	p?: number[];
	pointer: PointerKind;
	size: number;
	start: number;
	t: number[];
	x: number[];
	y: number[];
};

export type DrawingV3Wire = {
	background: string;
	brushes: BrushId[];
	height: number;
	kind: 'artwork' | 'avatar';
	parent?: ParentReference;
	pressureMax: typeof PRESSURE_MAX;
	strokes: WireStroke[];
	version: 3;
	width: number;
	xyScale: typeof XY_SCALE;
};

const CANVAS = {
	artwork: { background: '#fdfbf7', height: 768, width: 768 },
	avatar: { background: '#f5f0e1', height: 340, width: 340 }
} as const;

const COLOR = /^#[0-9a-fA-F]{6}$/;

/** First value whole, the rest as differences from the one before. */
const toDeltas = (values: number[]) =>
	values.map((value, index) => (index === 0 ? value : value - values[index - 1]!));

export const encodeDrawingV3 = (document: InkDocument): DrawingV3Wire => {
	const brushes: BrushId[] = [];
	const brushIndex = (brush: BrushId) => {
		const index = brushes.indexOf(brush);
		if (index !== -1) return index;
		brushes.push(brush);
		return brushes.length - 1;
	};

	const strokes = document.strokes.map((stroke): WireStroke => {
		const wire: WireStroke = {
			brush: brushIndex(stroke.brush),
			...(stroke.brush === 'eraser@1' ? {} : { color: stroke.color }),
			pointer: stroke.pointer,
			size: stroke.size,
			start: Math.round(stroke.start),
			t: toDeltas(stroke.times.map(Math.round)),
			x: toDeltas(stroke.points.map(([x]) => Math.round(x * XY_SCALE))),
			y: toDeltas(stroke.points.map(([, y]) => Math.round(y * XY_SCALE)))
		};
		if (stroke.pressures) {
			wire.p = toDeltas(stroke.pressures.map((pressure) => Math.round(pressure * PRESSURE_MAX)));
		}
		return wire;
	});

	return {
		background: document.background,
		brushes,
		height: document.height,
		kind: document.kind,
		...(document.parent ? { parent: document.parent } : {}),
		pressureMax: PRESSURE_MAX,
		strokes,
		version: 3,
		width: document.width,
		xyScale: XY_SCALE
	};
};

const invalid = (message: string) =>
	new StrokeDocumentError('INVALID_DOCUMENT', `Invalid drawing document: ${message}`);

const limitExceeded = (message: string) =>
	new StrokeDocumentError('LIMITS_EXCEEDED', `Drawing document exceeds ${message}`);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value);

const isIntegerArray = (value: unknown): value is number[] =>
	Array.isArray(value) && value.every(isWhole);

/**
 * Sums a column of differences back to whole values, refusing any that leaves
 * [min, max] or, for time, that goes backwards.
 */
const fromDeltas = (
	column: number[],
	{
		label,
		max,
		min,
		nonDecreasing = false
	}: { label: string; max: number; min: number; nonDecreasing?: boolean }
) => {
	const values = new Array<number>(column.length);
	let value = 0;
	for (let index = 0; index < column.length; index += 1) {
		const delta = column[index]!;
		if (index > 0 && nonDecreasing && delta < 0) throw invalid(`${label} goes backwards`);
		value = index === 0 ? delta : value + delta;
		if (value < min || value > max) throw invalid(`${label} out of range`);
		values[index] = value;
	}
	return values;
};

const readParent = (value: unknown): ParentReference | undefined => {
	if (value === undefined) return undefined;
	if (
		!isRecord(value) ||
		typeof value.artwork !== 'string' ||
		typeof value.document !== 'string' ||
		typeof value.image !== 'string'
	) {
		throw invalid('parent must name an artwork, a document and an image');
	}
	return { artwork: value.artwork, document: value.document, image: value.image };
};

export const decodeDrawingV3 = (
	value: unknown,
	limits: DrawingLimits = DRAWING_LIMITS
): InkDocument => {
	if (!isRecord(value) || value.version !== 3) throw invalid('not a version 3 document');

	const kind = value.kind;
	if (kind !== 'artwork' && kind !== 'avatar') throw invalid('unknown kind');
	const canvas = CANVAS[kind];
	if (
		value.width !== canvas.width ||
		value.height !== canvas.height ||
		value.background !== canvas.background
	) {
		throw invalid(`the ${kind} canvas is ${canvas.width}x${canvas.height} on ${canvas.background}`);
	}
	if (value.xyScale !== XY_SCALE || value.pressureMax !== PRESSURE_MAX) {
		throw invalid('unsupported precision');
	}

	const brushes = value.brushes;
	if (
		!Array.isArray(brushes) ||
		!brushes.every((brush) => (BRUSH_IDS as readonly unknown[]).includes(brush))
	) {
		throw invalid('unknown brush');
	}

	if (!Array.isArray(value.strokes)) throw invalid('strokes must be a list');
	if (value.strokes.length > limits.maxStrokes) {
		throw limitExceeded(`max strokes of ${limits.maxStrokes}`);
	}

	const maxX = canvas.width * XY_SCALE;
	const maxY = canvas.height * XY_SCALE;
	let totalPoints = 0;

	const strokes = value.strokes.map((raw, strokeIndex): InkStroke => {
		const at = `stroke ${strokeIndex}`;
		if (!isRecord(raw)) throw invalid(`${at} must be an object`);

		const brush = isWhole(raw.brush) ? (brushes[raw.brush] as BrushId | undefined) : undefined;
		if (!brush) throw invalid(`${at} names no brush`);
		const color = brush === 'eraser@1' ? canvas.background : raw.color;
		if (typeof color !== 'string' || !COLOR.test(color)) throw invalid(`${at} has no colour`);
		if (!isWhole(raw.size) || raw.size < 1 || raw.size > 64) throw invalid(`${at} has a bad size`);
		if (!(POINTER_KINDS as readonly unknown[]).includes(raw.pointer)) {
			throw invalid(`${at} has an unknown pointer`);
		}
		if (!isWhole(raw.start) || raw.start < 0) throw invalid(`${at} has a bad start`);

		const { p, t, x, y } = raw;
		if (!isIntegerArray(x) || !isIntegerArray(y) || !isIntegerArray(t)) {
			throw invalid(`${at} columns must be whole numbers`);
		}
		const length = x.length;
		if (length === 0) throw invalid(`${at} has no points`);
		if (
			y.length !== length ||
			t.length !== length ||
			(p !== undefined && (!isIntegerArray(p) || p.length !== length))
		) {
			throw invalid(`${at} columns differ in length`);
		}
		if (length > limits.maxPointsPerStroke) {
			throw limitExceeded(`max points per stroke of ${limits.maxPointsPerStroke}`);
		}
		totalPoints += length;
		if (totalPoints > limits.maxTotalPoints) {
			throw limitExceeded(`max total points of ${limits.maxTotalPoints}`);
		}

		const xs = fromDeltas(x, { label: `${at} x`, max: maxX, min: 0 });
		const ys = fromDeltas(y, { label: `${at} y`, max: maxY, min: 0 });
		const times = fromDeltas(t, {
			label: `${at} time`,
			max: Number.MAX_SAFE_INTEGER,
			min: 0,
			nonDecreasing: true
		});

		const stroke: InkStroke = {
			brush,
			color,
			pointer: raw.pointer as PointerKind,
			points: xs.map((px, index) => [px / XY_SCALE, ys[index]! / XY_SCALE]),
			size: raw.size,
			start: raw.start,
			times
		};
		if (p !== undefined) {
			stroke.pressures = fromDeltas(p as number[], {
				label: `${at} pressure`,
				max: PRESSURE_MAX,
				min: 0
			}).map((level) => level / PRESSURE_MAX);
		}
		return stroke;
	});

	return {
		background: canvas.background,
		height: canvas.height,
		kind,
		...(value.parent !== undefined ? { parent: readParent(value.parent) } : {}),
		strokes,
		width: canvas.width
	};
};
