import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The sketchbook cover press feedback lives across two files and only works
 * while they agree.
 *
 * `utilities.css` gives every button a global press feedback. It used to be
 * `transform: scale(0.98) !important`, so `.cover-front` cancelled it with
 * `transform: none !important` and moved the feedback to the whole cover. The
 * global rule is now the standalone `scale` property inside `@layer base`,
 * which composes with `transform` instead of replacing it — a lone
 * `transform: none` no longer cancels anything, and the cover would shrink on
 * every press again.
 *
 * So: the neutraliser has to pin `scale`, and it may only drop its
 * `!important` while the global rule stays layered. If either half moves back,
 * this fails.
 */
const componentPath = join(dirname(fileURLToPath(import.meta.url)), 'DrawingBookStage.svelte');

const globalUtilitiesPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../shared-ui/styles/utilities.css'
);

/** The declarations of the first rule whose selector matches, `null` if absent. */
const readDeclarations = (source: string, selector: string) => {
	const start = source.indexOf(`${selector} {`);
	if (start === -1) {
		return null;
	}

	const end = source.indexOf('}', start);
	return end === -1 ? null : source.slice(start + `${selector} {`.length, end);
};

describe('sketchbook cover press feedback', () => {
	it('is a layered, standalone `scale` in the global utilities', async () => {
		const utilities = await readFile(globalUtilitiesPath, 'utf8');
		const declarations = readDeclarations(utilities, 'button:active');

		expect(declarations).not.toBeNull();
		expect(declarations).toMatch(/^\s*scale:\s*0\.98;\s*$/);
		expect(utilities).not.toContain('transform: scale(0.98)');
		expect(utilities.slice(0, utilities.indexOf('button:active {'))).toContain('@layer base {');
	});

	it('is neutralised on the cover button by pinning `scale`, not only `transform`', async () => {
		const source = await readFile(componentPath, 'utf8');
		const declarations = readDeclarations(source, '.cover-front:active');

		expect(declarations).not.toBeNull();
		expect(declarations).toContain('scale: 1;');
		expect(declarations).toContain('transform: none;');
		// Unlayered scoped CSS already beats `@layer base`; `!important` here
		// would only make the rule impossible to override from a call site.
		expect(declarations).not.toContain('!important');
	});

	it('keeps the relocated press feedback on the whole cover', async () => {
		const source = await readFile(componentPath, 'utf8');
		const declarations = readDeclarations(source, '.book-cover:has(.cover-front:active)');

		expect(declarations).not.toBeNull();
		expect(declarations).toContain('transform: scale(0.985);');
	});
});
