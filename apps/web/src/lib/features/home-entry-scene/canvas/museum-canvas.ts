const WINDOW_CANVAS_WIDTH = 720;
const WINDOW_CANVAS_HEIGHT = 640;
const WALL_TILE_WIDTH = 512;
const WALL_TILE_HEIGHT = 512;
let cachedMuseumWallPatternUrl: string | null = null;
let cachedMuseumWindowFrameUrl: string | null = null;
const cachedStickerBackgroundUrls = new Map<string, string>();

import { getFrequentReadCanvasContext } from '$lib/client/canvas-2d';

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

const polygon = (ctx: CanvasRenderingContext2D, points: number[], fill: string) => {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.moveTo(points[0], points[1]);

	for (let index = 2; index < points.length; index += 2) {
		ctx.lineTo(points[index], points[index + 1]);
	}

	ctx.closePath();
	ctx.fill();
};

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

export function drawMuseumWindowFrame(ctx: CanvasRenderingContext2D) {
	const W = WINDOW_CANVAS_WIDTH;
	const H = WINDOW_CANVAS_HEIGHT;

	ctx.clearRect(0, 0, W, H);

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

	const stoneFace = (x: number, y: number, w: number, h: number, n = 1) => {
		const [r, g, b] = WINDOW_COLORS.sA;
		ctx.fillStyle = `rgb(${Math.trunc(r * n)},${Math.trunc(g * n)},${Math.trunc(b * n)})`;
		ctx.fillRect(x, y, w, h);
		polygon(ctx, [x, y, x + w, y, x + w - 8, y + 11, x + 8, y + 11], 'rgba(255,248,225,0.20)');
		polygon(
			ctx,
			[x + w, y, x + w, y + h, x + w - 8, y + h - 9, x + w - 8, y + 11],
			'rgba(0,0,0,0.12)'
		);
		polygon(
			ctx,
			[x, y + h, x + w, y + h, x + w - 8, y + h - 9, x + 8, y + h - 9],
			'rgba(0,0,0,0.17)'
		);
	};

	const pilaster = (x: number, w: number, y1: number, y2: number) => {
		let by = y1;
		let i = 0;

		while (by < y2) {
			const h = Math.min(58, y2 - by);
			stoneFace(x, by, w, h, 0.9 + Math.sin(i * 4.1) * 0.1);
			ctx.strokeStyle = rgb(WINDOW_COLORS.sC);
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(x, by + h);
			ctx.lineTo(x + w, by + h);
			ctx.stroke();
			by += 58;
			i += 1;
		}
	};

	pilaster(PILX, PILW, LINTEL_TOP, SILL_Y + SILL_H + 6);
	pilaster(PIRX, PIRW, LINTEL_TOP, SILL_Y + SILL_H + 6);

	polygon(
		ctx,
		[WX, WY, WX, WY + WH, WX - REV, WY + WH + REV * 0.3, WX - REV, WY - REV * 0.3],
		rgb(WINDOW_COLORS.sD, 0.82)
	);
	polygon(
		ctx,
		[
			WX + WW,
			WY,
			WX + WW,
			WY + WH,
			WX + WW + REV,
			WY + WH + REV * 0.3,
			WX + WW + REV,
			WY - REV * 0.3
		],
		rgb(WINDOW_COLORS.sD, 0.58)
	);
	polygon(
		ctx,
		[WX, WY, WX + WW, WY, WX + WW + REV, WY - REV * 0.5, WX - REV, WY - REV * 0.5],
		rgb(WINDOW_COLORS.sD, 0.68)
	);

	const CX = CRNX;
	const CW = CRNW;
	const cornY = LINTEL_TOP;
	const cornH = 28;
	const friezeY = cornY + cornH;
	const friezeH = 22;
	const archY = friezeY + friezeH;
	const archH = 28;

	ctx.fillStyle = rgb(WINDOW_COLORS.sA);
	ctx.fillRect(CX - 16, cornY, CW + 32, cornH);
	polygon(
		ctx,
		[CX - 16, cornY, CX + CW + 16, cornY, CX + CW + 10, cornY + 9, CX - 10, cornY + 9],
		'rgba(255,248,225,0.24)'
	);
	ctx.fillStyle = 'rgba(0,0,0,0.28)';
	ctx.fillRect(CX - 16, cornY + cornH - 4, CW + 32, 4);
	const corniceShadow = ctx.createLinearGradient(0, cornY + cornH, 0, cornY + cornH + 10);
	corniceShadow.addColorStop(0, 'rgba(0,0,0,0.22)');
	corniceShadow.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = corniceShadow;
	ctx.fillRect(CX - 16, cornY + cornH, CW + 32, 10);

	ctx.fillStyle = rgb(WINDOW_COLORS.sB);
	ctx.fillRect(CX, friezeY, CW, friezeH);
	ctx.fillStyle = 'rgba(0,0,0,0.08)';
	ctx.fillRect(CX, friezeY, CW, 4);
	let tx = CX + 30;
	while (tx + 22 < CX + CW - 25) {
		polygon(
			ctx,
			[tx, friezeY + 5, tx + 11, friezeY + 18, tx + 22, friezeY + 5],
			rgb(WINDOW_COLORS.sC, 0.9)
		);
		ctx.fillStyle = rgb(WINDOW_COLORS.sD, 0.4);
		ctx.fillRect(tx + 6, friezeY + 5, 3, 13);
		ctx.fillRect(tx + 13, friezeY + 5, 3, 13);
		tx += 52;
	}

	ctx.fillStyle = rgb(WINDOW_COLORS.sA);
	ctx.fillRect(CX, archY, CW, archH);
	ctx.fillStyle = 'rgba(0,0,0,0.1)';
	ctx.fillRect(CX, archY, CW, 4);
	const ksW = 36;
	const ksX = CX + CW / 2 - ksW / 2;
	polygon(
		ctx,
		[ksX, archY, ksX + ksW, archY, ksX + ksW - 5, archY + archH, ksX + 5, archY + archH],
		rgb(WINDOW_COLORS.sB)
	);
	ctx.strokeStyle = rgb(WINDOW_COLORS.sD, 0.7);
	ctx.lineWidth = 1;
	ctx.strokeRect(ksX, archY, ksW, archH);
	polygon(
		ctx,
		[ksX, archY, ksX + ksW, archY, ksX + ksW - 5, archY + 10, ksX + 5, archY + 10],
		'rgba(255,245,220,0.18)'
	);

	ctx.fillStyle = rgb(WINDOW_COLORS.sA);
	ctx.fillRect(CX - 18, SILL_Y, CW + 36, SILL_H);
	polygon(
		ctx,
		[CX - 18, SILL_Y, CX + CW + 18, SILL_Y, CX + CW + 14, SILL_Y + 14, CX - 14, SILL_Y + 14],
		'rgba(255,248,225,0.26)'
	);
	ctx.fillStyle = rgb(WINDOW_COLORS.sD, 0.5);
	ctx.fillRect(CX - 22, SILL_Y + SILL_H - 9, CW + 44, 3);
	const sillShadow = ctx.createLinearGradient(0, SILL_Y + SILL_H, 0, SILL_Y + SILL_H + 18);
	sillShadow.addColorStop(0, 'rgba(0,0,0,0.26)');
	sillShadow.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = sillShadow;
	ctx.fillRect(CX - 18, SILL_Y + SILL_H, CW + 36, 18);

	const capital = (x: number, w: number, y: number) => {
		ctx.fillStyle = rgb(WINDOW_COLORS.sB);
		ctx.fillRect(x - 6, y, w + 12, 14);
		polygon(
			ctx,
			[x - 6, y, x + w + 6, y, x + w + 2, y + 6, x - 2, y + 6],
			'rgba(255,248,225,0.25)'
		);
		ctx.fillStyle = rgb(WINDOW_COLORS.sD, 0.5);
		ctx.fillRect(x - 6, y + 12, w + 12, 2);
	};

	capital(PILX, PILW, LINTEL_TOP + LINTEL_H);
	capital(PIRX, PIRW, LINTEL_TOP + LINTEL_H);

	const plinth = (x: number, w: number, y: number) => {
		ctx.fillStyle = rgb(WINDOW_COLORS.sB);
		ctx.fillRect(x - 8, y, w + 16, 16);
		polygon(
			ctx,
			[x - 8, y, x + w + 8, y, x + w + 4, y + 7, x - 4, y + 7],
			'rgba(255,248,225,0.20)'
		);
		ctx.fillStyle = rgb(WINDOW_COLORS.sD, 0.5);
		ctx.fillRect(x - 8, y + 14, w + 16, 2);
	};

	plinth(PILX, PILW, SILL_Y + 4);
	plinth(PIRX, PIRW, SILL_Y + 4);

	const frame = (x: number, y: number, w: number, h: number) => {
		ctx.fillStyle = rgb(WINDOW_COLORS.fA);
		ctx.fillRect(x, y, w, h);
	};

	frame(WX, WY, WW, FT);
	frame(WX, WY + WH - FT, WW, FT);
	frame(WX, WY, FT, WH);
	frame(WX + WW - FT, WY, FT, WH);
	polygon(
		ctx,
		[WX, WY, WX + WW, WY, WX + WW - FT, WY + FT, WX + FT, WY + FT],
		rgb(WINDOW_COLORS.fC, 0.65)
	);
	polygon(ctx, [WX, WY, WX + FT, WY, WX + FT, WY + WH, WX, WY + WH], rgb(WINDOW_COLORS.fB, 0.55));

	for (let c = 1; c < NC; c += 1) {
		const mx = GX + c * (PW + ML) - ML;
		frame(mx, GY, ML, GH);
		ctx.fillStyle = rgb(WINDOW_COLORS.fC, 0.5);
		ctx.fillRect(mx, GY, 3, GH);
		ctx.fillStyle = 'rgba(0,0,0,0.3)';
		ctx.fillRect(mx + ML - 3, GY, 3, GH);
	}

	for (let r = 1; r < NR; r += 1) {
		const ty = GY + r * (PH + ML) - ML;
		frame(GX, ty, GW, ML);
		ctx.fillStyle = rgb(WINDOW_COLORS.fC, 0.5);
		ctx.fillRect(GX, ty, GW, 3);
		ctx.fillStyle = 'rgba(0,0,0,0.3)';
		ctx.fillRect(GX, ty + ML - 3, GW, 3);
	}

	const rivet = (x: number, y: number) => {
		ctx.fillStyle = rgb(WINDOW_COLORS.fD, 0.9);
		ctx.beginPath();
		ctx.arc(x, y, 5, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = rgb(WINDOW_COLORS.fA, 0.85);
		ctx.beginPath();
		ctx.arc(x + 1, y + 1, 3, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = 'rgba(255,200,80,0.18)';
		ctx.beginPath();
		ctx.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2);
		ctx.fill();
	};

	rivet(WX + FT * 0.5, WY + FT * 0.5);
	rivet(WX + WW - FT * 0.5, WY + FT * 0.5);
	rivet(WX + FT * 0.5, WY + WH - FT * 0.5);
	rivet(WX + WW - FT * 0.5, WY + WH - FT * 0.5);

	for (let c = 1; c < NC; c += 1) {
		const mx = GX + c * (PW + ML) - ML + ML / 2;
		rivet(mx, WY + FT * 0.5);
		rivet(mx, WY + WH - FT * 0.5);
	}

	for (let r = 1; r < NR; r += 1) {
		const ty = GY + r * (PH + ML) - ML + ML / 2;
		rivet(WX + FT * 0.5, ty);
		rivet(WX + WW - FT * 0.5, ty);
	}

	for (let r = 0; r < NR; r += 1) {
		for (let c = 0; c < NC; c += 1) {
			const px = GX + c * (PW + ML);
			const py = GY + r * (PH + ML);
			const pw = PW;
			const ph = PH;

			ctx.fillStyle = 'rgba(200,225,245,0.06)';
			ctx.fillRect(px, py, pw, ph);
			polygon(
				ctx,
				[
					px + 4,
					py + 4,
					px + pw * 0.42,
					py + 4,
					px + pw * 0.18,
					py + ph * 0.4,
					px + 4,
					py + ph * 0.24
				],
				'rgba(255,255,255,0.09)'
			);
			polygon(
				ctx,
				[
					px + pw * 0.6,
					py + 4,
					px + pw - 4,
					py + 4,
					px + pw - 4,
					py + ph * 0.2,
					px + pw * 0.76,
					py + ph * 0.1
				],
				'rgba(255,255,255,0.06)'
			);
			polygon(ctx, [px + 4, py + 4, px + 22, py + 4, px + 10, py + 16], 'rgba(255,255,255,0.13)');
			ctx.strokeStyle = 'rgba(210,235,255,0.28)';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(px + 3, py + 3);
			ctx.lineTo(px + pw - 3, py + 3);
			ctx.stroke();
			ctx.strokeStyle = 'rgba(255,255,255,0.10)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(px + 3, py + 4);
			ctx.lineTo(px + 3, py + ph - 3);
			ctx.stroke();
		}
	}

	ctx.strokeStyle = rgb(WINDOW_COLORS.fA, 0.7);
	ctx.lineWidth = 1;
	ctx.strokeRect(WX + 0.5, WY + 0.5, WW - 1, WH - 1);
}

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

/* ── Gilded gallery frame ────────────────────────────── */

const FRAME_COLORS = {
	/** Bright gold highlight */
	gA: [212, 168, 64] as Rgb,
	/** Mid gold */
	gB: [192, 146, 42] as Rgb,
	/** Dark bronze shadow */
	gC: [142, 104, 32] as Rgb,
	/** Deep bronze underside */
	gD: [98, 72, 22] as Rgb,
	/** Mat / linen off-white */
	mat: [253, 251, 247] as Rgb,
	/** Mat inner shadow */
	matShadow: [218, 210, 196] as Rgb
};

export interface ArtworkFrameOptions {
	/** Outer moulding thickness as a fraction of the shorter side (default 0.08) */
	mouldingRatio?: number;
	/** Inner moulding thickness as fraction of outer (default 0.4) */
	innerMouldingRatio?: number;
	/** Mat (linen border) width as fraction of outer moulding (default 0.35) */
	matRatio?: number;
	/** Whether to draw the cast shadow beneath and right (default true) */
	castShadow?: boolean;
	/** Whether to draw corner ornaments (default true) */
	cornerOrnaments?: boolean;
}

/**
 * Draw an ornate gilded picture frame onto a canvas.
 *
 * The frame is drawn from (0, 0) to (width, height) with a transparent
 * rectangular opening in the center where the artwork should be placed.
 *
 * Returns the inner opening rect {x, y, w, h} so callers know where
 * to position the artwork image.
 */
export function drawArtworkFrame(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	options: ArtworkFrameOptions = {}
): { x: number; y: number; w: number; h: number } {
	const {
		mouldingRatio = 0.08,
		innerMouldingRatio = 0.4,
		matRatio = 0.35,
		castShadow = true,
		cornerOrnaments = true
	} = options;

	const shorter = Math.min(width, height);
	const outerT = Math.round(shorter * mouldingRatio);
	const innerT = Math.round(outerT * innerMouldingRatio);
	const matT = Math.round(outerT * matRatio);
	const totalT = outerT + innerT + matT;

	const opening = {
		x: totalT,
		y: totalT,
		w: width - totalT * 2,
		h: height - totalT * 2
	};

	ctx.clearRect(0, 0, width, height);

	/* ── cast shadow (drawn first, behind everything) ── */
	if (castShadow) {
		const shadowOffset = Math.round(shorter * 0.02);
		const shadowBlur = Math.round(shorter * 0.04);
		ctx.save();
		ctx.shadowColor = 'rgba(30, 20, 10, 0.35)';
		ctx.shadowOffsetX = shadowOffset;
		ctx.shadowOffsetY = shadowOffset;
		ctx.shadowBlur = shadowBlur;
		ctx.fillStyle = 'rgba(0,0,0,0)';
		/* draw the frame silhouette for shadow only */
		ctx.beginPath();
		ctx.rect(0, 0, width, height);
		/* cut out inner opening so shadow appears only around the frame edges */
		ctx.rect(opening.x, opening.y + opening.h, opening.w, -opening.h);
		ctx.fill('evenodd');
		ctx.restore();
	}

	/* ── outer moulding ─────────────────────────────── */
	const ox = 0,
		oy = 0,
		ow = width,
		oh = height;
	const ix = outerT,
		iy = outerT,
		iw = width - outerT * 2,
		ih = height - outerT * 2;

	/* base fill */
	ctx.fillStyle = rgb(FRAME_COLORS.gB);
	ctx.beginPath();
	ctx.rect(ox, oy, ow, oh);
	ctx.rect(ix, iy + ih, iw, -ih);
	ctx.fill('evenodd');

	/* top bevel highlight */
	polygon(ctx, [ox, oy, ox + ow, oy, ix + iw, iy, ix, iy], 'rgba(255,248,225,0.32)');

	/* left bevel highlight */
	polygon(ctx, [ox, oy, ix, iy, ix, iy + ih, ox, oy + oh], 'rgba(255,245,210,0.18)');

	/* right bevel shadow */
	polygon(ctx, [ox + ow, oy, ox + ow, oy + oh, ix + iw, iy + ih, ix + iw, iy], 'rgba(0,0,0,0.18)');

	/* bottom bevel shadow */
	polygon(ctx, [ox, oy + oh, ox + ow, oy + oh, ix + iw, iy + ih, ix, iy + ih], 'rgba(0,0,0,0.24)');

	/* gold grain lines along outer moulding */
	const grainStep = Math.max(3, Math.round(outerT * 0.22));
	ctx.strokeStyle = rgb(FRAME_COLORS.gA, 0.18);
	ctx.lineWidth = 0.5;
	for (let g = grainStep; g < outerT; g += grainStep) {
		/* top edge */
		ctx.beginPath();
		ctx.moveTo(g, g);
		ctx.lineTo(ow - g, g);
		ctx.stroke();
		/* bottom edge */
		ctx.beginPath();
		ctx.moveTo(g, oh - g);
		ctx.lineTo(ow - g, oh - g);
		ctx.stroke();
		/* left edge */
		ctx.beginPath();
		ctx.moveTo(g, g);
		ctx.lineTo(g, oh - g);
		ctx.stroke();
		/* right edge */
		ctx.beginPath();
		ctx.moveTo(ow - g, g);
		ctx.lineTo(ow - g, oh - g);
		ctx.stroke();
	}

	/* outer lip edge */
	ctx.strokeStyle = rgb(FRAME_COLORS.gD, 0.6);
	ctx.lineWidth = 1.5;
	ctx.strokeRect(0.5, 0.5, ow - 1, oh - 1);

	/* ── inner moulding ─────────────────────────────── */
	const imx = ix,
		imy = iy,
		imw = iw,
		imh = ih;
	const imix = ix + innerT,
		imiy = iy + innerT;
	const imiw = iw - innerT * 2,
		imih = ih - innerT * 2;

	/* base fill */
	ctx.fillStyle = rgb(FRAME_COLORS.gC);
	ctx.beginPath();
	ctx.rect(imx, imy, imw, imh);
	ctx.rect(imix, imiy + imih, imiw, -imih);
	ctx.fill('evenodd');

	/* inner top highlight */
	polygon(ctx, [imx, imy, imx + imw, imy, imix + imiw, imiy, imix, imiy], 'rgba(255,248,225,0.22)');

	/* inner bottom shadow */
	polygon(
		ctx,
		[imx, imy + imh, imx + imw, imy + imh, imix + imiw, imiy + imih, imix, imiy + imih],
		'rgba(0,0,0,0.20)'
	);

	/* inner right shadow */
	polygon(
		ctx,
		[imx + imw, imy, imx + imw, imy + imh, imix + imiw, imiy + imih, imix + imiw, imiy],
		'rgba(0,0,0,0.14)'
	);

	/* inner left highlight */
	polygon(ctx, [imx, imy, imix, imiy, imix, imiy + imih, imx, imy + imh], 'rgba(255,245,210,0.12)');

	/* dividing line between outer and inner moulding */
	ctx.strokeStyle = rgb(FRAME_COLORS.gD, 0.45);
	ctx.lineWidth = 1;
	ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);

	/* ── linen mat ──────────────────────────────────── */
	const mx = imix,
		my = imiy,
		mw = imiw,
		mh = imih;

	ctx.fillStyle = rgb(FRAME_COLORS.mat);
	ctx.beginPath();
	ctx.rect(mx, my, mw, mh);
	ctx.rect(opening.x, opening.y + opening.h, opening.w, -opening.h);
	ctx.fill('evenodd');

	/* mat inner shadow (top and left edges of opening) */
	const matShadowDepth = Math.max(2, Math.round(matT * 0.4));
	const matSG = ctx.createLinearGradient(
		opening.x,
		opening.y,
		opening.x,
		opening.y + matShadowDepth
	);
	matSG.addColorStop(0, rgb(FRAME_COLORS.matShadow, 0.6));
	matSG.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = matSG;
	ctx.fillRect(opening.x, opening.y, opening.w, matShadowDepth);

	const matSGL = ctx.createLinearGradient(
		opening.x,
		opening.y,
		opening.x + matShadowDepth,
		opening.y
	);
	matSGL.addColorStop(0, rgb(FRAME_COLORS.matShadow, 0.4));
	matSGL.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = matSGL;
	ctx.fillRect(opening.x, opening.y, matShadowDepth, opening.h);

	/* mat outer edge (against inner moulding) */
	ctx.strokeStyle = rgb(FRAME_COLORS.matShadow, 0.5);
	ctx.lineWidth = 0.5;
	ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);

	/* mat inner edge (against artwork) */
	ctx.strokeStyle = rgb(FRAME_COLORS.matShadow, 0.35);
	ctx.lineWidth = 1;
	ctx.strokeRect(opening.x - 0.5, opening.y - 0.5, opening.w + 1, opening.h + 1);

	/* ── corner ornaments ───────────────────────────── */
	if (cornerOrnaments && outerT >= 12) {
		const ornSize = Math.round(outerT * 0.6);
		const ornInset = Math.round(outerT * 0.5);
		const corners: Array<[number, number]> = [
			[ornInset, ornInset],
			[ow - ornInset, ornInset],
			[ow - ornInset, oh - ornInset],
			[ornInset, oh - ornInset]
		];

		for (const [cx, cy] of corners) {
			/* diamond rosette */
			const s = ornSize * 0.5;
			polygon(ctx, [cx, cy - s, cx + s, cy, cx, cy + s, cx - s, cy], rgb(FRAME_COLORS.gA, 0.35));
			/* inner diamond */
			const si = s * 0.5;
			polygon(ctx, [cx, cy - si, cx + si, cy, cx, cy + si, cx - si, cy], rgb(FRAME_COLORS.gD, 0.3));
			/* centre dot */
			ctx.fillStyle = rgb(FRAME_COLORS.gA, 0.5);
			ctx.beginPath();
			ctx.arc(cx, cy, Math.max(1.5, s * 0.18), 0, Math.PI * 2);
			ctx.fill();
		}
	}

	/* ── subtle noise on frame surfaces ─────────────── */
	const frameData = ctx.getImageData(0, 0, width, height);
	const fd = frameData.data;
	let frameSeed = 77341;
	const frameRng = () => {
		frameSeed = (frameSeed * 16807) % 2147483647;
		return (frameSeed & 0x7fffffff) / 2147483647;
	};

	for (let i = 0; i < fd.length; i += 4) {
		/* only apply noise to non-transparent pixels (frame surface) */
		if (fd[i + 3] > 0) {
			const noise = (frameRng() - 0.5) * 8;
			fd[i] = Math.max(0, Math.min(255, fd[i] + noise));
			fd[i + 1] = Math.max(0, Math.min(255, fd[i + 1] + noise));
			fd[i + 2] = Math.max(0, Math.min(255, fd[i + 2] + noise));
		}
	}

	ctx.putImageData(frameData, 0, 0);

	return opening;
}

