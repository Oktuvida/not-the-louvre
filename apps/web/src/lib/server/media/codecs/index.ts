import decodeAvifImage, { init as initAvifDecode } from '@jsquash/avif/decode';
import encodeAvifImage, { init as initAvifEncode } from '@jsquash/avif/encode';
import decodeJpegImage, { init as initJpegDecode } from '@jsquash/jpeg/decode';
import decodePngImage, { init as initPngDecode } from '@jsquash/png/decode';
import encodePngImage, { init as initPngEncode } from '@jsquash/png/encode';
import resizeImageData, { initResize } from '@jsquash/resize';
import decodeWebpImage, { init as initWebpDecode } from '@jsquash/webp/decode';
import { initWasm as initResvg, Resvg } from '@resvg/resvg-wasm';
import { ensureImageDataGlobal, loadCodecWasmModule } from './loader';
import {
	blitWithAlpha,
	createSolidImage,
	cropCenter,
	type RawImage,
	type RgbColor
} from './raster';

export type { RawImage, RgbColor };
export { applyRoundedRectAlpha, cropCenter, flattenOntoBackground, parseHexColor } from './raster';

export type ImageFormat = 'avif' | 'jpeg' | 'png' | 'webp';

export type AvifEncodeSettings = {
	chromaSubsampling: '4:2:0' | '4:4:4';
	quality: number;
};

ensureImageDataGlobal();

type InitWithWasmModule = (wasmModule: WebAssembly.Module) => Promise<unknown>;

// Bundlers resolve `.wasm` imports to a default-exported WebAssembly.Module, but
// TypeScript types the dynamic import as the raw module record, so we narrow it.
const importWasmModule = (loader: () => Promise<unknown>) =>
	loader() as Promise<{ default: WebAssembly.Module }>;

const codecInitializations = new Map<string, Promise<unknown>>();

const ensureCodec = (
	cacheKey: string,
	specifier: string,
	importWorkersWasmModule: () => Promise<{ default: WebAssembly.Module }>,
	initialize: InitWithWasmModule
) => {
	let initialization = codecInitializations.get(cacheKey);

	if (!initialization) {
		initialization = loadCodecWasmModule(specifier, importWorkersWasmModule).then(initialize);
		codecInitializations.set(cacheKey, initialization);
	}

	return initialization;
};

const ensureAvifDecode = () =>
	ensureCodec(
		'avif-decode',
		'@jsquash/avif/codec/dec/avif_dec.wasm',
		() => importWasmModule(() => import('@jsquash/avif/codec/dec/avif_dec.wasm')),
		initAvifDecode as unknown as InitWithWasmModule
	);

const ensureAvifEncode = () =>
	ensureCodec(
		'avif-encode',
		'@jsquash/avif/codec/enc/avif_enc.wasm',
		() => importWasmModule(() => import('@jsquash/avif/codec/enc/avif_enc.wasm')),
		initAvifEncode as unknown as InitWithWasmModule
	);

const ensureJpegDecode = () =>
	ensureCodec(
		'jpeg-decode',
		'@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm',
		() => importWasmModule(() => import('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm')),
		initJpegDecode as unknown as InitWithWasmModule
	);

