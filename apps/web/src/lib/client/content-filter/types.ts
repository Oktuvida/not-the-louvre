export type ContentFilterResult =
	| { status: 'allowed' }
	| { message: string; status: 'blocked' }
	| { message: string; status: 'unavailable' };

export type TextFilterContext = 'comment' | 'nickname';
export type ImageFilterContext = 'artwork' | 'avatar';

export type TextContentChecker = (
	value: string,
	context: TextFilterContext
) => Promise<ContentFilterResult>;

export type ImageContentChecker = (
	file: File,
	context: ImageFilterContext
) => Promise<ContentFilterResult>;
