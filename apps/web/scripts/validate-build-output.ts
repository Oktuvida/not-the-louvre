import { resolve } from 'node:path';
import process from 'node:process';
import { DEFAULT_BUILD_DIR, ensureBuildOutput } from '../src/lib/server/deploy/build';

const buildDir = resolve(process.cwd(), DEFAULT_BUILD_DIR);

await ensureBuildOutput(buildDir);

process.stdout.write(`Validated adapter-node build output at ${buildDir}\n`);
