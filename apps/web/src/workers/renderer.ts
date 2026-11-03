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
	renderArtwork(document: DrawingDocument, backdrop?: Uint8Array) {
		return inProcessRenderer.renderArtwork(document, backdrop);
	}

	renderAvatar(document: DrawingDocument) {
		return inProcessRenderer.renderAvatar(document);
	}

	renderFavicon(avatar: Uint8Array, size?: number) {
		return inProcessRenderer.renderFavicon(avatar, size);
	}

	fetch() {
		return new Response('Not found', { status: 404 });
	}
}
