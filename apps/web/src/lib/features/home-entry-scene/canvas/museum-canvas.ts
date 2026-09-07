const WINDOW_CANVAS_WIDTH = 720;
const WINDOW_CANVAS_HEIGHT = 640;
const WALL_TILE_WIDTH = 512;
const WALL_TILE_HEIGHT = 512;
let cachedMuseumWallPatternUrl: string | null = null;
let cachedMuseumWindowFrameUrl: string | null = null;
const cachedStickerBackgroundUrls = new Map<string, string>();

type Rgb = [number, number, number];

const WINDOW_COLORS = {
	sA: [198, 182, 152] as Rgb,
	sB: [172, 156, 126] as Rgb,
	sC: [140, 124, 96] as Rgb,
	sD: [108, 94, 70] as Rgb,
	fA: [22, 14, 6] as Rgb,
	fB: [42, 28, 12] as Rgb,
	fC: [66, 44, 18] as Rgb,
	fD: [88, 64, 28] as Rgb
};

const rgb = (color: Rgb, alpha = 1) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;

const svgPoints = (points: number[]) => {
	const values: string[] = [];
	for (let index = 0; index < points.length; index += 2) {
		values.push(`${points[index]},${points[index + 1]}`);
	}
	return values.join(' ');
};

export const museumWindowOpening = {
	left: 130 / WINDOW_CANVAS_WIDTH,
	top: 118 / WINDOW_CANVAS_HEIGHT,
	width: 460 / WINDOW_CANVAS_WIDTH,
	height: 415 / WINDOW_CANVAS_HEIGHT
};

export const museumWindowAspectRatio = `${WINDOW_CANVAS_WIDTH}/${WINDOW_CANVAS_HEIGHT}`;

