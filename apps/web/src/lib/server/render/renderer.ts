import type { DrawingDocument } from '#lib/features/stroke-json/document.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import type { SanitizedMedia } from '#lib/server/artwork/types.js';
import {
	createArtworkDrawingDocumentMedia,
	createAvatarDrawingDocumentMedia
} from '#lib/server/drawing-document/media.js';
import { renderAvatarFaviconPng } from '#lib/server/user/favicon.js';

/*
 * Turns drawings into images. The renderer Worker (src/workers/renderer.ts)
 * serves these over RPC, so only it carries the WebAssembly codecs; dev servers
 * and tests call them in process (render/client.ts). Outcomes are plain data
 * because an exception's class does not survive RPC.
 */

export type RenderedImage = {
	bytes: Uint8Array;
	contentType: string;
	height: number;
	sizeBytes: number;
	width: number;
};

export type RenderOutcome =
	| { image: RenderedImage; ok: true }
	| { code: ArtworkFlowError['code']; message: string; ok: false; status: number };

export type Renderer = {
	renderArtwork(document: DrawingDocument): Promise<RenderOutcome>;
	renderAvatar(document: DrawingDocument): Promise<RenderOutcome>;
	renderFavicon(avatar: Uint8Array): Promise<Uint8Array>;
};

const outcomeOf = async (render: () => Promise<SanitizedMedia>): Promise<RenderOutcome> => {
	try {
		const media = await render();
		return {
			image: {
				bytes: new Uint8Array(await media.file.arrayBuffer()),
				contentType: media.contentType,
				height: media.height,
				sizeBytes: media.sizeBytes,
				width: media.width
			},
			ok: true
		};
	} catch (error) {
		if (error instanceof ArtworkFlowError) {
			return { code: error.code, message: error.message, ok: false, status: error.status };
		}
		throw error;
	}
};

export const inProcessRenderer: Renderer = {
	renderArtwork: (document) => outcomeOf(() => createArtworkDrawingDocumentMedia(document)),
	renderAvatar: (document) => outcomeOf(() => createAvatarDrawingDocumentMedia(document)),
	renderFavicon: async (avatar) => new Uint8Array(await renderAvatarFaviconPng(avatar))
};
