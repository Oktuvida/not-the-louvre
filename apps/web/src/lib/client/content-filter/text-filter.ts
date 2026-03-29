import {
	buildBaselineProfanityMatcher,
	buildPhraseMatcher
} from '$lib/shared/moderation/text-policy';
import type { TextContentChecker, TextFilterContext } from './types';

type MatcherMap = Record<TextFilterContext, ReturnType<typeof buildPhraseMatcher>>;

let matcherPromise: Promise<MatcherMap> | null = null;
const baselineMatcher = buildBaselineProfanityMatcher();

const blockedMessages: Record<TextFilterContext, string> = {
	artwork_title: 'Choose a different artwork title.',
	comment: 'This comment breaks the gallery rules.',
	nickname: 'Choose a different nickname.'
};

const shouldBypassClientContentFilters = () =>
	typeof window !== 'undefined' && Boolean(window.__ntlBypassClientContentFilters);

const createMatchers = async (): Promise<MatcherMap> => {
	try {
		const response = await fetch('/api/moderation/text-policy', {
			headers: { accept: 'application/json' }
		});

		if (!response.ok) {
			throw new Error('Moderation policy snapshot failed');
		}

		const snapshot = (await response.json()) as {
			policies: Record<TextFilterContext, { allowlist: string[]; blocklist: string[] }>;
		};

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

	if (baselineMatcher.hasMatch(value)) {
		return {
			message: blockedMessages[context],
			status: 'blocked'
		};
	}

	try {
		const matcher = (await getMatchers())[context];
		if (!matcher.hasMatch(value)) {
			return { status: 'allowed' };
		}

		return {
			message: blockedMessages[context],
			status: 'blocked'
		};
	} catch {
		return { status: 'allowed' };
	}
};
