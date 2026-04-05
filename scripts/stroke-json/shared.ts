import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PINNED_RUST_VERSION = '1.94.1';
export const PINNED_WASM_PACK_VERSION = '0.14.0';
export const REQUIRED_WASM_TARGET = 'wasm32-unknown-unknown';
export const GENERATED_WASM_RELATIVE_DIRECTORY = 'packages/stroke-json-runtime/generated/wasm';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(scriptDirectory, '..', '..');
export const generatedWasmDirectory = resolve(repoRoot, GENERATED_WASM_RELATIVE_DIRECTORY);
export const browserGeneratedWasmDirectory = resolve(generatedWasmDirectory, 'browser');
export const serverGeneratedWasmDirectory = resolve(generatedWasmDirectory, 'server');

type RunCommandOptions = {
	cwd?: string;
	allowFailure?: boolean;
	stdio?: 'inherit' | 'pipe';
	env?: NodeJS.ProcessEnv;
};

export const runCommand = (
	command: string,
	args: string[],
	options: RunCommandOptions = {}
) => {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? repoRoot,
		encoding: 'utf8',
		env: options.env ?? process.env,
		stdio: options.stdio ?? 'pipe'
	});

	if (result.status !== 0 && !options.allowFailure) {
		throw new Error(
			`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}${result.stderr ? `\n${result.stderr.trim()}` : ''}`
		);
	}

	return result;
};

const ensureVersion = (actual: string, expectedPrefix: string, commandDescription: string) => {
	if (!actual.startsWith(expectedPrefix)) {
		throw new Error(`Expected ${commandDescription} ${expectedPrefix}, found ${actual}`);
	}
};

export const ensureStrokeJsonToolchain = () => {
	const rustcVersion = runCommand('rustc', ['--version']);
	const cargoVersion = runCommand('cargo', ['--version']);
	const wasmPackVersion = runCommand('wasm-pack', ['--version']);
	const targetList = runCommand('rustup', ['target', 'list', '--installed']);

	ensureVersion(rustcVersion.stdout.trim(), `rustc ${PINNED_RUST_VERSION}`, 'rustc');
	ensureVersion(cargoVersion.stdout.trim(), `cargo ${PINNED_RUST_VERSION}`, 'cargo');
	ensureVersion(
		wasmPackVersion.stdout.trim(),
		`wasm-pack ${PINNED_WASM_PACK_VERSION}`,
		'wasm-pack'
	);

	const installedTargets = targetList.stdout
		.split('\n')
		.map((target) => target.trim())
		.filter(Boolean);

	if (!installedTargets.includes(REQUIRED_WASM_TARGET)) {
		throw new Error(
			`Required Rust target is not installed: ${REQUIRED_WASM_TARGET}. Install it with rustup target add ${REQUIRED_WASM_TARGET}.`
		);
	}
	};

export const cleanGeneratedWasmArtifacts = async () => {
	await rm(generatedWasmDirectory, { force: true, recursive: true });
	await mkdir(browserGeneratedWasmDirectory, { recursive: true });
	await mkdir(serverGeneratedWasmDirectory, { recursive: true });
};