import {
	ensureGeneratedWasmArtifacts,
	initializeGeneratedServerRuntime
} from '../../apps/web/src/lib/server/deploy/stroke-json-runtime';
import { generatedWasmDirectory, serverGeneratedWasmDirectory } from './shared';

await ensureGeneratedWasmArtifacts(generatedWasmDirectory);
const version = await initializeGeneratedServerRuntime(serverGeneratedWasmDirectory);
process.stdout.write(`Initialized generated stroke-json server runtime ${version}\n`);