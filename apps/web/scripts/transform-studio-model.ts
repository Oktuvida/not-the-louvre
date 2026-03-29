/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const sourceModelPath = resolve(appRoot, 'static/models/studio.glb');
const generatedComponentPath = resolve(appRoot, 'studio.svelte');
const generatedTransformedPath = resolve(appRoot, 'studio-transformed.glb');
const finalTransformedPath = resolve(appRoot, 'static/models/studio-transformed.glb');
const deprecatedTransformedPath = resolve(
	appRoot,
	'static/models/not-the-louvre-studio-transformed.glb'
);

function runTransformCommand(args: string[]) {
	execFileSync('bunx', ['@gltf-transform/cli', ...args], {
		cwd: appRoot,
		stdio: 'inherit'
	});
}

if (!existsSync(sourceModelPath)) {
	throw new Error(`Missing source model at ${sourceModelPath}`);
}

rmSync(generatedComponentPath, { force: true });
rmSync(generatedTransformedPath, { force: true });
rmSync(finalTransformedPath, { force: true });

copyFileSync(sourceModelPath, finalTransformedPath);

runTransformCommand([
	'prune',
	'static/models/studio-transformed.glb',
	'static/models/studio-transformed.glb'
]);
runTransformCommand([
	'draco',
	'static/models/studio-transformed.glb',
	'static/models/studio-transformed.glb'
]);

if (!existsSync(finalTransformedPath)) {
	throw new Error(`Expected transformed model at ${finalTransformedPath}`);
}

rmSync(generatedComponentPath, { force: true });
rmSync(generatedTransformedPath, { force: true });
rmSync(deprecatedTransformedPath, { force: true });

const sourceSize = statSync(sourceModelPath).size;
const transformedSize = statSync(finalTransformedPath).size;
const reductionPercent = Math.round((1 - transformedSize / sourceSize) * 100);

console.log(
	`Optimized studio.glb -> studio-transformed.glb with selective prune+draco (${Math.round(sourceSize / 1024)} KB -> ${Math.round(transformedSize / 1024)} KB, ${reductionPercent}% smaller)`
);
