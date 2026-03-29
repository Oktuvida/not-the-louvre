export type ContentFilterResult =
	| { status: 'allowed' }
	| { message: string; status: 'blocked' }
	| { message: string; status: 'unavailable' };

export type TextFilterContext = 'comment' | 'nickname' | 'artwork_title';

export type TextContentChecker = (
	value: string,
	context: TextFilterContext
) => Promise<ContentFilterResult>;
