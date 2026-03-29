import type { ArtworkFrameRenderOptions } from '$lib/features/artwork-presentation/model/frame';

type Rgb = [number, number, number];

const MAT_COLORS = {
	mat: [253, 251, 247] as Rgb,
	matShadow: [218, 210, 196] as Rgb
};

const COLOR_SCHEMES = {
	bronze: {
		gA: [212, 160, 106] as Rgb,
		gB: [205, 127, 50] as Rgb,
		gC: [160, 98, 46] as Rgb,
		gD: [122, 74, 26] as Rgb,
		...MAT_COLORS
	},
	gold: {
		gA: [212, 168, 64] as Rgb,
		gB: [192, 146, 42] as Rgb,
		gC: [142, 104, 32] as Rgb,
		gD: [98, 72, 22] as Rgb,
		...MAT_COLORS
	},
	silver: {
		gA: [216, 216, 216] as Rgb,
		gB: [192, 192, 192] as Rgb,
		gC: [144, 144, 144] as Rgb,
		gD: [96, 96, 96] as Rgb,
		...MAT_COLORS
	}
} satisfies Record<NonNullable<ArtworkFrameRenderOptions['colorScheme']>, Record<string, Rgb>>;

const rgb = (color: Rgb, alpha = 1) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;

const polygon = (ctx: CanvasRenderingContext2D, points: number[], fill: string) => {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.moveTo(points[0]!, points[1]!);

	for (let index = 2; index < points.length; index += 2) {
		ctx.lineTo(points[index]!, points[index + 1]!);
	}

	ctx.closePath();
	ctx.fill();
};

const normalizeOptions = (options: ArtworkFrameRenderOptions = {}) => ({
	aged: options.aged ?? false,
	castShadow: options.castShadow ?? true,
	colorScheme: options.colorScheme ?? 'gold',
	cornerOrnaments: options.cornerOrnaments ?? true,
	innerMouldingRatio: options.innerMouldingRatio ?? 0.4,
	matRatio: options.matRatio ?? 0.35,
	mouldingRatio: options.mouldingRatio ?? 0.08
});

export const getArtworkFrameOpening = (
	width: number,
	height: number,
	options: ArtworkFrameRenderOptions = {}
) => {
	const normalized = normalizeOptions(options);
	const shorter = Math.min(width, height);
	const outerThickness = Math.round(shorter * normalized.mouldingRatio);
	const innerThickness = Math.round(outerThickness * normalized.innerMouldingRatio);
	const matThickness = Math.round(outerThickness * normalized.matRatio);
	const totalThickness = outerThickness + innerThickness + matThickness;

	return {
		h: height - totalThickness * 2,
		w: width - totalThickness * 2,
		x: totalThickness,
		y: totalThickness
	};
};

