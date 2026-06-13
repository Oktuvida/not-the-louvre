// Cloudflare Workers disallow compiling WASM from bytes at runtime, so each codec
// module must arrive as a WebAssembly.Module import bundled by wrangler. Node has
// no native .wasm imports, so there we read the binary from node_modules instead.
export const runningInCloudflareWorkers =
	typeof caches !== 'undefined' &&
	(caches as unknown as { default?: unknown }).default !== undefined;

const loadNodeWasmModule = async (specifier: string): Promise<WebAssembly.Module> => {
	const { createRequire } = await import('node:module');
	const { readFile } = await import('node:fs/promises');
	const require = createRequire(import.meta.url);

	return WebAssembly.compile(await readFile(require.resolve(specifier)));
};

export const loadCodecWasmModule = async (
	specifier: string,
	importWorkersWasmModule: () => Promise<{ default: WebAssembly.Module }>
): Promise<WebAssembly.Module> =>
	runningInCloudflareWorkers
		? (await importWorkersWasmModule()).default
		: loadNodeWasmModule(specifier);

class ImageDataPolyfill {
	readonly colorSpace = 'srgb';
	readonly data: Uint8ClampedArray;
	readonly height: number;
	readonly width: number;

	constructor(data: Uint8ClampedArray, width: number, height?: number) {
		this.data = data;
		this.width = width;
		this.height = height ?? data.byteLength / (width * 4);
	}
}

export const ensureImageDataGlobal = () => {
	if (typeof globalThis.ImageData === 'undefined') {
		globalThis.ImageData = ImageDataPolyfill as unknown as typeof ImageData;
	}
};
