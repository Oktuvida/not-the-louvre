import { WorkerEntrypoint } from 'cloudflare:workers';
import type { DrawingDocument } from '#lib/features/stroke-json/document.js';
import { inProcessRenderer, type Renderer } from '#lib/server/render/renderer.js';

/**
 * The renderer Worker: drawings in, images out, called over RPC through the
 * web Worker's RENDERER binding. It holds the WebAssembly codecs (resvg,
 * libwebp, the AVIF decoder for old avatars) so the web Worker that answers
 * every gallery request does not.
 */
export default class RendererWorker extends WorkerEntrypoint implements Renderer {
	renderArtwork(document: DrawingDocument) {
		return inProcessRenderer.renderArtwork(document);
	}

	renderAvatar(document: DrawingDocument) {
		return inProcessRenderer.renderAvatar(document);
	}

	renderFavicon(avatar: Uint8Array) {
		return inProcessRenderer.renderFavicon(avatar);
	}

	fetch() {
		return new Response('Not found', { status: 404 });
	}
}
