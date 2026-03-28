import sharp from 'sharp';

type AvifTestPattern = 'blocks' | 'noise' | 'striped-noise';

type CreateAvifTestFileOptions = {
	effort?: number;
	height: number;
	name?: string;
	pattern?: AvifTestPattern;
	quality?: number;
	width: number;
};

const AVIF_SIGNATURE_BYTES = new Uint8Array([
	0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
	0x6d, 0x69, 0x66, 0x31
]);

const PNG_SIGNATURE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const createPixelData = (width: number, height: number, pattern: AvifTestPattern) => {
	const bytes = new Uint8Array(width * height * 4);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = (y * width + x) * 4;

			if (pattern === 'noise') {
				bytes[index] = (x * 31 + y * 17) % 256;
				bytes[index + 1] = (x * 13 + y * 29) % 256;
				bytes[index + 2] = (x * 7 + y * 19) % 256;
			} else if (pattern === 'striped-noise') {
				const isLightStripe = x % 3 < 1;
				bytes[index] = isLightStripe ? 255 : 0;
				bytes[index + 1] = (y * 53) % 256;
				bytes[index + 2] = isLightStripe ? (x * 53) % 256 : (y * 53) % 256;
			} else {
				bytes[index] = x < width / 2 ? 32 : 224;
				bytes[index + 1] = y < height / 2 ? 64 : 192;
				bytes[index + 2] = 128;
			}

			bytes[index + 3] = 255;
		}
	}

	return bytes;
};

export const createAvifTestFile = async ({
	effort = 4,
	height,
	name = 'image.avif',
	pattern = 'blocks',
	quality = 95,
	width
}: CreateAvifTestFileOptions) => {
	const pixelData = createPixelData(width, height, pattern);
	const buffer = await sharp(pixelData, {
		raw: {
			channels: 4,
			height,
			width
		}
	})
		.avif({
			chromaSubsampling: '4:4:4',
			effort,
			quality
		})
		.toBuffer();

	return new File([Uint8Array.from(buffer)], name, { type: 'image/avif' });
};

export const createJpegTestFile = async ({
	height,
	name = 'image.jpg',
	pattern = 'blocks',
	quality = 95,
	width
}: Omit<CreateAvifTestFileOptions, 'effort'>) => {
	const pixelData = createPixelData(width, height, pattern);
	const buffer = await sharp(pixelData, {
		raw: {
			channels: 4,
			height,
			width
		}
	})
		.jpeg({ quality })
		.toBuffer();

	return new File([Uint8Array.from(buffer)], name, { type: 'image/jpeg' });
};

export const createWebpTestFile = async ({
	height,
	name = 'image.webp',
	pattern = 'blocks',
	quality = 95,
	width
}: Omit<CreateAvifTestFileOptions, 'effort'>) => {
	const pixelData = createPixelData(width, height, pattern);
	const buffer = await sharp(pixelData, {
		raw: {
			channels: 4,
			height,
			width
		}
	})
		.webp({ quality })
		.toBuffer();

	return new File([Uint8Array.from(buffer)], name, { type: 'image/webp' });
};

export const createPngTestFile = async ({
	height,
	name = 'image.png',
	pattern = 'blocks',
	width
}: Omit<CreateAvifTestFileOptions, 'effort' | 'quality'>) => {
	const pixelData = createPixelData(width, height, pattern);
	const buffer = await sharp(pixelData, {
		raw: {
			channels: 4,
			height,
			width
		}
	})
		.png()
		.toBuffer();

	return new File([Uint8Array.from(buffer)], name, { type: 'image/png' });
};

export const createMalformedAvifFile = (size = 128, name = 'invalid.avif') => {
	const bytes = new Uint8Array(size);
	bytes.set(AVIF_SIGNATURE_BYTES);

	for (let index = AVIF_SIGNATURE_BYTES.length; index < size; index += 1) {
		bytes[index] = (index * 37) % 256;
	}

	return new File([bytes], name, { type: 'image/avif' });
};

export const createMalformedPngFile = (size = 128, name = 'invalid.png') => {
	const bytes = new Uint8Array(size);
	bytes.set(PNG_SIGNATURE_BYTES);

	for (let index = PNG_SIGNATURE_BYTES.length; index < size; index += 1) {
		bytes[index] = (index * 53) % 256;
	}

	return new File([bytes], name, { type: 'image/png' });
};

export const fileToBytes = async (file: File) => new Uint8Array(await file.arrayBuffer());
