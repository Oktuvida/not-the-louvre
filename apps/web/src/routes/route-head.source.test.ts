import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The document head has exactly one owner: the root layout renders SiteMeta,
 * which reads `page.data.meta`. A page that declares its own <title> ships a
 * second one — resolved in favour of the first during SSR, and compiled to a
 * bare `document.title = …` assignment on the client that races the layout's.
 * These routes used to do exactly that.
 */
const routesDirectory = dirname(fileURLToPath(import.meta.url));

const readRouteSource = async (relativePath: string) =>
	await readFile(join(routesDirectory, relativePath), 'utf8');

const collectSvelteFiles = async (directory: string): Promise<string[]> => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) return await collectSvelteFiles(entryPath);

			return entry.name.endsWith('.svelte') ? [entryPath] : [];
		})
	);

	return files.flat();
};

describe('route document head', () => {
	it('renders the only <title> from the root layout', async () => {
		const source = await readRouteSource('+layout.svelte');

		expect(source).toContain('<SiteMeta');
		expect(source).toContain('readRouteMeta(page.data)');
	});

	it('keeps the studio page out of the head', async () => {
		const source = await readRouteSource('../lib/features/studio-drawing/StudioDrawingPage.svelte');

		// The preload stays: only <title> has a single owner.
		expect(source).not.toContain('<title>');
		expect(source).toContain('<link rel="preload" as="image" href="/table.avif"');
	});

	it('keeps the ops dashboard out of the head', async () => {
		const source = await readRouteSource('admin/+page.svelte');

		expect(source).not.toContain('<title>');
	});

	it('keeps every demo page out of the head', async () => {
		// The demo routes are stripped from the production build, but they run in
		// dev and in Playwright, where the duplicate-<title> race is the same one.
		// Each of them names itself through `meta` in its own `load` instead.
		const demoPages = await collectSvelteFiles(join(routesDirectory, 'demo'));

		expect(demoPages.length).toBeGreaterThan(0);

		for (const demoPage of demoPages) {
			const source = await readFile(demoPage, 'utf8');

			expect(
				source.includes('<title>'),
				`${relative(routesDirectory, demoPage)} declares its own <title>`
			).toBe(false);
		}
	});

	it('keeps the error page out of the head', async () => {
		const source = await readRouteSource('+error.svelte');

		// The status still reaches the visitor through the page's own headline;
		// only the duplicate <title> is gone.
		expect(source).not.toContain('<title>');
		expect(source).toContain('{status}');
	});
});
