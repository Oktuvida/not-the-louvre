/**
 * Lets Bun run scripts that import app modules. They import each other as
 * `#lib/….js`, the way TypeScript and Vite expect, but the files are `.ts`;
 * this maps the alias onto the source the way Vite does. Preload it:
 *   bun --preload ./scripts/lib-alias.ts run scripts/<script>.ts
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { plugin } from 'bun';

const libRoot = fileURLToPath(new URL('../src/lib/', import.meta.url));

plugin({
	name: 'lib-alias',
	setup(build) {
		build.onResolve({ filter: /^#lib\// }, ({ path }) => {
			const file = libRoot + path.slice('#lib/'.length);
			const typescript = file.replace(/\.js$/, '.ts');
			return { path: existsSync(typescript) ? typescript : file };
		});
	}
});