export function createMuseumWindowFrameUrl() {
	if (cachedMuseumWindowFrameUrl) {
		return cachedMuseumWindowFrameUrl;
	}

	const W = WINDOW_CANVAS_WIDTH;
	const H = WINDOW_CANVAS_HEIGHT;
	const WX = 130;
	const WY = 118;
	const WW = 460;
	const WH = 415;
	const FT = 14;
	const ML = 10;
	const NC = 3;
	const NR = 2;
	const GX = WX + FT;
	const GY = WY + FT;
	const GW = WW - FT * 2;
	const GH = WH - FT * 2;
	const PW = Math.floor((GW - ML * (NC - 1)) / NC);
	const PH = Math.floor((GH - ML * (NR - 1)) / NR);
	const PILX = 82;
	const PILW = 48;
	const PIRX = WX + WW;
	const PIRW = 48;
	const CRNX = PILX - 14;
	const CRNW = PILW + PIRW + WW + 28;
	const LINTEL_TOP = 42;
	const LINTEL_H = 76;
	const SILL_Y = WY + WH;
	const SILL_H = 56;
	const REV = 22;

	const parts = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" shape-rendering="geometricPrecision">`
	];

	const pushStoneFace = (x: number, y: number, width: number, height: number, n = 1) => {
		const [r, g, b] = WINDOW_COLORS.sA;
		const fill = `rgb(${Math.trunc(r * n)},${Math.trunc(g * n)},${Math.trunc(b * n)})`;
		parts.push(
			`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`,
			`<polygon points="${svgPoints([x, y, x + width, y, x + width - 8, y + 11, x + 8, y + 11])}" fill="rgba(255,248,225,0.20)"/>`,
			`<polygon points="${svgPoints([x + width, y, x + width, y + height, x + width - 8, y + height - 9, x + width - 8, y + 11])}" fill="rgba(0,0,0,0.12)"/>`,
			`<polygon points="${svgPoints([x, y + height, x + width, y + height, x + width - 8, y + height - 9, x + 8, y + height - 9])}" fill="rgba(0,0,0,0.17)"/>`
		);
	};

	const pushPilaster = (x: number, width: number, startY: number, endY: number) => {
		let currentY = startY;
		let index = 0;
		while (currentY < endY) {
			const height = Math.min(58, endY - currentY);
			pushStoneFace(x, currentY, width, height, 0.9 + Math.sin(index * 4.1) * 0.1);
			parts.push(
				`<line x1="${x}" y1="${currentY + height}" x2="${x + width}" y2="${currentY + height}" stroke="${rgb(WINDOW_COLORS.sC)}" stroke-width="1.5"/>`
			);
			currentY += 58;
			index += 1;
		}
	};

	const pushCapital = (x: number, width: number, y: number) => {
		parts.push(
			`<rect x="${x - 6}" y="${y}" width="${width + 12}" height="14" fill="${rgb(WINDOW_COLORS.sB)}"/>`,
			`<polygon points="${svgPoints([x - 6, y, x + width + 6, y, x + width + 2, y + 6, x - 2, y + 6])}" fill="rgba(255,248,225,0.25)"/>`,
			`<rect x="${x - 6}" y="${y + 12}" width="${width + 12}" height="2" fill="${rgb(WINDOW_COLORS.sD, 0.5)}"/>`
		);
	};

	const pushPlinth = (x: number, width: number, y: number) => {
		parts.push(
			`<rect x="${x - 8}" y="${y}" width="${width + 16}" height="16" fill="${rgb(WINDOW_COLORS.sB)}"/>`,
			`<polygon points="${svgPoints([x - 8, y, x + width + 8, y, x + width + 4, y + 7, x - 4, y + 7])}" fill="rgba(255,248,225,0.20)"/>`,
			`<rect x="${x - 8}" y="${y + 14}" width="${width + 16}" height="2" fill="${rgb(WINDOW_COLORS.sD, 0.5)}"/>`
		);
	};

	pushPilaster(PILX, PILW, LINTEL_TOP, SILL_Y + SILL_H + 6);
	pushPilaster(PIRX, PIRW, LINTEL_TOP, SILL_Y + SILL_H + 6);

	parts.push(
		`<polygon points="${svgPoints([WX, WY, WX, WY + WH, WX - REV, WY + WH + REV * 0.3, WX - REV, WY - REV * 0.3])}" fill="${rgb(WINDOW_COLORS.sD, 0.82)}"/>`,
		`<polygon points="${svgPoints([WX + WW, WY, WX + WW, WY + WH, WX + WW + REV, WY + WH + REV * 0.3, WX + WW + REV, WY - REV * 0.3])}" fill="${rgb(WINDOW_COLORS.sD, 0.58)}"/>`,
		`<polygon points="${svgPoints([WX, WY, WX + WW, WY, WX + WW + REV, WY - REV * 0.5, WX - REV, WY - REV * 0.5])}" fill="${rgb(WINDOW_COLORS.sD, 0.68)}"/>`
	);

	const cornY = LINTEL_TOP;
	const cornH = 28;
	const friezeY = cornY + cornH;
	const friezeH = 22;
	const archY = friezeY + friezeH;
	const archH = 28;
	const CX = CRNX;
	const CW = CRNW;

	parts.push(
		`<rect x="${CX - 16}" y="${cornY}" width="${CW + 32}" height="${cornH}" fill="${rgb(WINDOW_COLORS.sA)}"/>`,
		`<polygon points="${svgPoints([CX - 16, cornY, CX + CW + 16, cornY, CX + CW + 10, cornY + 9, CX - 10, cornY + 9])}" fill="rgba(255,248,225,0.24)"/>`,
		`<rect x="${CX - 16}" y="${cornY + cornH - 4}" width="${CW + 32}" height="4" fill="rgba(0,0,0,0.28)"/>`,
		`<rect x="${CX}" y="${friezeY}" width="${CW}" height="${friezeH}" fill="${rgb(WINDOW_COLORS.sB)}"/>`,
		`<rect x="${CX}" y="${friezeY}" width="${CW}" height="4" fill="rgba(0,0,0,0.08)"/>`
	);

	let tx = CX + 30;
	while (tx + 22 < CX + CW - 25) {
		parts.push(
			`<polygon points="${svgPoints([tx, friezeY + 5, tx + 11, friezeY + 18, tx + 22, friezeY + 5])}" fill="${rgb(WINDOW_COLORS.sC, 0.9)}"/>`,
			`<rect x="${tx + 6}" y="${friezeY + 5}" width="3" height="13" fill="${rgb(WINDOW_COLORS.sD, 0.4)}"/>`,
			`<rect x="${tx + 13}" y="${friezeY + 5}" width="3" height="13" fill="${rgb(WINDOW_COLORS.sD, 0.4)}"/>`
		);
		tx += 52;
	}

	const ksW = 36;
	const ksX = CX + CW / 2 - ksW / 2;
	parts.push(
		`<rect x="${CX}" y="${archY}" width="${CW}" height="${archH}" fill="${rgb(WINDOW_COLORS.sA)}"/>`,
		`<rect x="${CX}" y="${archY}" width="${CW}" height="4" fill="rgba(0,0,0,0.1)"/>`,
		`<polygon points="${svgPoints([ksX, archY, ksX + ksW, archY, ksX + ksW - 5, archY + archH, ksX + 5, archY + archH])}" fill="${rgb(WINDOW_COLORS.sB)}"/>`,
		`<rect x="${ksX}" y="${archY}" width="${ksW}" height="${archH}" stroke="${rgb(WINDOW_COLORS.sD, 0.7)}" stroke-width="1" fill="none"/>`,
		`<polygon points="${svgPoints([ksX, archY, ksX + ksW, archY, ksX + ksW - 5, archY + 10, ksX + 5, archY + 10])}" fill="rgba(255,245,220,0.18)"/>`,
		`<rect x="${CX - 18}" y="${SILL_Y}" width="${CW + 36}" height="${SILL_H}" fill="${rgb(WINDOW_COLORS.sA)}"/>`,
		`<polygon points="${svgPoints([CX - 18, SILL_Y, CX + CW + 18, SILL_Y, CX + CW + 14, SILL_Y + 14, CX - 14, SILL_Y + 14])}" fill="rgba(255,248,225,0.26)"/>`,
		`<rect x="${CX - 22}" y="${SILL_Y + SILL_H - 9}" width="${CW + 44}" height="3" fill="${rgb(WINDOW_COLORS.sD, 0.5)}"/>`
	);

	pushCapital(PILX, PILW, LINTEL_TOP + LINTEL_H);
	pushCapital(PIRX, PIRW, LINTEL_TOP + LINTEL_H);
	pushPlinth(PILX, PILW, SILL_Y + 4);
	pushPlinth(PIRX, PIRW, SILL_Y + 4);

	parts.push(
		`<path d="M ${WX} ${WY} H ${WX + WW} V ${WY + FT} H ${WX + FT} V ${WY + WH} H ${WX} Z" fill="${rgb(WINDOW_COLORS.fA)}" fill-rule="evenodd"/>`,
		`<path d="M ${WX} ${WY + WH - FT} H ${WX + WW} V ${WY + WH} H ${WX} Z" fill="${rgb(WINDOW_COLORS.fA)}"/>`,
		`<path d="M ${WX} ${WY} H ${WX + FT} V ${WY + WH} H ${WX} Z" fill="${rgb(WINDOW_COLORS.fA)}"/>`,
		`<path d="M ${WX + WW - FT} ${WY} H ${WX + WW} V ${WY + WH} H ${WX + WW - FT} Z" fill="${rgb(WINDOW_COLORS.fA)}"/>`,
		`<polygon points="${svgPoints([WX, WY, WX + WW, WY, WX + WW - FT, WY + FT, WX + FT, WY + FT])}" fill="${rgb(WINDOW_COLORS.fC, 0.65)}"/>`,
		`<polygon points="${svgPoints([WX, WY, WX + FT, WY, WX + FT, WY + WH, WX, WY + WH])}" fill="${rgb(WINDOW_COLORS.fB, 0.55)}"/>`
	);

	for (let c = 1; c < NC; c += 1) {
		const mx = GX + c * (PW + ML) - ML;
		parts.push(
			`<rect x="${mx}" y="${GY}" width="${ML}" height="${GH}" fill="${rgb(WINDOW_COLORS.fA)}"/>`,
			`<rect x="${mx}" y="${GY}" width="3" height="${GH}" fill="${rgb(WINDOW_COLORS.fC, 0.5)}"/>`,
			`<rect x="${mx + ML - 3}" y="${GY}" width="3" height="${GH}" fill="rgba(0,0,0,0.3)"/>`
		);
	}

	for (let r = 1; r < NR; r += 1) {
		const ty = GY + r * (PH + ML) - ML;
		parts.push(
			`<rect x="${GX}" y="${ty}" width="${GW}" height="${ML}" fill="${rgb(WINDOW_COLORS.fA)}"/>`,
			`<rect x="${GX}" y="${ty}" width="${GW}" height="3" fill="${rgb(WINDOW_COLORS.fC, 0.5)}"/>`,
			`<rect x="${GX}" y="${ty + ML - 3}" width="${GW}" height="3" fill="rgba(0,0,0,0.3)"/>`
		);
	}

	const pushRivet = (x: number, y: number) => {
		parts.push(
			`<circle cx="${x}" cy="${y}" r="5" fill="${rgb(WINDOW_COLORS.fD, 0.9)}"/>`,
			`<circle cx="${x + 1}" cy="${y + 1}" r="3" fill="${rgb(WINDOW_COLORS.fA, 0.85)}"/>`,
			`<circle cx="${x - 1}" cy="${y - 1}" r="1.5" fill="rgba(255,200,80,0.18)"/>`
		);
	};

	pushRivet(WX + FT * 0.5, WY + FT * 0.5);
	pushRivet(WX + WW - FT * 0.5, WY + FT * 0.5);
	pushRivet(WX + FT * 0.5, WY + WH - FT * 0.5);
	pushRivet(WX + WW - FT * 0.5, WY + WH - FT * 0.5);

	for (let c = 1; c < NC; c += 1) {
		const mx = GX + c * (PW + ML) - ML + ML / 2;
		pushRivet(mx, WY + FT * 0.5);
		pushRivet(mx, WY + WH - FT * 0.5);
	}

	for (let r = 1; r < NR; r += 1) {
		const ty = GY + r * (PH + ML) - ML + ML / 2;
		pushRivet(WX + FT * 0.5, ty);
		pushRivet(WX + WW - FT * 0.5, ty);
	}

	for (let r = 0; r < NR; r += 1) {
		for (let c = 0; c < NC; c += 1) {
			const px = GX + c * (PW + ML);
			const py = GY + r * (PH + ML);
			parts.push(
				`<rect x="${px}" y="${py}" width="${PW}" height="${PH}" fill="rgba(200,225,245,0.06)"/>`,
				`<polygon points="${svgPoints([px + 4, py + 4, px + PW * 0.42, py + 4, px + PW * 0.18, py + PH * 0.4, px + 4, py + PH * 0.24])}" fill="rgba(255,255,255,0.09)"/>`,
				`<polygon points="${svgPoints([px + PW * 0.6, py + 4, px + PW - 4, py + 4, px + PW - 4, py + PH * 0.2, px + PW * 0.76, py + PH * 0.1])}" fill="rgba(255,255,255,0.06)"/>`,
				`<polygon points="${svgPoints([px + 4, py + 4, px + 22, py + 4, px + 10, py + 16])}" fill="rgba(255,255,255,0.13)"/>`,
				`<line x1="${px + 3}" y1="${py + 3}" x2="${px + PW - 3}" y2="${py + 3}" stroke="rgba(210,235,255,0.28)" stroke-width="1.5"/>`,
				`<line x1="${px + 3}" y1="${py + 4}" x2="${px + 3}" y2="${py + PH - 3}" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>`
			);
		}
	}

	parts.push(
		`<rect x="${WX + 0.5}" y="${WY + 0.5}" width="${WW - 1}" height="${WH - 1}" stroke="${rgb(WINDOW_COLORS.fA, 0.7)}" stroke-width="1" fill="none"/>`,
		'</svg>'
	);

	cachedMuseumWindowFrameUrl = `data:image/svg+xml,${encodeURIComponent(parts.join(''))}`;
	return cachedMuseumWindowFrameUrl;
}

