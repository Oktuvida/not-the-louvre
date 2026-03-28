const WINDOW_CANVAS_WIDTH = 720;
const WINDOW_CANVAS_HEIGHT = 640;
const WALL_TILE_WIDTH = 512;
const WALL_TILE_HEIGHT = 512;
let cachedMuseumWallPatternUrl: string | null = null;

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

export function createMuseumWallPatternUrl() {
	if (cachedMuseumWallPatternUrl) {
		return cachedMuseumWallPatternUrl;
	}

	const canvas = document.createElement('canvas');
	canvas.width = WALL_TILE_WIDTH;
	canvas.height = WALL_TILE_HEIGHT;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return '';
	}

	let seed = 91827;
	const rng = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed & 0x7fffffff) / 2147483647;
	};

	const line = (x1: number, y1: number, x2: number, y2: number, color: string, width: number) => {
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	};

	ctx.fillStyle = rgb(WINDOW_COLORS.sD, 0.45);
	ctx.fillRect(0, 0, WALL_TILE_WIDTH, WALL_TILE_HEIGHT);

	const ROW_HEIGHTS = [68, 60, 72, 56];
	const MORTAR = 3;
	const BW = 128;
	const rows: Array<{ y: number; h: number; idx: number }> = [];
	let y = 0;
	let rowIdx = 0;

	while (y < WALL_TILE_HEIGHT) {
		const h = ROW_HEIGHTS[rowIdx % ROW_HEIGHTS.length];
		rows.push({ y, h, idx: rowIdx });
		y += h;
		rowIdx += 1;
	}

	const stoneBlock = (bx: number, by: number, bw: number, bh: number, variation: number) => {
		const draws: Array<[number, number]> = [[bx, by]];
		if (bx < 0) draws.push([bx + WALL_TILE_WIDTH, by]);
		if (bx + bw > WALL_TILE_WIDTH) draws.push([bx - WALL_TILE_WIDTH, by]);
		if (by < 0) draws.push([bx, by + WALL_TILE_HEIGHT]);
		if (by + bh > WALL_TILE_HEIGHT) draws.push([bx, by - WALL_TILE_HEIGHT]);
		if (bx < 0 && by < 0) draws.push([bx + WALL_TILE_WIDTH, by + WALL_TILE_HEIGHT]);
		if (bx + bw > WALL_TILE_WIDTH && by + bh > WALL_TILE_HEIGHT)
			draws.push([bx - WALL_TILE_WIDTH, by - WALL_TILE_HEIGHT]);
		if (bx < 0 && by + bh > WALL_TILE_HEIGHT)
			draws.push([bx + WALL_TILE_WIDTH, by - WALL_TILE_HEIGHT]);
		if (bx + bw > WALL_TILE_WIDTH && by < 0)
			draws.push([bx - WALL_TILE_WIDTH, by + WALL_TILE_HEIGHT]);

		for (const [x, drawY] of draws) {
			if (
				x + bw < -2 ||
				x > WALL_TILE_WIDTH + 2 ||
				drawY + bh < -2 ||
				drawY > WALL_TILE_HEIGHT + 2
			) {
				continue;
			}

			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, WALL_TILE_WIDTH, WALL_TILE_HEIGHT);
			ctx.clip();

			const n = 0.92 + variation * 0.16;
			const [r, g, b] = WINDOW_COLORS.sA;
			ctx.fillStyle = `rgb(${Math.trunc(r * n)},${Math.trunc(g * n)},${Math.trunc(b * n)})`;
			ctx.fillRect(x, drawY, bw, bh);

			const bev = 6;
			polygon(
				ctx,
				[x, drawY, x + bw, drawY, x + bw - bev, drawY + bev + 2, x + bev, drawY + bev + 2],
				'rgba(255,248,225,0.18)'
			);
			polygon(
				ctx,
				[
					x + bw,
					drawY,
					x + bw,
					drawY + bh,
					x + bw - bev,
					drawY + bh - bev,
					x + bw - bev,
					drawY + bev + 2
				],
				'rgba(0,0,0,0.10)'
			);
			polygon(
				ctx,
				[
					x,
					drawY + bh,
					x + bw,
					drawY + bh,
					x + bw - bev,
					drawY + bh - bev,
					x + bev,
					drawY + bh - bev
				],
				'rgba(0,0,0,0.14)'
			);
			polygon(
				ctx,
				[x, drawY, x + bev, drawY + bev + 2, x + bev, drawY + bh - bev, x, drawY + bh],
				'rgba(255,248,225,0.06)'
			);

			const crackCount = 1 + (rng() > 0.6 ? 1 : 0);
			for (let crackIndex = 0; crackIndex < crackCount; crackIndex += 1) {
				const cx1 = x + bev + rng() * (bw - bev * 3);
				const cy1 = drawY + bev + rng() * (bh - bev * 3);
				const cx2 = cx1 + (rng() - 0.5) * 28;
				const cy2 = cy1 + (rng() - 0.5) * 18;
				ctx.strokeStyle = `rgba(${WINDOW_COLORS.sD[0]},${WINDOW_COLORS.sD[1]},${WINDOW_COLORS.sD[2]},${0.12 + rng() * 0.1})`;
				ctx.lineWidth = 0.5 + rng() * 0.8;
				ctx.beginPath();
				ctx.moveTo(cx1, cy1);
				ctx.lineTo(cx2, cy2);
				ctx.stroke();
			}

			if (rng() > 0.72) {
				const sx = x + bev + rng() * (bw - bev * 4);
				const sy = drawY + bev + rng() * (bh - bev * 4);
				const sw = 12 + rng() * 22;
				const sh = 8 + rng() * 14;
				ctx.fillStyle = `rgba(${WINDOW_COLORS.sC[0]},${WINDOW_COLORS.sC[1]},${WINDOW_COLORS.sC[2]},${0.1 + rng() * 0.1})`;
				ctx.beginPath();
				ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, rng() * Math.PI, 0, Math.PI * 2);
				ctx.fill();
			}

			ctx.restore();
		}
	};

	for (const row of rows) {
		const offset = row.idx % 2 === 0 ? 0 : BW * 0.5;

		for (let col = -1; col <= Math.ceil(WALL_TILE_WIDTH / BW) + 1; col += 1) {
			const wVar = 0.94 + rng() * 0.12;
			const bw = Math.round(BW * wVar);
			const bx = col * BW + offset - (bw - BW) / 2;
			const bh = row.h - MORTAR;
			stoneBlock(bx, row.y, bw, bh, rng());
		}
	}

	for (const row of rows) {
		const jy = row.y + row.h - MORTAR;
		line(0, jy, WALL_TILE_WIDTH, jy, rgb(WINDOW_COLORS.sD, 0.35), MORTAR);
		line(0, jy - 0.5, WALL_TILE_WIDTH, jy - 0.5, 'rgba(255,248,225,0.08)', 0.5);
		line(0, jy + MORTAR, WALL_TILE_WIDTH, jy + MORTAR, 'rgba(0,0,0,0.06)', 1);
	}

	const imageData = ctx.getImageData(0, 0, WALL_TILE_WIDTH, WALL_TILE_HEIGHT);
	const data = imageData.data;
	seed = 44219;
	for (let index = 0; index < data.length; index += 4) {
		const noise = (rng() - 0.5) * 12;
		data[index] = Math.max(0, Math.min(255, data[index] + noise));
		data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + noise));
		data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + noise));
	}
	ctx.putImageData(imageData, 0, 0);

	cachedMuseumWallPatternUrl = canvas.toDataURL('image/png');
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

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return { url: '', opening: { x: totalT, y: totalT, w: artworkWidth, h: artworkHeight } };
	}

	const opening = drawArtworkFrame(ctx, canvasW, canvasH, options);

	return { url: canvas.toDataURL('image/png'), opening };
}
