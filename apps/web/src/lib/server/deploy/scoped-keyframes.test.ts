import { describe, expect, it } from 'vitest';
import {
	BUILT_IN_KEYFRAMES,
	describeDeadKeyframeReference,
	findDeadKeyframeReferences,
	readKeyframeNames
} from './scoped-keyframes';

const globals = new Set([...BUILT_IN_KEYFRAMES, 'wiggle']);

describe('readKeyframeNames', () => {
	it('collects the keyframes a global stylesheet declares', () => {
		expect(readKeyframeNames('@keyframes wiggle { from {} }\n@keyframes paper-drift{}')).toEqual([
			'wiggle',
			'paper-drift'
		]);
	});
});

describe('findDeadKeyframeReferences', () => {
	it('flags a Tailwind arbitrary animation with no global keyframes', () => {
		const source = '<div class="animate-[paper-drift_2s_ease]"></div>';

		expect(findDeadKeyframeReferences(source, globals)).toEqual([
			{ kind: 'utility', name: 'paper-drift' }
		]);
	});

	it('flags an inline animation in every literal style attribute shape', () => {
		const source = [
			'<div style="animation: fade-in 1s"></div>',
			"<div style='animation-name: slide-up'></div>",
			'<div style={`animation: pop-in 0.4s ease`}></div>',
			'<div style:animation="drift 3s"></div>'
		].join('\n');

		const names = findDeadKeyframeReferences(source, globals).map((reference) => reference.name);

		expect(names.toSorted()).toEqual(['drift', 'fade-in', 'pop-in', 'slide-up']);
	});

	it('leaves the shapes that do resolve alone', () => {
		const source = [
			'<script lang="ts">',
			// A motion config is not CSS. Scanning the script block made this an
			// ordinary object property that failed the build.
			'\tconst reveal = { animation: fadeIn, duration: 200 };',
			'\tconst timeline = { animation: gsapTween };',
			'\ttype Props = { animation: string };',
			'</script>',
			'',
			'<div class="animate-[spin_1s_linear_infinite]"></div>',
			'<div class="animate-[wiggle_0.5s]"></div>',
			'<div style="animation: none"></div>',
			'<div class="drifting"></div>',
			'',
			'<style>',
			'\t@keyframes drift { from { opacity: 0 } }',
			'\t.drifting { animation: drift 2s ease; }',
			'</style>'
		].join('\n');

		expect(findDeadKeyframeReferences(source, globals)).toEqual([]);
	});
});

describe('describeDeadKeyframeReference', () => {
	it('names the file and the token in both messages', () => {
		expect(
			describeDeadKeyframeReference('src/x.svelte', { kind: 'utility', name: 'paper-drift' })
		).toContain('animate-[paper-drift…]');
		expect(
			describeDeadKeyframeReference('src/x.svelte', { kind: 'inline', name: 'fade-in' })
		).toContain('"animation: fade-in …"');
	});
});
