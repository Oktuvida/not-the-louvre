export type DrawPublishedArtwork = {
	id: string;
	isNsfw?: boolean;
	mediaUrl: string;
	title: string;
};

export type DrawForkParent = {
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
	nickname: string;
};
