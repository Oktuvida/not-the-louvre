export type SvgRasterSize = {
	height: number;
	width: number;
};

/*
 * Firefox rasterizes SVG images on the content main thread at their effective
 * on-screen resolution. While the museum wall zooms (scale ~18x) that meant
 * redrawing the brick/frame/logo vectors at 7000px+ per frame — 100ms+ jank.
 * Rasterizing once into a fixed-size bitmap turns them into plain textures
 * that the compositor merely samples.
 */
const bitmapCache = new Map<string, Promise<string>>();

const SVG_DATA_URL_PREFIX = 'data:image/svg+xml,';

const loadSvgMarkup = async (svgUrl: string) => {
	if (svgUrl.startsWith(SVG_DATA_URL_PREFIX)) {
		return decodeURIComponent(svgUrl.slice(SVG_DATA_URL_PREFIX.length));
	}

	const response = await fetch(svgUrl);
	if (!response.ok) {
		throw new Error(`failed to fetch svg: ${svgUrl}`);
	}

	return response.text();
};

/*
 * drawImage rasterizes dimensionless SVGs (viewBox only) at a fallback size,
 * so the raster size is pinned on the root element before decoding instead.
 */
const sizeSvgMarkup = (markup: string, size: SvgRasterSize) => {
	const svgDocument = new DOMParser().parseFromString(markup, 'image/svg+xml');
	const root = svgDocument.documentElement;

	if (root.tagName !== 'svg') {
		throw new Error('source is not an svg document');
	}

	root.setAttribute('width', `${size.width}`);
	root.setAttribute('height', `${size.height}`);

	return new XMLSerializer().serializeToString(root);
};

const decodeSvgImage = async (markup: string) => {
	const svgBlob = new Blob([markup], { type: 'image/svg+xml' });
	const svgObjectUrl = URL.createObjectURL(svgBlob);

	try {
		const image = new Image();
		image.src = svgObjectUrl;
		await image.decode();
		return image;
	} finally {
		// Safe to revoke after decode: the pixels already live in the image.
		URL.revokeObjectURL(svgObjectUrl);
	}
};

const rasterize = async (svgUrl: string, size: SvgRasterSize) => {
	const width = Math.max(1, Math.round(size.width));
	const height = Math.max(1, Math.round(size.height));
	const markup = sizeSvgMarkup(await loadSvgMarkup(svgUrl), { height, width });
	const image = await decodeSvgImage(markup);

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('2d canvas context unavailable');
	}

	context.drawImage(image, 0, 0, width, height);

	const bitmapBlob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
			'image/png'
		);
	});

	return URL.createObjectURL(bitmapBlob);
};

/**
 * Rasterizes an SVG (data URL or fetchable URL) into a PNG blob URL of the
 * requested pixel size. Results are cached per source and size for the
 * lifetime of the page.
 */
export const rasterizeSvgUrl = (svgUrl: string, size: SvgRasterSize) => {
	const key = `${Math.round(size.width)}x${Math.round(size.height)}:${svgUrl}`;
	const cached = bitmapCache.get(key);
	if (cached) {
		return cached;
	}

	const pending = rasterize(svgUrl, size).catch((error) => {
		// Drop failed attempts so a later call can retry.
		bitmapCache.delete(key);
		throw error;
	});

	bitmapCache.set(key, pending);
	return pending;
};