export function drawArtworkFrame(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	options: ArtworkFrameRenderOptions = {}
) {
	const normalized = normalizeOptions(options);
	const colors = COLOR_SCHEMES[normalized.colorScheme];
	const agingIntensity =
		normalized.aged === true
			? 0.5
			: normalized.aged === false
				? 0
				: Math.max(0, Math.min(1, normalized.aged));
	const shorter = Math.min(width, height);
	const outerThickness = Math.round(shorter * normalized.mouldingRatio);
	const innerThickness = Math.round(outerThickness * normalized.innerMouldingRatio);
	const matThickness = Math.round(outerThickness * normalized.matRatio);
	const opening = getArtworkFrameOpening(width, height, normalized);

	ctx.clearRect(0, 0, width, height);

	if (normalized.castShadow) {
		const shadowOffset = Math.round(shorter * 0.02);
		const shadowBlur = Math.round(shorter * 0.04);
		ctx.save();
		ctx.shadowColor = 'rgba(30,20,10,0.35)';
		ctx.shadowOffsetX = shadowOffset;
		ctx.shadowOffsetY = shadowOffset;
		ctx.shadowBlur = shadowBlur;
		ctx.fillStyle = 'rgba(0,0,0,0)';
		ctx.beginPath();
		ctx.rect(0, 0, width, height);
		ctx.rect(opening.x, opening.y + opening.h, opening.w, -opening.h);
		ctx.fill('evenodd');
		ctx.restore();
	}

	const outerX = 0;
	const outerY = 0;
	const outerWidth = width;
	const outerHeight = height;
	const innerX = outerThickness;
	const innerY = outerThickness;
	const innerWidth = width - outerThickness * 2;
	const innerHeight = height - outerThickness * 2;

	ctx.fillStyle = rgb(colors.gB);
	ctx.beginPath();
	ctx.rect(outerX, outerY, outerWidth, outerHeight);
	ctx.rect(innerX, innerY + innerHeight, innerWidth, -innerHeight);
	ctx.fill('evenodd');
	polygon(
		ctx,
		[outerX, outerY, outerX + outerWidth, outerY, innerX + innerWidth, innerY, innerX, innerY],
		'rgba(255,248,225,0.32)'
	);
	polygon(
		ctx,
		[outerX, outerY, innerX, innerY, innerX, innerY + innerHeight, outerX, outerY + outerHeight],
		'rgba(255,245,210,0.18)'
	);
	polygon(
		ctx,
		[
			outerX + outerWidth,
			outerY,
			outerX + outerWidth,
			outerY + outerHeight,
			innerX + innerWidth,
			innerY + innerHeight,
			innerX + innerWidth,
			innerY
		],
		'rgba(0,0,0,0.18)'
	);
	polygon(
		ctx,
		[
			outerX,
			outerY + outerHeight,
			outerX + outerWidth,
			outerY + outerHeight,
			innerX + innerWidth,
			innerY + innerHeight,
			innerX,
			innerY + innerHeight
		],
		'rgba(0,0,0,0.24)'
	);
	const grooveSpacing = Math.max(3, Math.round(outerThickness * 0.22));
	ctx.strokeStyle = rgb(colors.gA, 0.18);
	ctx.lineWidth = 0.5;

	for (let groove = grooveSpacing; groove < outerThickness; groove += grooveSpacing) {
		ctx.beginPath();
		ctx.moveTo(groove, groove);
		ctx.lineTo(outerWidth - groove, groove);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(groove, outerHeight - groove);
		ctx.lineTo(outerWidth - groove, outerHeight - groove);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(groove, groove);
		ctx.lineTo(groove, outerHeight - groove);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(outerWidth - groove, groove);
		ctx.lineTo(outerWidth - groove, outerHeight - groove);
		ctx.stroke();
	}

	ctx.strokeStyle = rgb(colors.gD, 0.6);
	ctx.lineWidth = 1.5;
	ctx.strokeRect(0.5, 0.5, outerWidth - 1, outerHeight - 1);

	const innerMouldingX = innerX;
	const innerMouldingY = innerY;
	const innerMouldingWidth = innerWidth;
	const innerMouldingHeight = innerHeight;
	const matX = innerX + innerThickness;
	const matY = innerY + innerThickness;
	const matWidth = innerWidth - innerThickness * 2;
	const matHeight = innerHeight - innerThickness * 2;

	ctx.fillStyle = rgb(colors.gC);
	ctx.beginPath();
	ctx.rect(innerMouldingX, innerMouldingY, innerMouldingWidth, innerMouldingHeight);
	ctx.rect(matX, matY + matHeight, matWidth, -matHeight);
	ctx.fill('evenodd');
	polygon(
		ctx,
		[
			innerMouldingX,
			innerMouldingY,
			innerMouldingX + innerMouldingWidth,
			innerMouldingY,
			matX + matWidth,
			matY,
			matX,
			matY
		],
		'rgba(255,248,225,0.22)'
	);
	polygon(
		ctx,
		[
			innerMouldingX,
			innerMouldingY + innerMouldingHeight,
			innerMouldingX + innerMouldingWidth,
			innerMouldingY + innerMouldingHeight,
			matX + matWidth,
			matY + matHeight,
			matX,
			matY + matHeight
		],
		'rgba(0,0,0,0.20)'
	);
	polygon(
		ctx,
		[
			innerMouldingX + innerMouldingWidth,
			innerMouldingY,
			innerMouldingX + innerMouldingWidth,
			innerMouldingY + innerMouldingHeight,
			matX + matWidth,
			matY + matHeight,
			matX + matWidth,
			matY
		],
		'rgba(0,0,0,0.14)'
	);
	polygon(
		ctx,
		[
			innerMouldingX,
			innerMouldingY,
			matX,
			matY,
			matX,
			matY + matHeight,
			innerMouldingX,
			innerMouldingY + innerMouldingHeight
		],
		'rgba(255,245,210,0.12)'
	);
	ctx.strokeStyle = rgb(colors.gD, 0.45);
	ctx.lineWidth = 1;
	ctx.strokeRect(innerX + 0.5, innerY + 0.5, innerWidth - 1, innerHeight - 1);

	ctx.fillStyle = rgb(colors.mat);
	ctx.beginPath();
	ctx.rect(matX, matY, matWidth, matHeight);
	ctx.rect(opening.x, opening.y + opening.h, opening.w, -opening.h);
	ctx.fill('evenodd');
	const matShadowDepth = Math.max(2, Math.round(matThickness * 0.4));
	const matShadowGradient = ctx.createLinearGradient(
		opening.x,
		opening.y,
		opening.x,
		opening.y + matShadowDepth
	);
	matShadowGradient.addColorStop(0, rgb(colors.matShadow, 0.6));
	matShadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = matShadowGradient;
	ctx.fillRect(opening.x, opening.y, opening.w, matShadowDepth);
	const matLeftGradient = ctx.createLinearGradient(
		opening.x,
		opening.y,
		opening.x + matShadowDepth,
		opening.y
	);
	matLeftGradient.addColorStop(0, rgb(colors.matShadow, 0.4));
	matLeftGradient.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = matLeftGradient;
	ctx.fillRect(opening.x, opening.y, matShadowDepth, opening.h);
	ctx.strokeStyle = rgb(colors.matShadow, 0.5);
	ctx.lineWidth = 0.5;
	ctx.strokeRect(matX + 0.5, matY + 0.5, matWidth - 1, matHeight - 1);
	ctx.strokeStyle = rgb(colors.matShadow, 0.35);
	ctx.lineWidth = 1;
	ctx.strokeRect(opening.x - 0.5, opening.y - 0.5, opening.w + 1, opening.h + 1);

	if (normalized.cornerOrnaments && outerThickness >= 12) {
		const ornamentSize = Math.round(outerThickness * 0.6);
		const ornamentInset = Math.round(outerThickness * 0.5);
		const corners = [
			[ornamentInset, ornamentInset],
			[outerWidth - ornamentInset, ornamentInset],
			[outerWidth - ornamentInset, outerHeight - ornamentInset],
			[ornamentInset, outerHeight - ornamentInset]
		] as const;

		for (const [centerX, centerY] of corners) {
			const size = ornamentSize * 0.5;
			polygon(
				ctx,
				[
					centerX,
					centerY - size,
					centerX + size,
					centerY,
					centerX,
					centerY + size,
					centerX - size,
					centerY
				],
				rgb(colors.gA, 0.35)
			);
			const innerSize = size * 0.5;
			polygon(
				ctx,
				[
					centerX,
					centerY - innerSize,
					centerX + innerSize,
					centerY,
					centerX,
					centerY + innerSize,
					centerX - innerSize,
					centerY
				],
				rgb(colors.gD, 0.3)
			);
			ctx.fillStyle = rgb(colors.gA, 0.5);
			ctx.beginPath();
			ctx.arc(centerX, centerY, Math.max(1.5, size * 0.18), 0, Math.PI * 2);
			ctx.fill();
		}
	}

	const frameData = ctx.getImageData(0, 0, width, height);
	const pixels = frameData.data;
	let seed = 77341;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed & 0x7fffffff) / 2147483647;
	};

	for (let index = 0; index < pixels.length; index += 4) {
		if (pixels[index + 3]! > 0) {
			const noise = (random() - 0.5) * 8;
			pixels[index] = Math.max(0, Math.min(255, pixels[index]! + noise));
			pixels[index + 1] = Math.max(0, Math.min(255, pixels[index + 1]! + noise));
			pixels[index + 2] = Math.max(0, Math.min(255, pixels[index + 2]! + noise));
		}
	}

	ctx.putImageData(frameData, 0, 0);

	if (agingIntensity > 0) {
		applyFrameWeathering(
			ctx,
			width,
			height,
			outerThickness,
			innerThickness,
			matThickness,
			agingIntensity
		);
	}

	return opening;
}