export function createMuseumWallPatternUrl() {
	if (cachedMuseumWallPatternUrl) {
		return cachedMuseumWallPatternUrl;
	}

	let seed = 91827;
	const rng = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed & 0x7fffffff) / 2147483647;
	};

	const baseFill = '#6c5e4b';
	const mortarFill = '#5a4938';
	const brickOutline = '#7b6852';
	const rowHeights = [68, 60, 72, 56];
	const mortar = 3;
	const brickWidth = 128;
	const parts = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${WALL_TILE_WIDTH}" height="${WALL_TILE_HEIGHT}" viewBox="0 0 ${WALL_TILE_WIDTH} ${WALL_TILE_HEIGHT}" shape-rendering="geometricPrecision">`,
		`<rect width="${WALL_TILE_WIDTH}" height="${WALL_TILE_HEIGHT}" fill="${baseFill}"/>`
	];

	let y = 0;
	let rowIndex = 0;
	while (y < WALL_TILE_HEIGHT) {
		const rowHeight = rowHeights[rowIndex % rowHeights.length];
		const brickHeight = rowHeight - mortar;
		const offset = rowIndex % 2 === 0 ? 0 : brickWidth / 2;

		for (let col = -1; col <= Math.ceil(WALL_TILE_WIDTH / brickWidth) + 1; col += 1) {
			const widthVariance = 0.94 + rng() * 0.12;
			const currentBrickWidth = Math.round(brickWidth * widthVariance);
			const x = Math.round(col * brickWidth + offset - (currentBrickWidth - brickWidth) / 2);
			if (x + currentBrickWidth < 0 || x > WALL_TILE_WIDTH) continue;

			const tint = 0.9 + rng() * 0.14;
			const [r, g, b] = WINDOW_COLORS.sA;
			const fill = `rgb(${Math.trunc(r * tint)},${Math.trunc(g * tint)},${Math.trunc(b * tint)})`;
			const bevel = 6;
			parts.push(
				`<rect x="${x}" y="${y}" width="${currentBrickWidth}" height="${brickHeight}" rx="2" fill="${fill}" stroke="${brickOutline}" stroke-opacity="0.32"/>`,
				`<path d="M ${x} ${y} H ${x + currentBrickWidth} L ${x + currentBrickWidth - bevel} ${y + bevel + 2} H ${x + bevel} Z" fill="rgba(255,248,225,0.16)"/>`,
				`<path d="M ${x} ${y + brickHeight} H ${x + currentBrickWidth} L ${x + currentBrickWidth - bevel} ${y + brickHeight - bevel} H ${x + bevel} Z" fill="rgba(0,0,0,0.14)"/>`
			);

			const crackCount = 1 + (rng() > 0.62 ? 1 : 0);
			for (let crackIndex = 0; crackIndex < crackCount; crackIndex += 1) {
				const crackX1 = Math.round(x + bevel + rng() * (currentBrickWidth - bevel * 3));
				const crackY1 = Math.round(y + bevel + rng() * (brickHeight - bevel * 3));
				const crackX2 = Math.round(crackX1 + (rng() - 0.5) * 28);
				const crackY2 = Math.round(crackY1 + (rng() - 0.5) * 18);
				parts.push(
					`<path d="M ${crackX1} ${crackY1} L ${crackX2} ${crackY2}" stroke="rgba(108,94,70,${0.14 + rng() * 0.08})" stroke-width="${(0.5 + rng() * 0.8).toFixed(2)}" stroke-linecap="round"/>`
				);
			}

			if (rng() > 0.72) {
				const stainX = Math.round(x + bevel + rng() * (currentBrickWidth - bevel * 4));
				const stainY = Math.round(y + bevel + rng() * (brickHeight - bevel * 4));
				const stainWidth = Math.round(12 + rng() * 22);
				const stainHeight = Math.round(8 + rng() * 14);
				parts.push(
					`<ellipse cx="${stainX + stainWidth / 2}" cy="${stainY + stainHeight / 2}" rx="${stainWidth / 2}" ry="${stainHeight / 2}" fill="rgba(140,124,96,${0.08 + rng() * 0.08})"/>`
				);
			}
		}

		const mortarY = y + rowHeight - mortar;
		parts.push(
			`<rect x="0" y="${mortarY}" width="${WALL_TILE_WIDTH}" height="${mortar}" fill="${mortarFill}" fill-opacity="0.7"/>`,
			`<line x1="0" y1="${mortarY - 0.5}" x2="${WALL_TILE_WIDTH}" y2="${mortarY - 0.5}" stroke="rgba(255,248,225,0.08)" stroke-width="0.5"/>`,
			`<line x1="0" y1="${mortarY + mortar}" x2="${WALL_TILE_WIDTH}" y2="${mortarY + mortar}" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>`
		);

		y += rowHeight;
		rowIndex += 1;
	}

	seed = 44219;
	for (let speckleIndex = 0; speckleIndex < 92; speckleIndex += 1) {
		const speckleX = Math.round(rng() * WALL_TILE_WIDTH);
		const speckleY = Math.round(rng() * WALL_TILE_HEIGHT);
		const speckleRadius = (0.35 + rng() * 1.2).toFixed(2);
		parts.push(
			`<circle cx="${speckleX}" cy="${speckleY}" r="${speckleRadius}" fill="rgba(255,248,225,${0.04 + rng() * 0.06})"/>`
		);
	}

	parts.push('</svg>');

	cachedMuseumWallPatternUrl = `data:image/svg+xml,${encodeURIComponent(parts.join(''))}`;
	return cachedMuseumWallPatternUrl;
}

