import sharp from 'sharp';

const FAVICON_SIZE = 64;
const FAVICON_RADIUS = 18;
const FAVICON_ZOOM_FACTOR = 1.22;

const buildRoundedMaskSvg = (size: number, radius: number) =>
	`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
	<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff" />
</svg>`.trim();

export const renderAvatarFaviconPng = async (input: Buffer | Uint8Array | ArrayBuffer) => {
	const zoomedSize = Math.ceil(FAVICON_SIZE * FAVICON_ZOOM_FACTOR);
	const overflow = Math.floor((zoomedSize - FAVICON_SIZE) / 2);
	const roundedMask = Buffer.from(buildRoundedMaskSvg(FAVICON_SIZE, FAVICON_RADIUS));

	return sharp(input, { animated: false })
		.resize(zoomedSize, zoomedSize, { fit: 'cover', position: 'centre' })
		.extract({
			height: FAVICON_SIZE,
			left: overflow,
			top: overflow,
			width: FAVICON_SIZE
		})
		.composite([{ blend: 'dest-in', input: roundedMask }])
		.png()
		.toBuffer();
};
