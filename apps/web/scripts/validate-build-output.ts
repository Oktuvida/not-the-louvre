import { resolve } from 'node:path';
import process from 'node:process';
import {
	DEFAULT_BUILD_DIR,
	ensureBuildManifestExcludesRoutePrefix,
	ensureBuildOutput,
	ensureServerDependencyBundled
} from '../src/lib/server/deploy/build';

const buildDir = resolve(process.cwd(), DEFAULT_BUILD_DIR);

await ensureBuildOutput(buildDir);
await ensureServerDependencyBundled(buildDir, 'gsap');
await ensureBuildManifestExcludesRoutePrefix(buildDir, '/demo');

process.stdout.write(`Validated adapter-node build output at ${buildDir}\n`);