/* ══════════════════════════════════════════════════════════ *
 *  Sticker / tape-label button background                    *
 * ══════════════════════════════════════════════════════════ */

export type StickerVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

export interface StickerBackgroundOptions {
	variant?: StickerVariant;
}

const STICKER_COLORS = {
	paper: [251, 247, 240] as Rgb,
	primary: [212, 131, 74] as Rgb,
	secondary: [113, 145, 127] as Rgb,
	accent: [217, 176, 123] as Rgb,
	danger: [162, 77, 73] as Rgb
};

const PAINT_STAIN_COLORS: Rgb[] = [
	[244, 196, 48],
	[212, 149, 108],
	[139, 157, 145],
	[200, 79, 79],
	[212, 131, 74],
	[217, 176, 123]
];

const STICKER_TAPE_TINTS: Record<StickerVariant, Rgb> = {
	primary: [255, 250, 230],
	secondary: [240, 245, 242],
	accent: [255, 250, 235],
	danger: [250, 235, 233],
	ghost: [245, 240, 232]
};

/** Park-Miller LCG seeded PRNG — returns values in (0, 1). */
function makeRng(seed: number) {
	return () => {
		seed = (seed * 16807) % 2147483647;
		return (seed & 0x7fffffff) / 2147483647;
	};
}

