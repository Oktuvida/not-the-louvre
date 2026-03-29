import type { TextContentChecker, TextFilterContext } from './types';

type ObscenityModule = typeof import('obscenity');

let matcherPromise: Promise<ObscenityMatcher> | null = null;

type ObscenityMatcher = {
	hasMatch(input: string): boolean;
};

const spanishProfanity = [
	'cabron',
	'coño',
	'culero',
	'gilipollas',
	'hijoputa',
	'joder',
	'malparido',
	'maricon',
	'mierda',
	'pendejo',
	'puta',
	'puto',
	'verga'
] as const;

const unavailableMessages: Record<TextFilterContext, string> = {
	comment: 'Comment safety check is unavailable right now. Please try again.',
	nickname: 'Nickname safety check is unavailable right now. Please try again.'
};

const blockedMessages: Record<TextFilterContext, string> = {
	comment: 'This comment breaks the gallery rules.',
	nickname: 'Choose a different nickname.'
};

const shouldBypassClientContentFilters = () =>
	typeof window !== 'undefined' && Boolean(window.__ntlBypassClientContentFilters);

const createMatcher = async (): Promise<ObscenityMatcher> => {
	const obscenity = (await import('obscenity')) as ObscenityModule;
	const dataset = new obscenity.DataSet<{ originalWord: string }>().addAll(
		obscenity.englishDataset
	);

	for (const word of spanishProfanity) {
		dataset.addPhrase((phrase) =>
			phrase.setMetadata({ originalWord: word }).addPattern(obscenity.pattern`|${word}|`)
		);
	}

	return new obscenity.RegExpMatcher({
		...dataset.build(),
		...obscenity.englishRecommendedTransformers
	});
};

const getMatcher = async () => {
	if (!matcherPromise) {
		matcherPromise = createMatcher().catch((error) => {
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
		const matcher = await getMatcher();
		if (!matcher.hasMatch(value)) {
			return { status: 'allowed' };
		}

		return {
			message: blockedMessages[context],
			status: 'blocked'
		};
	} catch {
		return {
			message: unavailableMessages[context],
			status: 'unavailable'
		};
	}
};
