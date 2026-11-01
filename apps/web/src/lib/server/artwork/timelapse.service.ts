import {
	drawingDocumentStore,
	openStoredInkDocument,
	type DrawingDocumentStore
} from '#lib/server/drawing-document/document-store.js';
import type { Viewer } from '#lib/shared/viewer.js';
import { encodeDrawingV3, type DrawingV3Wire } from '#lib/stroke/v3.js';
import { ArtworkFlowError } from './errors';
import { getArtworkDetail } from './read.service';
import type { ArtworkReadRepository } from './types';

export type ArtworkTimelapse = {
	/** Where the copy of a fork's parent image is kept, for the replay to draw over. */
	backdropKey: string | null;
	/** The drawing as v3; one from before v3 has every time at zero. */
	drawing: DrawingV3Wire;
	isHidden: boolean;
};

/**
 * What the timelapse player needs to replay an artwork, for whoever may open
 * it: anyone, or only its author and moderators while it is hidden.
 */
export const getArtworkTimelapse = async (
	artworkId: string,
	context: {
		repository?: ArtworkReadRepository;
		store?: DrawingDocumentStore;
		user?: Viewer | null;
	}
): Promise<ArtworkTimelapse> => {
	const detail = await getArtworkDetail(artworkId, {
		repository: context.repository,
		user: context.user,
		withDrawingDocument: true
	});
	const drawing = await openStoredInkDocument(
		{
			key: detail.drawingDocumentKey ?? null,
			legacyBase64: detail.drawingDocument ?? null,
			version: detail.drawingVersion ?? null
		},
		context.store ?? drawingDocumentStore
	);
	if (!drawing) {
		throw new ArtworkFlowError(404, 'Drawing not found', 'NOT_FOUND');
	}

	// Where the copies are kept is the server's business: the page gets the
	// strokes, and the backdrop through its own address.
	const { parent, ...strokes } = drawing;
	return {
		backdropKey: parent?.image ?? null,
		drawing: encodeDrawingV3(strokes),
		isHidden: detail.isHidden
	};
};
