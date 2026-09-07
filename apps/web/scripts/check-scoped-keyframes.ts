/**
 * The lint step's dead-animation guard. The detection rules live in
 * `src/lib/server/deploy/scoped-keyframes.ts`, where the vitest projects can
 * reach them; this file is the file walk and the report.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';
import {
	BUILT_IN_KEYFRAMES,
	describeDeadKeyframeReference,
	findDeadKeyframeReferences,
	readKeyframeNames
} from '../src/lib/server/deploy/scoped-keyframes';

const SOURCE_ROOT = new URL('../src/', import.meta.url).pathname;

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
		const location = relative(process.cwd(), file);

		for (const reference of findDeadKeyframeReferences(source, globalKeyframes)) {
			violations.push(describeDeadKeyframeReference(location, reference));
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