/**
 * Apply weathering effects to an already-drawn frame.
 * Called internally by drawArtworkFrame when `aged` is set.
 */
export function applyFrameWeathering(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	outerT: number,
	innerT: number,
	matT: number,
	intensity: number
) {
	const totalFrame = outerT + innerT;
	let wSeed = 63491;
	const wRng = () => {
		wSeed = (wSeed * 16807) % 2147483647;
		return (wSeed & 0x7fffffff) / 2147483647;
	};

	/* ── 1. tarnish: desaturate and darken the gold ──── */
	const tarnishData = ctx.getImageData(0, 0, width, height);
	const td = tarnishData.data;
	const desatAmount = 0.25 * intensity;
	const darkenAmount = 18 * intensity;

	for (let i = 0; i < td.length; i += 4) {
		if (td[i + 3] === 0) continue;
		const r = td[i],
			g = td[i + 1],
			b = td[i + 2];
		const lum = 0.299 * r + 0.587 * g + 0.114 * b;
		td[i] = Math.max(0, Math.min(255, r + (lum - r) * desatAmount - darkenAmount));
		td[i + 1] = Math.max(0, Math.min(255, g + (lum - g) * desatAmount - darkenAmount));
		td[i + 2] = Math.max(0, Math.min(255, b + (lum - b) * desatAmount - darkenAmount));
	}

	ctx.putImageData(tarnishData, 0, 0);

	/* ── 2. verdigris spots (green-blue oxidation) ───── */
	const verdigrisCount = Math.round(8 + 18 * intensity);
	for (let v = 0; v < verdigrisCount; v++) {
		/* place spots along the frame moulding area */
		const side = Math.floor(wRng() * 4); /* 0=top, 1=right, 2=bottom, 3=left */
		let vx: number, vy: number;
		const margin = totalFrame * 0.2;

		if (side === 0) {
			vx = margin + wRng() * (width - margin * 2);
			vy = margin + wRng() * (outerT - margin);
		} else if (side === 1) {
			vx = width - outerT + margin + wRng() * (outerT - margin * 2);
			vy = margin + wRng() * (height - margin * 2);
		} else if (side === 2) {
			vx = margin + wRng() * (width - margin * 2);
			vy = height - outerT + margin + wRng() * (outerT - margin * 2);
		} else {
			vx = margin + wRng() * (outerT - margin);
			vy = margin + wRng() * (height - margin * 2);
		}

		const vr = 3 + wRng() * 8 * intensity;
		const va = 0.08 + wRng() * 0.14 * intensity;

		/* verdigris is a blue-green: hue ~160-180 */
		const gr = Math.round(60 + wRng() * 30);
		const gg = Math.round(120 + wRng() * 50);
		const gb = Math.round(100 + wRng() * 40);

		ctx.fillStyle = `rgba(${gr},${gg},${gb},${va})`;
		ctx.beginPath();
		ctx.ellipse(vx, vy, vr, vr * (0.6 + wRng() * 0.8), wRng() * Math.PI, 0, Math.PI * 2);
		ctx.fill();

		/* secondary smaller blotch nearby */
		if (wRng() > 0.4) {
			ctx.fillStyle = `rgba(${gr - 10},${gg + 10},${gb + 15},${va * 0.7})`;
			ctx.beginPath();
			ctx.ellipse(
				vx + (wRng() - 0.5) * vr * 2,
				vy + (wRng() - 0.5) * vr * 2,
				vr * 0.5,
				vr * 0.4,
				wRng() * Math.PI,
				0,
				Math.PI * 2
			);
			ctx.fill();
		}
	}

	/* ── 3. chipped edges (exposed dark base) ────────── */
	const chipCount = Math.round(6 + 14 * intensity);
	for (let c = 0; c < chipCount; c++) {
		const edge = Math.floor(wRng() * 4);
		let cx: number, cy: number;

		if (edge === 0) {
			cx = 4 + wRng() * (width - 8);
			cy = 1 + wRng() * 3;
		} else if (edge === 1) {
			cx = width - 1 - wRng() * 3;
			cy = 4 + wRng() * (height - 8);
		} else if (edge === 2) {
			cx = 4 + wRng() * (width - 8);
			cy = height - 1 - wRng() * 3;
		} else {
			cx = 1 + wRng() * 3;
			cy = 4 + wRng() * (height - 8);
		}

		const chipW = 2 + wRng() * 5 * intensity;
		const chipH = 1 + wRng() * 3 * intensity;
		const chipAlpha = 0.3 + wRng() * 0.4 * intensity;

		ctx.fillStyle = `rgba(48,36,18,${chipAlpha})`;
		ctx.beginPath();
		ctx.ellipse(cx, cy, chipW, chipH, wRng() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}

	/* ── 4. dust accumulation (warm veil, heavier at bottom) */
	const dustG = ctx.createLinearGradient(0, 0, 0, height);
	const dustAlpha = 0.04 + 0.08 * intensity;
	dustG.addColorStop(0, `rgba(180,160,120,${dustAlpha * 0.3})`);
	dustG.addColorStop(0.6, `rgba(180,160,120,${dustAlpha * 0.5})`);
	dustG.addColorStop(1, `rgba(160,140,100,${dustAlpha})`);
	ctx.fillStyle = dustG;

	/* apply only to frame area (not the transparent opening) */
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, width, height);
	const openX = outerT + innerT + matT;
	const openY = openX;
	const openW = width - openX * 2;
	const openH = height - openY * 2;
	ctx.rect(openX, openY + openH, openW, -openH);
	ctx.clip('evenodd');
	ctx.fillRect(0, 0, width, height);
	ctx.restore();

	/* ── 5. age stains on mat ──────────────────────── */
	const stainCount = Math.round(2 + 5 * intensity);
	const matInnerX = outerT + innerT;
	const matInnerY = matInnerX;
	const matAreaW = width - matInnerX * 2;
	const matAreaH = height - matInnerY * 2;

	for (let s = 0; s < stainCount; s++) {
		const sx = matInnerX + wRng() * matAreaW;
		const sy = matInnerY + wRng() * matAreaH;
		const sr = 4 + wRng() * 12 * intensity;
		const sa = 0.04 + wRng() * 0.08 * intensity;

		ctx.fillStyle = `rgba(160,140,100,${sa})`;
		ctx.beginPath();
		ctx.ellipse(sx, sy, sr, sr * (0.5 + wRng() * 0.8), wRng() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}

	/* ── 6. heavier noise pass for aged texture ────── */
	const agedData = ctx.getImageData(0, 0, width, height);
	const ad = agedData.data;
	const noiseAmp = 6 + 10 * intensity;

	for (let i = 0; i < ad.length; i += 4) {
		if (ad[i + 3] === 0) continue;
		const noise = (wRng() - 0.5) * noiseAmp;
		ad[i] = Math.max(0, Math.min(255, ad[i] + noise));
		ad[i + 1] = Math.max(0, Math.min(255, ad[i + 1] + noise));
		ad[i + 2] = Math.max(0, Math.min(255, ad[i + 2] + noise));
	}

	ctx.putImageData(agedData, 0, 0);
}

/**
 * Create a data URL of a gilded frame for a given artwork size.
 *
 * @param artworkWidth  Width of the artwork image in pixels
 * @param artworkHeight Height of the artwork image in pixels
 * @param options       Frame options (see ArtworkFrameOptions)
 * @returns { url, opening } — the frame image data URL and the inner opening rect
 */
export function createArtworkFrameUrl(
	artworkWidth: number,
	artworkHeight: number,
	options: ArtworkFrameOptions = {}
): { url: string; opening: { x: number; y: number; w: number; h: number } } {
	const { mouldingRatio = 0.08, innerMouldingRatio = 0.4, matRatio = 0.35 } = options;
	const shorter = Math.min(artworkWidth, artworkHeight);
	const outerT = Math.round(shorter * mouldingRatio);
	const innerT = Math.round(outerT * innerMouldingRatio);
	const matT = Math.round(outerT * matRatio);
	const totalT = outerT + innerT + matT;

	const canvasW = artworkWidth + totalT * 2;
	const canvasH = artworkHeight + totalT * 2;

	const canvas = document.createElement('canvas');
	canvas.width = canvasW;
	canvas.height = canvasH;

	const ctx = getFrequentReadCanvasContext(canvas);
	if (!ctx) {
		return { url: '', opening: { x: totalT, y: totalT, w: artworkWidth, h: artworkHeight } };
	}

	const opening = drawArtworkFrame(ctx, canvasW, canvasH, options);

	return { url: canvas.toDataURL('image/png'), opening };
}

/* ══════════════════════════════════════════════════════════ *
 *  Sticker / tape-label button background                    *
 * ══════════════════════════════════════════════════════════ */

export type StickerVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

export interface StickerBackgroundOptions {
	variant?: StickerVariant;
}

const STICKER_COLORS = {
	ink: [47, 36, 28] as Rgb,
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

/** Apply per-pixel luminance noise to existing canvas content. */
function applyNoise(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	amplitude = 4,
	seed = 77341
) {
	const rng = makeRng(seed);
	const imageData = ctx.getImageData(0, 0, w, h);
	const d = imageData.data;

	for (let i = 0; i < d.length; i += 4) {
		if (d[i + 3] > 0) {
			const n = (rng() - 0.5) * amplitude;
			d[i] = Math.max(0, Math.min(255, d[i] + n));
			d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
			d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
		}
	}

	ctx.putImageData(imageData, 0, 0);
}

/** Scatter small paint-stain ellipses over the canvas area. */
function drawPaintStains(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	count: number,
	seed = 12345
) {
	const rng = makeRng(seed);

	for (let i = 0; i < count; i++) {
		const c = PAINT_STAIN_COLORS[Math.floor(rng() * PAINT_STAIN_COLORS.length)];
		const cx = rng() * w;
		const cy = rng() * h;
		const r = 2 + rng() * 8;
		const a = 0.06 + rng() * 0.1;

		ctx.fillStyle = rgb(c, a);
		ctx.beginPath();
		ctx.ellipse(cx, cy, r, r * (0.5 + rng() * 0.7), rng() * Math.PI, 0, Math.PI * 2);
		ctx.fill();

		/* drip / satellite drop */
		if (rng() > 0.5) {
			const dx = cx + (rng() - 0.5) * r * 3;
			const dy = cy + rng() * r * 2;
			ctx.fillStyle = rgb(c, a * 0.6);
			ctx.beginPath();
			ctx.ellipse(dx, dy, r * 0.25, r * 0.4, rng() * Math.PI, 0, Math.PI * 2);
			ctx.fill();
		}

		/* micro-splatter */
		if (rng() > 0.6) {
			for (let s = 0; s < 2; s++) {
				const sx = cx + (rng() - 0.5) * r * 4;
				const sy = cy + (rng() - 0.5) * r * 4;
				ctx.fillStyle = rgb(c, a * 0.4);
				ctx.beginPath();
				ctx.arc(sx, sy, 0.5 + rng(), 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

/** Trace a rounded-rectangle sub-path (does beginPath + closePath). */
function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

/**
 * Draw a sticker / tape-label background onto a canvas.
 *
 * Renders the paper body, colour band, masking-tape strips at corners,
 * torn paper edges, paint stains, an optional coffee-ring mark, and
 * per-pixel noise.  Text and icons are overlaid as HTML — this function
 * draws only the visual background.
 *
 * Output is deterministic for a given (w, h, variant) triple.
 */
export function drawStickerBackground(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	options: StickerBackgroundOptions = {}
) {
	const { variant = 'primary' } = options;
	const bandColor = variant === 'ghost' ? STICKER_COLORS.paper : STICKER_COLORS[variant];
	const tapeColor = STICKER_TAPE_TINTS[variant];
	const rng = makeRng(99887 + w * 7 + h * 13 + (variant.charCodeAt(0) || 0) * 31);

	ctx.clearRect(0, 0, w, h);

	/* ── shadow as if slightly lifted from wall ─────── */
	ctx.save();
	ctx.shadowColor = 'rgba(47,36,28,0.12)';
	ctx.shadowOffsetX = 1;
	ctx.shadowOffsetY = 3;
	ctx.shadowBlur = 6;
	ctx.fillStyle = 'rgba(0,0,0,0)';
	ctx.fillRect(3, 3, w - 6, h - 6);
	ctx.restore();

	/* ── paper body ─────────────────────────────────── */
	roundRect(ctx, 2, 2, w - 4, h - 4, 2);
	ctx.fillStyle = rgb(STICKER_COLORS.paper);
	ctx.fill();

	/* ── colour band ────────────────────────────────── */
	const bandM = Math.round(h * 0.1);
	roundRect(ctx, 2 + bandM, 2 + bandM, w - 4 - bandM * 2, h - 4 - bandM * 2, 1);
	ctx.fillStyle = rgb(bandColor, 0.82);
	ctx.fill();

	/* highlight across top of colour band */
	ctx.save();
	roundRect(ctx, 2 + bandM, 2 + bandM, w - 4 - bandM * 2, h - 4 - bandM * 2, 1);
	ctx.clip();
	const hiGrad = ctx.createLinearGradient(0, bandM, 0, h * 0.42);
	hiGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
	hiGrad.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = hiGrad;
	ctx.fillRect(2 + bandM, 2 + bandM, w - 4 - bandM * 2, h * 0.3);
	ctx.restore();

	/* subtle bottom darkening */
	ctx.save();
	roundRect(ctx, 2 + bandM, 2 + bandM, w - 4 - bandM * 2, h - 4 - bandM * 2, 1);
	ctx.clip();
	const loGrad = ctx.createLinearGradient(0, h * 0.7, 0, h - bandM);
	loGrad.addColorStop(0, 'rgba(0,0,0,0)');
	loGrad.addColorStop(1, 'rgba(0,0,0,0.06)');
	ctx.fillStyle = loGrad;
	ctx.fillRect(2 + bandM, h * 0.7, w - 4 - bandM * 2, h * 0.3);
	ctx.restore();

	/* ── torn / rough paper edges ───────────────────── */
	ctx.fillStyle = rgb(STICKER_COLORS.paper);
	for (let x = 6; x < w - 6; x += 4 + rng() * 6) {
		if (rng() > 0.6) {
			const sz = 1 + rng() * 2;
			ctx.fillRect(x, 1, sz, 1 + rng());
			ctx.fillRect(x, h - 2 - rng(), sz, 1 + rng());
		}
	}
	for (let y = 6; y < h - 6; y += 4 + rng() * 6) {
		if (rng() > 0.7) {
			const sz = 1 + rng() * 1.5;
			ctx.fillRect(1, y, 1 + rng(), sz);
			ctx.fillRect(w - 2 - rng(), y, 1 + rng(), sz);
		}
	}

	/* ── tape strip — top-left corner ───────────────── */
	const tapeW = Math.round(Math.max(16, w * 0.12));
	const tapeH = Math.round(Math.max(20, h * 0.35));

	ctx.save();
	ctx.translate(6, 5);
	ctx.rotate(-0.12 - rng() * 0.1);
	ctx.fillStyle = rgb(tapeColor, 0.4 + rng() * 0.12);
	ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
	ctx.strokeStyle = 'rgba(0,0,0,0.05)';
	ctx.lineWidth = 0.5;
	ctx.strokeRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
	/* tape wrinkle */
	ctx.strokeStyle = 'rgba(255,255,255,0.12)';
	ctx.beginPath();
	ctx.moveTo(-tapeW / 2 + 2, -tapeH * 0.1);
	ctx.lineTo(tapeW / 2 - 2, tapeH * 0.05);
	ctx.stroke();
	ctx.restore();

	/* ── tape strip — bottom-right corner ───────────── */
	ctx.save();
	ctx.translate(w - 6, h - 5);
	ctx.rotate(0.1 + rng() * 0.12);
	ctx.fillStyle = rgb(tapeColor, 0.38 + rng() * 0.12);
	ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
	ctx.strokeStyle = 'rgba(0,0,0,0.05)';
	ctx.lineWidth = 0.5;
	ctx.strokeRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
	ctx.strokeStyle = 'rgba(255,255,255,0.10)';
	ctx.beginPath();
	ctx.moveTo(-tapeW / 2 + 2, tapeH * 0.08);
	ctx.lineTo(tapeW / 2 - 2, -tapeH * 0.06);
	ctx.stroke();
	ctx.restore();

	/* ── paint stains ───────────────────────────────── */
	drawPaintStains(ctx, w, h, 3, 45612 + w * 3 + h * 7);

	/* ── coffee ring stain (random chance) ──────────── */
	if (rng() > 0.35) {
		const cx = w * 0.55 + rng() * w * 0.3;
		const cy = h * 0.25 + rng() * h * 0.5;
		const cr = 5 + rng() * 7;
		ctx.strokeStyle = 'rgba(140,110,70,0.06)';
		ctx.lineWidth = 1.2 + rng() * 0.8;
		ctx.beginPath();
		ctx.arc(cx, cy, cr, rng() * 0.5, Math.PI * 2 - rng() * 0.3);
		ctx.stroke();
	}

	/* ── per-pixel noise ────────────────────────────── */
	applyNoise(ctx, w, h, 4, 12211 + w);
}

/**
 * Create a data URL of a sticker background for use as a CSS
 * `background-image`.
 *
 * @param width   Canvas width in pixels
 * @param height  Canvas height in pixels
 * @param options Sticker variant and future options
 * @returns A `data:image/png;base64,…` string
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
