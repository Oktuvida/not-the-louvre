import { access, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const DEFAULT_CLOUDFLARE_BUILD_DIR = join('.svelte-kit', 'cloudflare');
const DEFAULT_CLOUDFLARE_MANIFEST_PATH = join('.svelte-kit', 'cloudflare-tmp', 'manifest.js');
const DEFAULT_SVELTEKIT_OUTPUT_DIR = join('.svelte-kit', 'output');

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

export const ensureWorkerBuildOutput = async (cloudflareBuildDirectory: string) => {
	const workerEntryPoint = join(cloudflareBuildDirectory, '_worker.js');

	try {
		await access(workerEntryPoint);
	} catch {
		throw new Error(
			`Expected adapter-cloudflare build output at ${cloudflareBuildDirectory} (missing _worker.js)`
		);
	}

	return workerEntryPoint;
};

const ensureManifestFileExcludesRoutePrefix = async (manifestPath: string, routePrefix: string) => {
	const manifestContents = await readFile(manifestPath, 'utf8');
	const escapedRoutePrefix = routePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const routePattern = new RegExp(`id:\\s+['"]${escapedRoutePrefix}(?:/|['"])`, 'u');

	if (routePattern.test(manifestContents)) {
		throw new Error(
			`Expected production build manifest to exclude routes under ${routePrefix}, but found them in ${manifestPath}`
		);
	}
};

export const ensureBuildManifestExcludesRoutePrefix = (
	buildDirectory: string,
	routePrefix: string
) =>
	ensureManifestFileExcludesRoutePrefix(join(buildDirectory, 'server', 'manifest.js'), routePrefix);

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

type ValidateCloudflareBuildOptions = {
	/** Assert the production manifest no longer carries the `/demo` routes. */
	requireDemoExclusion?: boolean;
	/** Assert gsap is bundled rather than imported at runtime by the SSR output. */
	requireGsapBundled?: boolean;
	/** Assert the adapter-cloudflare worker entrypoint exists. */
	requireWorkerOutput?: boolean;
};

/**
 * Single implementation of the post-build contract for `apps/web`.
 *
 * The production build asserts everything; the e2e build (plain `vite build`,
 * served by Node through `vite preview`, `/demo` intentionally kept) turns the
 * Worker-only assertions off.
 */
export const validateCloudflareBuild = async (
	projectRoot: string,
	{
		requireDemoExclusion = true,
		requireGsapBundled = true,
		requireWorkerOutput = true
	}: ValidateCloudflareBuildOptions = {}
) => {
	const cloudflareBuildDirectory = resolve(projectRoot, DEFAULT_CLOUDFLARE_BUILD_DIR);
	const cloudflareManifestPath = resolve(projectRoot, DEFAULT_CLOUDFLARE_MANIFEST_PATH);
	const svelteKitOutputDirectory = resolve(projectRoot, DEFAULT_SVELTEKIT_OUTPUT_DIR);

	if (requireWorkerOutput) {
		await ensureWorkerBuildOutput(cloudflareBuildDirectory);
	}

	if (requireGsapBundled) {
		await ensureServerDependencyBundled(svelteKitOutputDirectory, 'gsap');
	}

	if (requireDemoExclusion) {
		await ensureManifestFileExcludesRoutePrefix(cloudflareManifestPath, '/demo');
	}

	return cloudflareBuildDirectory;
};
