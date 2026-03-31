import { access } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_BUILD_DIR = 'build';

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
