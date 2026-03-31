import adapter from '@sveltejs/adapter-node';
import { relative, sep } from 'node:path';

const routesDirectory = process.env.SVELTEKIT_ROUTES_DIR ?? 'src/routes';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, execept for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		}
	},
	kit: {
		adapter: adapter(),
		files: {
			routes: routesDirectory
		}
	}
};

export default config;
