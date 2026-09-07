import { requestJson } from '$lib/client/api';
import { TEXT_MODERATION_BLOCKED_MESSAGES } from '$lib/shared/moderation/messages';
import type { TextContentChecker, TextFilterContext } from './types';

// The text-policy module carries the full profanity wordlist, so it loads on
// the first validation instead of riding in every page's entry chunk.
type TextPolicyModule = typeof import('$lib/shared/moderation/text-policy');
type PhraseMatcher = ReturnType<TextPolicyModule['buildPhraseMatcher']>;
type MatcherMap = Record<TextFilterContext, PhraseMatcher>;

let textPolicyModulePromise: Promise<TextPolicyModule> | null = null;
let baselineMatcherPromise: Promise<PhraseMatcher> | null = null;
let matcherPromise: Promise<MatcherMap> | null = null;

const getTextPolicyModule = () => {
	if (!textPolicyModulePromise) {
		textPolicyModulePromise = import('$lib/shared/moderation/text-policy').catch((error) => {
			textPolicyModulePromise = null;
			throw error;
		});
	}

	return textPolicyModulePromise;
};

const getBaselineMatcher = () => {
	if (!baselineMatcherPromise) {
		baselineMatcherPromise = getTextPolicyModule()
			.then((textPolicy) => textPolicy.buildBaselineProfanityMatcher())
			.catch((error) => {
				baselineMatcherPromise = null;
				throw error;
			});
	}

	return baselineMatcherPromise;
};

const shouldBypassClientContentFilters = () =>
	typeof window !== 'undefined' && Boolean(window.__ntlBypassClientContentFilters);

const createMatchers = async (): Promise<MatcherMap> => {
	const { buildPhraseMatcher } = await getTextPolicyModule();

	try {
		const snapshot = await requestJson<{
			policies: Record<TextFilterContext, { allowlist: string[]; blocklist: string[] }>;
		}>('/api/moderation/text-policy');

		return {
			artwork_title: buildPhraseMatcher(snapshot.policies.artwork_title),
			comment: buildPhraseMatcher(snapshot.policies.comment),
			nickname: buildPhraseMatcher(snapshot.policies.nickname)
		};
	} catch {
		const fallbackMatcher = buildPhraseMatcher({ allowlist: [], blocklist: [] });

		return {
			artwork_title: fallbackMatcher,
			comment: fallbackMatcher,
			nickname: fallbackMatcher
		};
	}
};

const getMatchers = async () => {
	if (!matcherPromise) {
		matcherPromise = createMatchers().catch((error) => {
			matcherPromise = null;
			throw error;
		});
	}

	return matcherPromise;
};

export const checkTextContent: TextContentChecker = async (value, context) => {
	if (shouldBypassClientContentFilters()) {
		return { status: 'allowed' };
	}

	try {
		const baselineMatcher = await getBaselineMatcher();

		if (baselineMatcher.hasMatch(value)) {
			return {
				message: TEXT_MODERATION_BLOCKED_MESSAGES[context],
				status: 'blocked'
			};
		}

		const matcher = (await getMatchers())[context];
		if (!matcher.hasMatch(value)) {
			return { status: 'allowed' };
		}

		return {
			message: TEXT_MODERATION_BLOCKED_MESSAGES[context],
			status: 'blocked'
		};
	} catch {
		return { status: 'allowed' };
	}
};
