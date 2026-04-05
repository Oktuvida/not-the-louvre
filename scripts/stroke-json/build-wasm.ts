import {
	browserGeneratedWasmDirectory,
	cleanGeneratedWasmArtifacts,
	ensureStrokeJsonToolchain,
	repoRoot,
	runCommand,
	serverGeneratedWasmDirectory
} from './shared';

ensureStrokeJsonToolchain();
await cleanGeneratedWasmArtifacts();

for (const outputDirectory of [browserGeneratedWasmDirectory, serverGeneratedWasmDirectory]) {
	runCommand(
		'wasm-pack',
		[
			'build',
			'crates/stroke-json-wasm',
			'--target',
			'web',
			'--release',
			'--out-dir',
			outputDirectory,
			'--out-name',
			'stroke_json_wasm'
		],
		{ cwd: repoRoot, stdio: 'inherit' }
	);
}

process.stdout.write('Built authoritative stroke-json WASM artifacts\n');