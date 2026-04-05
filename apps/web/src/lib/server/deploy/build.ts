import { access, copyFile, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

export const DEFAULT_BUILD_DIR = 'build';
export const GENERATED_SERVER_WASM_RELATIVE_PATH = join(
	'generated',
	'wasm',
	'server',
	'stroke_json_wasm_bg.wasm'
);

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
		`from\\s+['"]${escapedDependencyName}['"]|import\\(\\s*['"]${escapedDependencyName}['"]\\s*\\)`,
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

export const ensureServerWasmAsset = async (buildDirectory: string) => {
	const wasmAssetPath = join(buildDirectory, 'server', GENERATED_SERVER_WASM_RELATIVE_PATH);

	try {
		await access(wasmAssetPath);
	} catch {
		throw new Error(`Expected built server runtime wasm asset at ${wasmAssetPath}`);
	}

	return wasmAssetPath;
};

export const ensureServerWasmReferenced = async (buildDirectory: string) => {
	const serverDirectory = join(buildDirectory, 'server');
	const serverFiles = await collectJavaScriptFiles(serverDirectory);

	for (const serverFile of serverFiles) {
		const contents = await readFile(serverFile, 'utf8');

		if (contents.includes('stroke_json_wasm_bg.wasm')) {
			return serverFile;
		}
	}

	throw new Error(
		`Expected SSR build to reference stroke_json_wasm_bg.wasm from emitted server output under ${serverDirectory}`
	);
};

export const syncGeneratedServerWasmAsset = async (
	buildDirectory: string,
	generatedServerWasmPath: string
) => {
	const targetWasmPath = join(buildDirectory, 'server', GENERATED_SERVER_WASM_RELATIVE_PATH);
	await mkdir(dirname(targetWasmPath), { recursive: true });
	await copyFile(generatedServerWasmPath, targetWasmPath);

	return targetWasmPath;
};

export const ensureBuildManifestExcludesRoutePrefix = async (
	buildDirectory: string,
	routePrefix: string
) => {
	const manifestPath = join(buildDirectory, 'server', 'manifest.js');
	const manifestContents = await readFile(manifestPath, 'utf8');
	const escapedRoutePrefix = routePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const routePattern = new RegExp(`id:\\s+['"]${escapedRoutePrefix}(?:/|['"])`, 'u');

	if (routePattern.test(manifestContents)) {
		throw new Error(
			`Expected production build manifest to exclude routes under ${routePrefix}, but found them in ${manifestPath}`
		);
	}
};

export const syncProductionRoutes = async (
	sourceRoutesDirectory: string,
	targetRoutesDirectory: string,
	excludedTopLevelEntries: string[]
) => {
	const excludedEntries = new Set(excludedTopLevelEntries.map((entry) => entry.toLowerCase()));
	const resolvedSourceDirectory = resolve(sourceRoutesDirectory);

	await rm(targetRoutesDirectory, { force: true, recursive: true });
	await mkdir(targetRoutesDirectory, { recursive: true });
	await cp(sourceRoutesDirectory, targetRoutesDirectory, {
		recursive: true,
		filter: (entryPath) => {
			const relativeEntryPath = relative(resolvedSourceDirectory, resolve(entryPath));

			if (relativeEntryPath === '') {
				return true;
			}

			const [topLevelEntry] = relativeEntryPath.split(/[/\\]/u);
			return !excludedEntries.has(topLevelEntry.toLowerCase());
		}
	});

	return targetRoutesDirectory;
};
