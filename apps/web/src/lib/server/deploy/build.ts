import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_BUILD_DIR = 'build';

const collectJavaScriptFiles = async (directory: string): Promise<string[]> => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) {
				return collectJavaScriptFiles(entryPath);
			}

			return entry.name.endsWith('.js') ? [entryPath] : [];
		})
	);

	return files.flat();
};

export const ensureServerDependencyBundled = async (
	buildDirectory: string,
	dependencyName: string
) => {
	const serverDirectory = join(buildDirectory, 'server');
	const serverFiles = await collectJavaScriptFiles(serverDirectory);
	const escapedDependencyName = dependencyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const dependencyPattern = new RegExp(
		`from\\s+['\"]${escapedDependencyName}['\"]|import\\(\\s*['\"]${escapedDependencyName}['\"]\\s*\\)`,
		'u'
	);

	for (const serverFile of serverFiles) {
		const contents = await readFile(serverFile, 'utf8');

		if (dependencyPattern.test(contents)) {
			throw new Error(
				`Expected SSR build to bundle ${dependencyName}, but found a runtime import in ${serverFile}`
			);
		}
	}
};

export const ensureBuildOutput = async (buildDirectory: string) => {
	const entryPoint = join(buildDirectory, 'index.js');
	const handlerFile = join(buildDirectory, 'handler.js');

	try {
		await Promise.all([access(entryPoint), access(handlerFile)]);
	} catch {
		throw new Error(
			`Expected adapter-node build output at ${buildDirectory} (missing index.js or handler.js)`
		);
	}

	return entryPoint;
};