/**
 * Create a data URL of a sticker background for use as a CSS
 * `background-image`.
 *
 * @param width   Canvas width in pixels
 * @param height  Canvas height in pixels
 * @param options Sticker variant and future options
 * @returns A `data:image/svg+xml,…` string
 */
export function createStickerBackgroundUrl(
	width: number,
	height: number,
	options: StickerBackgroundOptions = {}
): string {
	const { variant = 'primary' } = options;
	const cacheKey = `${width}x${height}:${variant}`;
	const cached = cachedStickerBackgroundUrls.get(cacheKey);
	if (cached) {
		return cached;
	}

	const bandColor = variant === 'ghost' ? STICKER_COLORS.paper : STICKER_COLORS[variant];
	const tapeColor = STICKER_TAPE_TINTS[variant];
	const rng = makeRng(99887 + width * 7 + height * 13 + (variant.charCodeAt(0) || 0) * 31);
	const bandMargin = Math.round(height * 0.1);
	const tapeWidth = Math.round(Math.max(16, width * 0.12));
	const tapeHeight = Math.round(Math.max(20, height * 0.35));
	const parts = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" fill="none" shape-rendering="geometricPrecision">`,
		'<defs>',
		'<filter id="sticker-shadow" x="-10%" y="-20%" width="140%" height="160%">',
		'<feDropShadow dx="1" dy="3" stdDeviation="3" flood-color="rgba(47,36,28,0.12)"/>',
		'</filter>',
		'<linearGradient id="sticker-hi" x1="0" y1="0" x2="0" y2="1">',
		'<stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>',
		'<stop offset="100%" stop-color="rgba(255,255,255,0)"/>',
		'</linearGradient>',
		'<linearGradient id="sticker-lo" x1="0" y1="0" x2="0" y2="1">',
		'<stop offset="0%" stop-color="rgba(0,0,0,0)"/>',
		'<stop offset="100%" stop-color="rgba(0,0,0,0.06)"/>',
		'</linearGradient>',
		'</defs>',
		`<rect x="3" y="3" width="${Math.max(0, width - 6)}" height="${Math.max(0, height - 6)}" rx="2" fill="rgba(0,0,0,0)" filter="url(#sticker-shadow)"/>`,
		`<rect x="2" y="2" width="${Math.max(0, width - 4)}" height="${Math.max(0, height - 4)}" rx="2" fill="${rgb(STICKER_COLORS.paper)}"/>`,
		`<rect x="${2 + bandMargin}" y="${2 + bandMargin}" width="${Math.max(0, width - 4 - bandMargin * 2)}" height="${Math.max(0, height - 4 - bandMargin * 2)}" rx="1" fill="${rgb(bandColor, 0.82)}"/>`,
		`<rect x="${2 + bandMargin}" y="${2 + bandMargin}" width="${Math.max(0, width - 4 - bandMargin * 2)}" height="${Math.max(0, Math.round(height * 0.3))}" rx="1" fill="url(#sticker-hi)"/>`,
		`<rect x="${2 + bandMargin}" y="${Math.round(height * 0.7)}" width="${Math.max(0, width - 4 - bandMargin * 2)}" height="${Math.max(0, Math.ceil(height * 0.3))}" rx="1" fill="url(#sticker-lo)"/>`
	];

	for (let x = 6; x < width - 6; x += 4 + rng() * 6) {
		if (rng() > 0.6) {
			const size = 1 + rng() * 2;
			const bottomY = height - 2 - rng();
			parts.push(
				`<rect x="${x.toFixed(2)}" y="1" width="${size.toFixed(2)}" height="${(1 + rng()).toFixed(2)}" fill="${rgb(STICKER_COLORS.paper)}"/>`,
				`<rect x="${x.toFixed(2)}" y="${bottomY.toFixed(2)}" width="${size.toFixed(2)}" height="${(1 + rng()).toFixed(2)}" fill="${rgb(STICKER_COLORS.paper)}"/>`
			);
		}
	}

	for (let y = 6; y < height - 6; y += 4 + rng() * 6) {
		if (rng() > 0.7) {
			const size = 1 + rng() * 1.5;
			const edgeWidth = 1 + rng();
			parts.push(
				`<rect x="1" y="${y.toFixed(2)}" width="${edgeWidth.toFixed(2)}" height="${size.toFixed(2)}" fill="${rgb(STICKER_COLORS.paper)}"/>`,
				`<rect x="${(width - 2 - rng()).toFixed(2)}" y="${y.toFixed(2)}" width="${(1 + rng()).toFixed(2)}" height="${size.toFixed(2)}" fill="${rgb(STICKER_COLORS.paper)}"/>`
			);
		}
	}

	parts.push(
		`<rect x="${(6 - tapeWidth / 2).toFixed(2)}" y="${(5 - tapeHeight / 2).toFixed(2)}" width="${tapeWidth}" height="${tapeHeight}" fill="${rgb(tapeColor, 0.46)}" stroke="rgba(0,0,0,0.05)" stroke-width="0.5" transform="rotate(-10 ${6} ${5})"/>`,
		`<line x1="${(6 - tapeWidth / 2 + 2).toFixed(2)}" y1="${(5 - tapeHeight * 0.1).toFixed(2)}" x2="${(6 + tapeWidth / 2 - 2).toFixed(2)}" y2="${(5 + tapeHeight * 0.05).toFixed(2)}" stroke="rgba(255,255,255,0.12)" stroke-width="1" transform="rotate(-10 ${6} ${5})"/>`,
		`<rect x="${(width - 6 - tapeWidth / 2).toFixed(2)}" y="${(height - 5 - tapeHeight / 2).toFixed(2)}" width="${tapeWidth}" height="${tapeHeight}" fill="${rgb(tapeColor, 0.44)}" stroke="rgba(0,0,0,0.05)" stroke-width="0.5" transform="rotate(10 ${width - 6} ${height - 5})"/>`,
		`<line x1="${(width - 6 - tapeWidth / 2 + 2).toFixed(2)}" y1="${(height - 5 + tapeHeight * 0.08).toFixed(2)}" x2="${(width - 6 + tapeWidth / 2 - 2).toFixed(2)}" y2="${(height - 5 - tapeHeight * 0.06).toFixed(2)}" stroke="rgba(255,255,255,0.10)" stroke-width="1" transform="rotate(10 ${width - 6} ${height - 5})"/>`
	);

	for (let index = 0; index < 3; index += 1) {
		const color = PAINT_STAIN_COLORS[Math.floor(rng() * PAINT_STAIN_COLORS.length)];
		const centerX = rng() * width;
		const centerY = rng() * height;
		const radius = 2 + rng() * 8;
		const alpha = 0.06 + rng() * 0.1;
		parts.push(
			`<ellipse cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" rx="${radius.toFixed(2)}" ry="${(radius * (0.5 + rng() * 0.7)).toFixed(2)}" transform="rotate(${(rng() * 180).toFixed(2)} ${centerX.toFixed(2)} ${centerY.toFixed(2)})" fill="${rgb(color, alpha)}"/>`
		);
		if (rng() > 0.5) {
			const dripX = centerX + (rng() - 0.5) * radius * 3;
			const dripY = centerY + rng() * radius * 2;
			parts.push(
				`<ellipse cx="${dripX.toFixed(2)}" cy="${dripY.toFixed(2)}" rx="${(radius * 0.25).toFixed(2)}" ry="${(radius * 0.4).toFixed(2)}" transform="rotate(${(rng() * 180).toFixed(2)} ${dripX.toFixed(2)} ${dripY.toFixed(2)})" fill="${rgb(color, alpha * 0.6)}"/>`
			);
		}
	}

	if (rng() > 0.35) {
		const centerX = width * 0.55 + rng() * width * 0.3;
		const centerY = height * 0.25 + rng() * height * 0.5;
		const radius = 5 + rng() * 7;
		parts.push(
			`<circle cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" r="${radius.toFixed(2)}" stroke="rgba(140,110,70,0.06)" stroke-width="${(1.2 + rng() * 0.8).toFixed(2)}" stroke-dasharray="${(radius * 4.8).toFixed(2)} ${(radius * 1.2).toFixed(2)}" fill="none"/>`
		);
	}

	for (let index = 0; index < 48; index += 1) {
		const x = rng() * width;
		const y = rng() * height;
		const radius = 0.35 + rng() * 0.8;
		parts.push(
			`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="rgba(255,255,255,${(0.02 + rng() * 0.035).toFixed(3)})"/>`
		);
	}

	parts.push('</svg>');

	const url = `data:image/svg+xml,${encodeURIComponent(parts.join(''))}`;
	cachedStickerBackgroundUrls.set(cacheKey, url);
	return url;
}