const ensurePngDecode = () =>
	ensureCodec(
		'png-decode',
		'@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
		() => importWasmModule(() => import('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
		(wasmModule) => initPngDecode(wasmModule)
	);

const ensurePngEncode = () =>
	ensureCodec(
		'png-encode',
		'@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
		() => importWasmModule(() => import('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
		(wasmModule) => initPngEncode(wasmModule)
	);

const ensureWebpDecode = () =>
	ensureCodec(
		'webp-decode',
		'@jsquash/webp/codec/dec/webp_dec.wasm',
		() => importWasmModule(() => import('@jsquash/webp/codec/dec/webp_dec.wasm')),
		initWebpDecode as unknown as InitWithWasmModule
	);

const ensureResize = () =>
	ensureCodec(
		'resize',
		'@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm',
		() => importWasmModule(() => import('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm')),
		(wasmModule) => initResize(wasmModule)
	);

const ensureResvg = () =>
	ensureCodec(
		'resvg',
		'@resvg/resvg-wasm/index_bg.wasm',
		() => importWasmModule(() => import('@resvg/resvg-wasm/index_bg.wasm')),
		async (wasmModule) => {
			try {
				await initResvg(wasmModule);
			} catch (error) {
				// resvg keeps its instance in module state shared across module
				// registries (e.g. vitest isolates); a second init is harmless.
				if (!(error instanceof Error) || !error.message.includes('Already initialized')) {
					throw error;
				}
			}
		}
	);

const JPEG_MAGIC_BYTES = [0xff, 0xd8, 0xff];
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ISO_BMFF_FTYP_OFFSET = 4;
const ISO_BMFF_BRAND_OFFSET = 8;
const ISO_BMFF_HEADER_BYTES = 16;
const ISO_BMFF_BRAND_BYTES = 4;
const AVIF_STILL_BRAND = 'avif';
const AVIF_SEQUENCE_BRAND = 'avis';

const readAscii = (input: Uint8Array, start: number, length: number) =>
	String.fromCharCode(...input.subarray(start, start + length));

const matchesMagicBytes = (input: Uint8Array, magicBytes: ReadonlyArray<number>) =>
	input.byteLength >= magicBytes.length && magicBytes.every((byte, index) => input[index] === byte);

const containsAscii = (input: Uint8Array, marker: string) => {
	const markerBytes = marker.split('').map((character) => character.charCodeAt(0));

	for (let offset = 0; offset + markerBytes.length <= input.byteLength; offset += 1) {
		if (markerBytes.every((byte, index) => input[offset + index] === byte)) {
			return true;
		}
	}

	return false;
};

const collectIsoBmffBrands = (input: Uint8Array) => {
	const brands = new Set<string>();

	if (
		input.byteLength < ISO_BMFF_HEADER_BYTES ||
		readAscii(input, ISO_BMFF_FTYP_OFFSET, ISO_BMFF_BRAND_BYTES) !== 'ftyp'
	) {
		return brands;
	}

	brands.add(readAscii(input, ISO_BMFF_BRAND_OFFSET, ISO_BMFF_BRAND_BYTES));

	for (
		let offset = ISO_BMFF_HEADER_BYTES;
		offset + ISO_BMFF_BRAND_BYTES <= input.byteLength;
		offset += 4
	) {
		brands.add(readAscii(input, offset, ISO_BMFF_BRAND_BYTES));
	}

	return brands;
};

export const hasAvifMagicBytes = (input: Uint8Array) => {
	const brands = collectIsoBmffBrands(input);

	return brands.has(AVIF_STILL_BRAND) || brands.has(AVIF_SEQUENCE_BRAND);
};

export const hasWebpMagicBytes = (input: Uint8Array) =>
	input.byteLength >= 12 && readAscii(input, 0, 4) === 'RIFF' && readAscii(input, 8, 4) === 'WEBP';

export const sniffImageFormat = (input: Uint8Array): ImageFormat | null => {
	if (matchesMagicBytes(input, JPEG_MAGIC_BYTES)) {
		return 'jpeg';
	}

	if (matchesMagicBytes(input, PNG_MAGIC_BYTES)) {
		return 'png';
	}

	if (hasWebpMagicBytes(input)) {
		return 'webp';
	}

	if (hasAvifMagicBytes(input)) {
		return 'avif';
	}

	return null;
};

// sharp exposed multi-frame inputs through `metadata.pages`; without it we
// reject animated containers from their structure before decoding.
export const isAnimatedImage = (input: Uint8Array, format: ImageFormat) => {
	if (format === 'webp') {
		return containsAscii(input, 'ANIM') || containsAscii(input, 'ANMF');
	}

	if (format === 'avif') {
		return collectIsoBmffBrands(input).has(AVIF_SEQUENCE_BRAND);
	}

	if (format === 'png') {
		return containsAscii(input, 'acTL');
	}

	return false;
};

export const mimeTypeForImageFormat = (format: ImageFormat) =>
	format === 'jpeg' ? 'image/jpeg' : `image/${format}`;

const toImageData = (image: RawImage) =>
	new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);

const fromImageData = (imageData: {
	data: Uint8ClampedArray;
	height: number;
	width: number;
}): RawImage => ({
	data: imageData.data,
	height: imageData.height,
	width: imageData.width
});

export const decodeImage = async (input: Uint8Array, format: ImageFormat): Promise<RawImage> => {
	// slice() copies the view into a standalone ArrayBuffer (never shared).
	const buffer = input.buffer.slice(
		input.byteOffset,
		input.byteOffset + input.byteLength
	) as ArrayBuffer;

	if (format === 'avif') {
		await ensureAvifDecode();
		const imageData = await decodeAvifImage(buffer);

		if (!imageData) {
			throw new Error('Failed to decode AVIF image');
		}

		return fromImageData(imageData);
	}

	if (format === 'webp') {
		await ensureWebpDecode();

		return fromImageData(await decodeWebpImage(buffer));
	}

	if (format === 'png') {
		await ensurePngDecode();

		return fromImageData(await decodePngImage(buffer));
	}

	await ensureJpegDecode();

	return fromImageData(await decodeJpegImage(buffer));
};

const AVIF_CHROMA_SUBSAMPLING_VALUES = {
	'4:2:0': 1,
	'4:4:4': 3
} as const;

// Matches the previous sharp pipeline's `effort: 4` middle ground; jSquash
// speed runs 0 (slowest) to 10 and defaults to 6.
const AVIF_ENCODE_SPEED = 6;

export const encodeAvif = async (
	image: RawImage,
	settings: AvifEncodeSettings
): Promise<Uint8Array> => {
	await ensureAvifEncode();

	const encoded = await encodeAvifImage(toImageData(image), {
		quality: settings.quality,
		speed: AVIF_ENCODE_SPEED,
		subsample: AVIF_CHROMA_SUBSAMPLING_VALUES[settings.chromaSubsampling]
	});

	return new Uint8Array(encoded);
};

export const encodePng = async (image: RawImage): Promise<Uint8Array> => {
	await ensurePngEncode();

	return new Uint8Array(await encodePngImage(toImageData(image)));
};

export const resizeImage = async (
	image: RawImage,
	target: { height: number; width: number }
): Promise<RawImage> => {
	if (image.width === target.width && image.height === target.height) {
		return image;
	}

	await ensureResize();

	return fromImageData(
		await resizeImageData(toImageData(image), {
			fitMethod: 'stretch',
			height: target.height,
			width: target.width
		})
	);
};

export const containOnBackground = async (
	image: RawImage,
	target: { background: RgbColor; height: number; width: number }
): Promise<RawImage> => {
	const scale = Math.min(target.width / image.width, target.height / image.height);
	const scaledWidth = Math.max(1, Math.round(image.width * scale));
	const scaledHeight = Math.max(1, Math.round(image.height * scale));
	const scaled = await resizeImage(image, { height: scaledHeight, width: scaledWidth });
	const canvas = createSolidImage(target.width, target.height, target.background);

	blitWithAlpha(
		canvas,
		scaled,
		Math.floor((target.width - scaledWidth) / 2),
		Math.floor((target.height - scaledHeight) / 2)
	);

	return canvas;
};

export const coverResize = async (
	image: RawImage,
	target: { height: number; width: number }
): Promise<RawImage> => {
	const scale = Math.max(target.width / image.width, target.height / image.height);
	const scaled = await resizeImage(image, {
		height: Math.max(target.height, Math.round(image.height * scale)),
		width: Math.max(target.width, Math.round(image.width * scale))
	});

	return cropCenter(scaled, target.width, target.height);
};

export const renderSvgToRaster = async (
	svg: string,
	target: { height: number; width: number }
): Promise<RawImage> => {
	await ensureResvg();

	const renderer = new Resvg(svg, {
		fitTo: { mode: 'width', value: target.width }
	});
	const rendered = renderer.render();
	const image: RawImage = {
		data: new Uint8ClampedArray(rendered.pixels),
		height: rendered.height,
		width: rendered.width
	};

	rendered.free();
	renderer.free();

	return resizeImage(image, target);
};
