/**
 * Svelte renames every `@keyframes` declared in a component's scoped <style> and
 * rewrites `animation` declarations only inside that same block. A Tailwind
 * `animate-[name_…]` utility (emitted into the global sheet) and an inline
 * `style="animation: name …"` attribute therefore name a keyframe that does not
 * exist, and the animation silently never runs — the app shipped three of those.
 *
 * This guard fails the lint step when either shape appears.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

const SOURCE_ROOT = new URL('../src/', import.meta.url).pathname;

// Tailwind ships these in the global sheet.
const BUILT_IN_KEYFRAMES = new Set(['spin', 'ping', 'pulse', 'bounce']);

const collectFiles = async (directory: string, extensions: string[]): Promise<string[]> => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = join(directory, entry.name);
			if (entry.isDirectory()) return await collectFiles(entryPath, extensions);
			return extensions.some((extension) => entry.name.endsWith(extension)) ? [entryPath] : [];
		})
	);

	return files.flat();
};

const readKeyframeNames = (source: string) =>
	[...source.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]!);

const stripStyleBlocks = (source: string) => source.replace(/<style[\s\S]*?<\/style>/g, '');

const main = async () => {
	const cssFiles = await collectFiles(SOURCE_ROOT, ['.css']);
	const globalKeyframes = new Set(BUILT_IN_KEYFRAMES);
	for (const file of cssFiles) {
		for (const name of readKeyframeNames(await readFile(file, 'utf8'))) {
			globalKeyframes.add(name);
		}
	}

	const violations: string[] = [];
	for (const file of await collectFiles(SOURCE_ROOT, ['.svelte'])) {
		const source = await readFile(file, 'utf8');
		const markup = stripStyleBlocks(source);
		const location = relative(process.cwd(), file);

		for (const match of markup.matchAll(/animate-\[([A-Za-z][A-Za-z0-9-]*)[_\]]/g)) {
			const name = match[1]!;
			if (globalKeyframes.has(name)) continue;
			violations.push(
				`${location}: animate-[${name}…] resolves to no global @keyframes. Declare the keyframes in a .css file, or move the animation into a class inside this component's <style>.`
			);
		}

		for (const match of markup.matchAll(/\banimation(-name)?\s*:\s*([\w-]+)/g)) {
			const name = match[2]!;
			if (name === 'none' || name === 'inherit' || name === 'initial' || name === 'unset') continue;
			violations.push(
				`${location}: inline "animation: ${name} …" can never resolve — Svelte does not rewrite keyframe names inside style attributes. Move it into a class in this component's <style>.`
			);
		}
	}

	if (violations.length > 0) {
		console.error('Dead CSS animations found:\n');
		for (const violation of violations) console.error(`  ${violation}`);
		console.error('');
		process.exit(1);
	}

	console.log('No dead keyframe references found.');
};

await main();
