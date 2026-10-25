import type { DrawingDocument } from '#lib/features/stroke-json/document.js';
import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import type { SanitizedMedia } from '#lib/server/artwork/types.js';
import { boundRenderer } from '#lib/server/platform.js';
import type { RenderOutcome, Renderer } from './renderer';

const resolveRenderer = async (): Promise<Renderer> => {
	// Dev servers and test runs render in this process. Production builds drop
	// the branch, and with it the codecs, from the web Worker; the renderer
	// Worker does the work there (scripts/check-web-worker-bundle.ts guards it).
	if (import.meta.env.DEV) return (await import('./renderer')).inProcessRenderer;

	const renderer = boundRenderer();
	if (!renderer) {
		throw new ArtworkFlowError(500, 'Image rendering is unavailable', 'STORAGE_FAILED');
	}
	return renderer;
};

const toMedia = (outcome: RenderOutcome, fileName: string): SanitizedMedia => {
	if (!outcome.ok) {
		throw new ArtworkFlowError(outcome.status, outcome.message, outcome.code);
	}
	const { image } = outcome;
	return {
		contentType: image.contentType,
		file: new File([Uint8Array.from(image.bytes)], fileName, { type: image.contentType }),
		height: image.height,
		sizeBytes: image.sizeBytes,
		width: image.width
	};
};

export const renderArtworkMedia = async (document: DrawingDocument) =>
	toMedia(await (await resolveRenderer()).renderArtwork(document), 'artwork.webp');

export const renderAvatarMedia = async (document: DrawingDocument) =>
	toMedia(await (await resolveRenderer()).renderAvatar(document), 'avatar.webp');

export const renderAvatarFavicon = async (avatar: Uint8Array) =>
	(await resolveRenderer()).renderFavicon(avatar);
