import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The three CSS habits this app kept relapsing into, pinned as a test rather
 * than as a stylelint config: the repo has no stylelint dependency, and a rule
 * set that understands Tailwind 4 at-rules plus Svelte scoped CSS is a project
 * of its own. These three checks are the ones that caught real, shipped bugs.
 */
const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

const collectStyleSources = async (directory: string): Promise<string[]> => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await collectStyleSources(path)));
			continue;
		}

		if (entry.name.endsWith('.svelte') || entry.name.endsWith('.css')) {
			files.push(path);
		}
	}

	return files.sort();
};

const readAll = async () => {
	const files = await collectStyleSources(sourceRoot);

	return await Promise.all(
		files.map(async (path) => ({
			path: relative(sourceRoot, path),
			source: await readFile(path, 'utf8')
		}))
	);
};

/**
 * Prose is not a declaration. Every one of these checks looks for a literal
 * token that the comment explaining the rule also has to spell out, so a line
 * that only continues a comment never counts.
 */
const isCommentLine = (line: string) => /^\s*(\*|\/\*|\/\/|<!--)/.test(line);

/** The zero-based line indices of `source` inside a reduced-motion at-rule. */
const reducedMotionLines = (source: string) => {
	const covered = new Set<number>();
	let depth = 0;
	let blockDepth: number | null = null;

	for (const [index, line] of source.split('\n').entries()) {
		const opens = (line.match(/\{/g) ?? []).length;
		const closes = (line.match(/\}/g) ?? []).length;

		if (blockDepth !== null) {
			covered.add(index);
		} else if (line.includes('prefers-reduced-motion') && opens > 0) {
			blockDepth = depth;
			covered.add(index);
		}

		depth += opens - closes;

		if (blockDepth !== null && depth <= blockDepth) {
			blockDepth = null;
		}
	}

	return covered;
};

describe('CSS hygiene', () => {
	it('leaves `!important` only to the reduced-motion reset', async () => {
		const offenders: string[] = [];
		const exempted: string[] = [];

		for (const { path, source } of await readAll()) {
			if (!source.includes('!important')) continue;

			const covered = reducedMotionLines(source);

			for (const [index, line] of source.split('\n').entries()) {
				if (!line.includes('!important')) continue;
				if (isCommentLine(line)) continue;

				if (covered.has(index)) {
					exempted.push(`${path}:${index + 1}`);
					continue;
				}

				offenders.push(`${path}:${index + 1} ${line.trim()}`);
			}
		}

		// A reduced-motion reset has to win against author rules it cannot see, so
		// `!important` is the mechanism there. Everywhere else it is a specificity
		// fight that a cascade layer or a scoped selector settles properly — see
		// the note on the guestbook SEND override in ArtworkDetailPanel.
		expect(offenders).toEqual([]);
		// And the exemption is real rather than a scanner that matches nothing:
		// the global reset plus the loading-indicator opt-outs are the whole list.
		expect(exempted.length).toBeGreaterThan(0);
	});

	it('never repaints `body` from a route or feature component', async () => {
		const offenders: string[] = [];

		for (const { path, source } of await readAll()) {
			if (path === 'routes/layout.css') continue;

			for (const [index, line] of source.split('\n').entries()) {
				// `:global(body:has(…))` is the scoped form and is fine; a bare
				// `:global(body)` is not. Route stylesheets are never unlinked on
				// client-side navigation, so a bare override keeps repainting every
				// later route for the rest of the session.
				if (!/:global\(\s*body\s*\)/.test(line)) continue;
				if (isCommentLine(line)) continue;

				offenders.push(`${path}:${index + 1} ${line.trim()}`);
			}
		}

		expect(offenders).toEqual([]);
	});

	it('writes lengths with a unit and clamps in ascending order', async () => {
		const unitless: string[] = [];
		const inverted: string[] = [];
		const lengthProperties =
			/^\s*(font-size|width|height|min-width|min-height|max-width|max-height|top|right|bottom|left|inset|gap|border-radius|border-width|letter-spacing|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?)\s*:\s*(-?\d+(?:\.\d+)?)\s*(!important)?;/;

		for (const { path, source } of await readAll()) {
			for (const [index, line] of source.split('\n').entries()) {
				if (isCommentLine(line)) continue;

				const length = lengthProperties.exec(line);

				if (length && Number(length[2]) !== 0) {
					unitless.push(`${path}:${index + 1} ${line.trim()}`);
				}

				for (const clamp of line.matchAll(
					/clamp\(\s*(-?\d+(?:\.\d+)?)([a-z%]+)\s*,[^,]+,\s*(-?\d+(?:\.\d+)?)([a-z%]+)\s*\)/g
				)) {
					const [, min, minUnit, max, maxUnit] = clamp;

					if (minUnit === maxUnit && Number(min) > Number(max)) {
						inverted.push(`${path}:${index + 1} ${clamp[0]}`);
					}
				}
			}
		}

		// `font-size: 7` is dropped while the matching `line-height: 7` stands, and
		// `clamp(7rem, 3vw, 2rem)` silently collapses to a flat 7rem. Neither
		// raises an error in any browser, which is why both survived for months.
		expect({ inverted, unitless }).toEqual({ inverted: [], unitless: [] });
	});

	it('ties every compositor hint to the state that actually moves', async () => {
		const offenders: string[] = [];
		// A state marker in the selector, an explicit release, or the one layer
		// that animates for as long as it exists (the scroll-driven museum wall,
		// whose hint sits inside `@supports (animation-timeline: scroll())`).
		const stateQualified = /\[data-|:hover|:focus|:active|-hidden|-open|-active|-spinning/;

		for (const { path, source } of await readAll()) {
			const lines = source.split('\n');
			let depth = 0;
			let scrollTimelineDepth: number | null = null;

			for (const [index, line] of lines.entries()) {
				const opens = (line.match(/\{/g) ?? []).length;
				const closes = (line.match(/\}/g) ?? []).length;

				if (scrollTimelineDepth === null && line.includes('@supports (animation-timeline')) {
					scrollTimelineDepth = depth;
				}

				const insideScrollTimeline = scrollTimelineDepth !== null;

				depth += opens - closes;

				if (scrollTimelineDepth !== null && depth <= scrollTimelineDepth) {
					scrollTimelineDepth = null;
				}

				if (!/^\s*will-change\s*:/.test(line)) continue;
				if (/will-change\s*:\s*auto\s*;/.test(line)) continue;
				if (insideScrollTimeline) continue;

				const selector = lines
					.slice(0, index)
					.reverse()
					.find((candidate) => candidate.trimEnd().endsWith('{'));

				if (selector && stateQualified.test(selector)) continue;

				offenders.push(`${path}:${index + 1} ${selector?.trim() ?? '<no selector>'}`);
			}
		}

		// `will-change` on a base class holds a compositor layer for the life of
		// the page: `.reel-frame` did it for every frame of the Mystery reel and
		// `.tools-stage` for one 210ms entrance on /draw.
		expect(offenders).toEqual([]);
	});
});
