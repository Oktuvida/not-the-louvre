import { cleanGeneratedWasmArtifacts } from './shared';

await cleanGeneratedWasmArtifacts();
process.stdout.write('Cleaned generated stroke-json WASM artifacts\n');