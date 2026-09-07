import type { TextModerationContext } from '$lib/shared/moderation/text-policy';

export type ContentFilterResult =
	| { status: 'allowed' }
	| { message: string; status: 'blocked' }
	| { message: string; status: 'unavailable' };

// The filter speaks the same context vocabulary as the policy table and the
// `app.moderation_text_policy_context` enum, so it aliases that type instead of
// writing the union a second time. Type-only, so the wordlist stays lazy.
export type TextFilterContext = TextModerationContext;

export type TextContentChecker = (
	value: string,
	context: TextFilterContext
) => Promise<ContentFilterResult>;
