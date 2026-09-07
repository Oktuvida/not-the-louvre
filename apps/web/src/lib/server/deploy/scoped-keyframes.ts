/**
 * Svelte renames every `@keyframes` declared in a component's scoped <style> and
 * rewrites `animation` declarations only inside that same block. A Tailwind
 * `animate-[name_…]` utility (emitted into the global sheet) and an inline
 * `style="animation: name …"` attribute therefore name a keyframe that does not
 * exist, and the animation silently never runs — the app shipped three of those.
 *
 * The detectors live here rather than in the CLI that runs them because
 * `apps/web/scripts/` is outside both vitest projects, and this guard is a
 * blocking lint step: a false positive here fails a deploy for code that
 * contains no CSS at all.
 */

/** Tailwind ships these in the global sheet. */
export const BUILT_IN_KEYFRAMES: ReadonlySet<string> = new Set(['spin', 'ping', 'pulse', 'bounce']);

/** Values that name no keyframe at all. */
const NON_NAMES = new Set(['none', 'inherit', 'initial', 'revert', 'revert-layer', 'unset']);

export type DeadKeyframeReference = {
	/** `utility` is a Tailwind `animate-[…]`, `inline` a style attribute. */
	kind: 'inline' | 'utility';
	name: string;
};

export const readKeyframeNames = (source: string): string[] =>
	[...source.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]!);

/*
 * Only the markup is scanned. The scoped <style> block is where a keyframe
 * reference is *correct*, and the <script> block is not CSS at all — scanning
 * it turned an ordinary object property (`{ animation: fadeIn }`, the shape
 * every GSAP/motion config uses) into a build-breaking violation.
 */
const stripNonMarkupBlocks = (source: string) =>
	source.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');

/*
 * The three ways a component writes a literal style attribute, plus Svelte's
 * `style:` directive. An attribute whose value is an arbitrary expression
 * (`style={someVariable}`) is out of reach and stays that way: guessing at it
 * is what produced false positives.
 */
const STYLE_ATTRIBUTE_PATTERNS = [
	/\bstyle\s*=\s*"([^"]*)"/g,
	/\bstyle\s*=\s*'([^']*)'/g,
	/\bstyle\s*=\s*\{\s*`([^`]*)`\s*\}/g
];

const STYLE_DIRECTIVE_PATTERNS = [
	/\bstyle:animation(?:-name)?\s*=\s*"([^"]*)"/g,
	/\bstyle:animation(?:-name)?\s*=\s*'([^']*)'/g
];

/** Everything in the `animation` shorthand that is not a keyframes name. */
const SHORTHAND_KEYWORDS = new Set([
	'alternate',
	'alternate-reverse',
	'backwards',
	'both',
	'ease',
	'ease-in',
	'ease-in-out',
	'ease-out',
	'forwards',
	'infinite',
	'linear',
	'normal',
	'paused',
	'reverse',
	'running',
	'step-end',
	'step-start'
]);

const readValues = (markup: string, patterns: RegExp[]): string[] =>
	patterns.flatMap((pattern) => [...markup.matchAll(pattern)].map((match) => match[1] ?? ''));

/** `style:animation="drift 3s"` — the directive's value is the shorthand itself. */
const readShorthandName = (value: string): string | null =>
	value
		.trim()
		.split(/\s+/)
		.find(
			(token) =>
				/^[A-Za-z][\w-]*$/.test(token) && !SHORTHAND_KEYWORDS.has(token) && !NON_NAMES.has(token)
		) ?? null;

export const findDeadKeyframeReferences = (
	source: string,
	globalKeyframes: ReadonlySet<string>
): DeadKeyframeReference[] => {
	const markup = stripNonMarkupBlocks(source);
	const references: DeadKeyframeReference[] = [];

	for (const match of markup.matchAll(/animate-\[([A-Za-z][A-Za-z0-9-]*)[_\]]/g)) {
		const name = match[1]!;
		if (globalKeyframes.has(name)) continue;
		references.push({ kind: 'utility', name });
	}

	for (const value of readValues(markup, STYLE_ATTRIBUTE_PATTERNS)) {
		for (const match of value.matchAll(/\banimation(?:-name)?\s*:\s*([\w-]+)/g)) {
			const name = match[1]!;
			if (NON_NAMES.has(name)) continue;
			references.push({ kind: 'inline', name });
		}
	}

	for (const value of readValues(markup, STYLE_DIRECTIVE_PATTERNS)) {
		const name = readShorthandName(value);
		if (name) references.push({ kind: 'inline', name });
	}

	return references;
};

export const describeDeadKeyframeReference = (
	location: string,
	reference: DeadKeyframeReference
): string =>
	reference.kind === 'utility'
		? `${location}: animate-[${reference.name}…] resolves to no global @keyframes. Declare the keyframes in a .css file, or move the animation into a class inside this component's <style>.`
		: `${location}: inline "animation: ${reference.name} …" can never resolve — Svelte does not rewrite keyframe names inside style attributes. Move it into a class in this component's <style>.`;