function applyFrameWeathering(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	outerThickness: number,
	innerThickness: number,
	matThickness: number,
	intensity: number
) {
	const totalFrame = outerThickness + innerThickness;
	let weatherSeed = 63491;
	const weatherRandom = () => {
		weatherSeed = (weatherSeed * 16807) % 2147483647;
		return (weatherSeed & 0x7fffffff) / 2147483647;
	};

	const tarnishData = ctx.getImageData(0, 0, width, height);
	const tarnishPixels = tarnishData.data;
	const desaturate = 0.25 * intensity;
	const darken = 18 * intensity;

	for (let index = 0; index < tarnishPixels.length; index += 4) {
		if (tarnishPixels[index + 3] === 0) continue;

		const red = tarnishPixels[index]!;
		const green = tarnishPixels[index + 1]!;
		const blue = tarnishPixels[index + 2]!;
		const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
		tarnishPixels[index] = Math.max(
			0,
			Math.min(255, red + (luminance - red) * desaturate - darken)
		);
		tarnishPixels[index + 1] = Math.max(
			0,
			Math.min(255, green + (luminance - green) * desaturate - darken)
		);
		tarnishPixels[index + 2] = Math.max(
			0,
			Math.min(255, blue + (luminance - blue) * desaturate - darken)
		);
	}

	ctx.putImageData(tarnishData, 0, 0);

	const verdigrisCount = Math.round(8 + 18 * intensity);

	for (let verdigris = 0; verdigris < verdigrisCount; verdigris += 1) {
		const side = Math.floor(weatherRandom() * 4);
		const margin = totalFrame * 0.2;
		let x: number;
		let y: number;

		if (side === 0) {
			x = margin + weatherRandom() * (width - margin * 2);
			y = margin + weatherRandom() * (outerThickness - margin);
		} else if (side === 1) {
			x = width - outerThickness + margin + weatherRandom() * (outerThickness - margin * 2);
			y = margin + weatherRandom() * (height - margin * 2);
		} else if (side === 2) {
			x = margin + weatherRandom() * (width - margin * 2);
			y = height - outerThickness + margin + weatherRandom() * (outerThickness - margin * 2);
		} else {
			x = margin + weatherRandom() * (outerThickness - margin);
			y = margin + weatherRandom() * (height - margin * 2);
		}

		const radius = 3 + weatherRandom() * 8 * intensity;
		const alpha = 0.08 + weatherRandom() * 0.14 * intensity;
		const greenRed = Math.round(60 + weatherRandom() * 30);
		const greenGreen = Math.round(120 + weatherRandom() * 50);
		const greenBlue = Math.round(100 + weatherRandom() * 40);
		ctx.fillStyle = `rgba(${greenRed},${greenGreen},${greenBlue},${alpha})`;
		ctx.beginPath();
		ctx.ellipse(
			x,
			y,
			radius,
			radius * (0.6 + weatherRandom() * 0.8),
			weatherRandom() * Math.PI,
			0,
			Math.PI * 2
		);
		ctx.fill();

		if (weatherRandom() > 0.4) {
			ctx.fillStyle = `rgba(${greenRed - 10},${greenGreen + 10},${greenBlue + 15},${alpha * 0.7})`;
			ctx.beginPath();
			ctx.ellipse(
				x + (weatherRandom() - 0.5) * radius * 2,
				y + (weatherRandom() - 0.5) * radius * 2,
				radius * 0.5,
				radius * 0.4,
				weatherRandom() * Math.PI,
				0,
				Math.PI * 2
			);
			ctx.fill();
		}
	}

	const chipCount = Math.round(6 + 14 * intensity);

	for (let chip = 0; chip < chipCount; chip += 1) {
		const edge = Math.floor(weatherRandom() * 4);
		let x: number;
		let y: number;

		if (edge === 0) {
			x = 4 + weatherRandom() * (width - 8);
			y = 1 + weatherRandom() * 3;
		} else if (edge === 1) {
			x = width - 1 - weatherRandom() * 3;
			y = 4 + weatherRandom() * (height - 8);
		} else if (edge === 2) {
			x = 4 + weatherRandom() * (width - 8);
			y = height - 1 - weatherRandom() * 3;
		} else {
			x = 1 + weatherRandom() * 3;
			y = 4 + weatherRandom() * (height - 8);
		}

		const chipWidth = 2 + weatherRandom() * 5 * intensity;
		const chipHeight = 1 + weatherRandom() * 3 * intensity;
		const chipAlpha = 0.3 + weatherRandom() * 0.4 * intensity;
		ctx.fillStyle = `rgba(48,36,18,${chipAlpha})`;
		ctx.beginPath();
		ctx.ellipse(x, y, chipWidth, chipHeight, weatherRandom() * Math.PI, 0, Math.PI * 2);
		ctx.fill();
	}

	const dustGradient = ctx.createLinearGradient(0, 0, 0, height);
	const dustAlpha = 0.04 + 0.08 * intensity;
	dustGradient.addColorStop(0, `rgba(180,160,120,${dustAlpha * 0.3})`);
	dustGradient.addColorStop(0.6, `rgba(180,160,120,${dustAlpha * 0.5})`);
	dustGradient.addColorStop(1, `rgba(160,140,100,${dustAlpha})`);
	ctx.fillStyle = dustGradient;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, width, height);
	const openingX = outerThickness + innerThickness + matThickness;
	const openingY = openingX;
	const openingWidth = width - openingX * 2;
	const openingHeight = height - openingY * 2;
	ctx.rect(openingX, openingY + openingHeight, openingWidth, -openingHeight);
	ctx.clip('evenodd');
	ctx.fillRect(0, 0, width, height);
	ctx.restore();

	const stainCount = Math.round(2 + 5 * intensity);
	const matInnerX = outerThickness + innerThickness;
	const matInnerY = matInnerX;
	const matInnerWidth = width - matInnerX * 2;
	const matInnerHeight = height - matInnerY * 2;

	for (let stain = 0; stain < stainCount; stain += 1) {
		const stainX = matInnerX + weatherRandom() * matInnerWidth;
		const stainY = matInnerY + weatherRandom() * matInnerHeight;
		const stainRadius = 4 + weatherRandom() * 12 * intensity;
		const stainAlpha = 0.04 + weatherRandom() * 0.08 * intensity;
		ctx.fillStyle = `rgba(160,140,100,${stainAlpha})`;
		ctx.beginPath();
		ctx.ellipse(
			stainX,
			stainY,
			stainRadius,
			stainRadius * (0.5 + weatherRandom() * 0.8),
			weatherRandom() * Math.PI,
			0,
			Math.PI * 2
		);
		ctx.fill();
	}

	const agedData = ctx.getImageData(0, 0, width, height);
	const agedPixels = agedData.data;
	const noiseAmount = 6 + 10 * intensity;

	for (let index = 0; index < agedPixels.length; index += 4) {
		if (agedPixels[index + 3] === 0) continue;
		const noise = (weatherRandom() - 0.5) * noiseAmount;
		agedPixels[index] = Math.max(0, Math.min(255, agedPixels[index]! + noise));
		agedPixels[index + 1] = Math.max(0, Math.min(255, agedPixels[index + 1]! + noise));
		agedPixels[index + 2] = Math.max(0, Math.min(255, agedPixels[index + 2]! + noise));
	}

	ctx.putImageData(agedData, 0, 0);
}
