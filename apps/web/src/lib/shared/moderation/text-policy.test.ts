import { describe, expect, it } from 'vitest';
import {
	buildBaselineProfanityMatcher,
	buildPhraseMatcher,
	normalizeModerationText,
	type PhrasePolicy
} from './text-policy';

describe('text moderation policy helpers', () => {
	it('normalizes unicode, trims edges, collapses whitespace, and lowercases input', () => {
		expect(normalizeModerationText('  Ｈóla   QUE\tTal  ')).toBe('hóla que tal');
	});

	it('blocks configured phrases while allowing explicit whitelist exceptions', () => {
		const policy: PhrasePolicy = {
			allowlist: ['classic nude study'],
			blocklist: ['nude', 'cabron']
		};
		const matcher = buildPhraseMatcher(policy);

		expect(matcher.hasMatch('este cabron no pasa')).toBe(true);
		expect(matcher.hasMatch('classic nude study')).toBe(false);
		expect(matcher.hasMatch('nude sketch')).toBe(true);
	});

	it('provides a baseline profanity matcher without requiring manual policies', () => {
		const matcher = buildBaselineProfanityMatcher();

		expect(matcher.hasMatch('mierda')).toBe(true);
		expect(matcher.hasMatch('cabron')).toBe(true);
		expect(matcher.hasMatch('hello museum')).toBe(false);
	});
});
