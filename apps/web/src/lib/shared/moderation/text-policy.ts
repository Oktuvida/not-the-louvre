import { Profanity, profaneWords } from '@2toad/profanity';

export type TextModerationContext = 'comment' | 'nickname' | 'artwork_title';

export type PhrasePolicy = {
	allowlist: string[];
	blocklist: string[];
};

type PhraseMatcher = {
	hasMatch(input: string): boolean;
};

const baselineProfanity = new Profanity({
	languages: ['en', 'es'],
	unicodeWordBoundaries: true,
	wholeWord: true
});

const WORD_BOUNDARY_CLASS = '[\\p{L}\\p{N}]';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripDiacritics = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '');

const baselineAccentFoldedWords = [
	...new Set(['en', 'es'].flatMap((language) => profaneWords.get(language) ?? []))
]
	.map((word) => stripDiacritics(word))
	.filter((word, index, collection) => word.length > 0 && collection.indexOf(word) === index);

baselineProfanity.addWords(baselineAccentFoldedWords);

export const normalizeModerationText = (value: string) =>
	value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase();

const compilePhrasePattern = (phrase: string) => {
	const normalized = normalizeModerationText(phrase);
	const pattern = escapeRegex(normalized).replace(/ /g, '\\s+');

	return new RegExp(
		`(^|[^${WORD_BOUNDARY_CLASS.slice(1, -1)}])(${pattern})(?=$|[^${WORD_BOUNDARY_CLASS.slice(1, -1)}])`,
		'gu'
	);
};

const sanitizePolicyValues = (values: string[]) =>
	values
		.map(normalizeModerationText)
		.filter((value, index, collection) => value.length > 0 && collection.indexOf(value) === index);

export const buildPhraseMatcher = (policy: PhrasePolicy): PhraseMatcher => {
	const allowlistPatterns = sanitizePolicyValues(policy.allowlist).map(compilePhrasePattern);
	const blocklistPatterns = sanitizePolicyValues(policy.blocklist).map(compilePhrasePattern);

	return {
		hasMatch(input: string) {
			const normalizedInput = normalizeModerationText(input);
			const sanitizedInput = allowlistPatterns.reduce((currentValue, pattern) => {
				pattern.lastIndex = 0;

				return currentValue.replace(pattern, (_, boundary: string, phrase: string) => {
					return `${boundary}${' '.repeat(phrase.length)}`;
				});
			}, normalizedInput);

			return blocklistPatterns.some((pattern) => {
				pattern.lastIndex = 0;
				return pattern.test(sanitizedInput);
			});
		}
	};
};

export const buildBaselineProfanityMatcher = (): PhraseMatcher => ({
	hasMatch(input: string) {
		const normalizedInput = normalizeModerationText(input);

		return baselineProfanity.exists(normalizedInput);
	}
});
