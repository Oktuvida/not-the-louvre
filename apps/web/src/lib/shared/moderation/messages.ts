import type { TextModerationContext } from './text-policy';

// What a visitor is told when the text filter rejects their input. The client
// filter shows it optimistically and the server repeats it on the 400, so the
// two must be the same string.
export const TEXT_MODERATION_BLOCKED_MESSAGES: Record<TextModerationContext, string> = {
	artwork_title: 'Choose a different artwork title.',
	comment: 'This comment breaks the gallery rules.',
	nickname: 'Choose a different nickname.'
};
