import type { DrawingDocumentV2 } from '$lib/features/stroke-json/document';

export type DrawPublishedArtwork = {
	id: string;
	isNsfw?: boolean;
	mediaUrl: string;
	title: string;
};

export type DrawForkParent = {
	drawingDocument?: DrawingDocumentV2 | null;
	id: string;
	isNsfw?: boolean;
	mediaUrl: string;
	title: string;
};

export type DrawPublishActionData =
	| {
			action: 'publish';
			artwork: DrawPublishedArtwork;
			success: true;
	  }
	| {
			action?: 'publish';
			code?: string;
			message: string;
			success?: false;
	  };

export type DrawPageUser = {
	id?: string;
	nickname: string;
};
