import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
	applyEnvUpdates,
	createChildProcessEnv,
	envDocumentToRecord,
	parseEnvDocument,
	serializeEnvDocument,
	validateProductionEnv
} from '../../src/lib/server/deploy/env';
import { DEFAULT_BUILD_DIR, ensureBuildOutput } from '../../src/lib/server/deploy/build';
import { ensureCaddyGlobalEmail } from '../../src/lib/server/deploy/caddy';
import { renderCaddySite, renderSystemdUnit } from '../../src/lib/server/deploy/templates';

type CommandName = 'install' | 'deploy' | 'env:set' | 'env:edit' | 'status' | 'uninstall';

type CliOptions = {
	command: CommandName;
	flags: Map<string, string | boolean>;
	positionals: string[];
};

type DeployConfig = {
	appRoot: string;
	caddyfilePath: string;
	domain: string;
	email: string;
	envFilePath: string;
	host: string;
	nodePath: string;
	port: string;
	repoRoot: string;
	serviceName: string;
	serviceUser: string;
	systemdUnitPath: string;
	templatesDir: string;
	webRoot: string;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDirectory, '..', '..');
const repoRoot = resolve(webRoot, '..', '..');
const bunExecutablePath = process.execPath;

const runCommand = (
	command: string,
	args: string[],
	options: { cwd?: string; allowFailure?: boolean; env?: NodeJS.ProcessEnv } = {}
) => {
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: 'utf8',
		env: options.env ?? process.env,
		stdio: ['inherit', 'pipe', 'pipe']
	});

	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);

	if (result.status !== 0 && !options.allowFailure) {
		const failureDetail = result.error?.message ? `\n${result.error.message}` : '';
		throw new Error(
			`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}${failureDetail}`
		);
	}

	return result;
};

const parseCliOptions = (argv: string[]): CliOptions => {
	const [command, ...rest] = argv;

	if (!command) {
		throw new Error(
			'A command is required: install, deploy, env:set, env:edit, status, or uninstall'
		);
	}

	const flags = new Map<string, string | boolean>();
	const positionals: string[] = [];

	for (let index = 0; index < rest.length; index += 1) {
		const token = rest[index];

		if (!token.startsWith('--')) {
			positionals.push(token);
			continue;
		}

		const trimmedToken = token.slice(2);
		const [flagName, inlineValue] = trimmedToken.split('=', 2);

		if (inlineValue !== undefined) {
			flags.set(flagName, inlineValue);
			continue;
		}

		const nextToken = rest[index + 1];
		if (!nextToken || nextToken.startsWith('--')) {
			flags.set(flagName, true);
			continue;
		}

		flags.set(flagName, nextToken);
		index += 1;
	}

	return { command: command as CommandName, flags, positionals };
};

const getFlag = (options: CliOptions, key: string, fallback = '') => {
	const value = options.flags.get(key);
	return typeof value === 'string' ? value : fallback;
};

const hasFlag = (options: CliOptions, key: string) => options.flags.get(key) === true;

const resolveCommandPath = (command: string) => {
	const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});

	if (result.status !== 0) {
		return '';
	}

	return result.stdout.trim();
};

const resolveConfig = (options: CliOptions): DeployConfig => {
	const serviceName = getFlag(options, 'service-name', 'not-the-louvre');
	const serviceUser = getFlag(options, 'service-user', 'notthelouvre');
	const appRoot = getFlag(options, 'app-root', repoRoot);
	const envFilePath = getFlag(options, 'env-file', `/etc/${serviceName}/${serviceName}.env`);
	const nodePath = getFlag(options, 'node-path') || resolveCommandPath('node');
	const caddyfilePath = getFlag(options, 'caddyfile', '/etc/caddy/Caddyfile');

	if (!nodePath) {
		throw new Error('Unable to resolve a Node binary from PATH. Pass --node-path explicitly.');
	}

	return {
		appRoot,
		caddyfilePath,
		domain: getFlag(options, 'domain', process.env.DOMAIN ?? ''),
		email: getFlag(options, 'email', process.env.LETSENCRYPT_EMAIL ?? ''),
		envFilePath,
		host: getFlag(options, 'host', '127.0.0.1'),
		nodePath,
		port: getFlag(options, 'port', '3000'),
		repoRoot,
		serviceName,
		serviceUser,
		systemdUnitPath: getFlag(options, 'unit-file', `/etc/systemd/system/${serviceName}.service`),
		templatesDir: resolve(repoRoot, 'scripts/deploy/templates'),
		webRoot
	};
};

const ensureRoot = () => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		throw new Error('This command must be run as root');
	}
};

const ensureCommandExists = (command: string) => {
	const result = spawnSync('which', [command], { stdio: 'ignore' });
	if (result.status !== 0) {
		throw new Error(`Required command is not available: ${command}`);
	}
};

const parseNodeVersion = (versionText: string) => {
	const match = versionText.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/u);

	if (!match) {
		throw new Error(`Unable to parse Node version from: ${versionText}`);
	}

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		raw: `${match[1]}.${match[2]}.${match[3]}`
	};
};

const isSupportedNodeVersion = (version: { major: number; minor: number; patch: number }) => {
	if (version.major > 22) {
		return true;
	}

	if (version.major === 22) {
		return version.minor > 12 || (version.minor === 12 && version.patch >= 0);
	}

	if (version.major === 20) {
		return version.minor > 19 || (version.minor === 19 && version.patch >= 0);
	}

	return false;
};

const ensureNodeVersion = (nodePath: string) => {
	const result = spawnSync(nodePath, ['--version'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});

	if (result.status !== 0) {
		throw new Error(
			`Failed to read Node version from ${nodePath}${result.stderr ? `\n${result.stderr.trim()}` : ''}`
		);
	}

	const version = parseNodeVersion(result.stdout);

	if (!isSupportedNodeVersion(version)) {
		throw new Error(
			`Node 20.19+ or 22.12+ is required for builds, found ${version.raw} at ${nodePath}`
		);
	}
};

const prependNodePath = (nodePath: string, currentPath = '') => {
	const nodeDirectory = dirname(nodePath);
	return currentPath ? `${nodeDirectory}:${currentPath}` : nodeDirectory;
};

const ensureServiceAccount = (serviceUser: string) => {
	const groupResult = spawnSync('getent', ['group', serviceUser], { stdio: 'ignore' });
	if (groupResult.status !== 0) {
		runCommand('groupadd', ['--system', serviceUser]);
	}

	const userResult = spawnSync('id', ['-u', serviceUser], { stdio: 'ignore' });
	if (userResult.status !== 0) {
		runCommand('useradd', [
			'--system',
			'--gid',
			serviceUser,
			'--home-dir',
			'/nonexistent',
			'--shell',
			'/usr/sbin/nologin',
			serviceUser
		]);
	}
};

const updateManagedBlock = (existing: string, blockId: string, content: string) => {
	const start = `# BEGIN ${blockId} managed block`;
	const end = `# END ${blockId} managed block`;
	const block = `${start}\n${content.trim()}\n${end}`;

	if (existing.includes(start) && existing.includes(end)) {
		const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
		return existing.replace(pattern, block);
	}

	return `${existing.trimEnd()}\n\n${block}\n`;
};

const removeManagedBlock = (existing: string, blockId: string) => {
	const start = `# BEGIN ${blockId} managed block`;
	const end = `# END ${blockId} managed block`;
	const pattern = new RegExp(`\\n?${start}[\\s\\S]*?${end}\\n?`, 'm');
	return existing.replace(pattern, '\n').trimEnd() + '\n';
};

const ensureDirectory = async (path: string) => {
	await mkdir(path, { recursive: true });
};

const ensureEnvFile = async (config: DeployConfig) => {
	await ensureDirectory(dirname(config.envFilePath));

	if (!existsSync(config.envFilePath)) {
		const initialDocument = applyEnvUpdates(parseEnvDocument('# Production env\n'), {
			HOST: config.host,
			PORT: config.port
		});
		await writeFile(config.envFilePath, serializeEnvDocument(initialDocument), 'utf8');
		await chmod(config.envFilePath, 0o640);
		runCommand('chown', [`root:${config.serviceUser}`, config.envFilePath]);
	}
};

const readValidatedEnv = async (envFilePath: string) => {
	const text = await readFile(envFilePath, 'utf8');
	const document = parseEnvDocument(text);
	const validation = validateProductionEnv(envDocumentToRecord(document));
	return { document, text, validation };
};

const writeSystemFiles = async (config: DeployConfig) => {
	await ensureDirectory(dirname(config.systemdUnitPath));
	const systemdUnit = renderSystemdUnit({
		envFile: config.envFilePath,
		nodePath: config.nodePath,
		serviceName: config.serviceName,
		serviceUser: config.serviceUser,
		workingDirectory: resolve(config.appRoot, 'apps/web')
	});
	await writeFile(config.systemdUnitPath, systemdUnit, 'utf8');

	const existingCaddyfile = existsSync(config.caddyfilePath)
		? await readFile(config.caddyfilePath, 'utf8')
		: '';
	const caddyfileWithGlobalEmail = ensureCaddyGlobalEmail(
		existingCaddyfile,
		config.email,
		`${config.serviceName}:global`
	);
	const nextCaddyfile = updateManagedBlock(
		caddyfileWithGlobalEmail,
		config.serviceName,
		renderCaddySite({
			domain: config.domain,
			host: config.host,
			port: config.port
		})
	);
	await writeFile(config.caddyfilePath, nextCaddyfile, 'utf8');
	await runValidatedCaddy(config.caddyfilePath);
};

const runValidatedCaddy = async (caddyfilePath: string) => {
	runCommand('caddy', ['validate', '--config', caddyfilePath]);
};

const ensureServiceActive = (serviceName: string) => {
	const result = spawnSync('systemctl', ['is-active', '--quiet', serviceName]);
	if (result.status !== 0) {
		throw new Error(`${serviceName} is not active after restart`);
	}
};

const installCommand = async (options: CliOptions) => {
	ensureRoot();
	const config = resolveConfig(options);

	if (!config.domain || !config.email) {
		throw new Error('install requires --domain and --email');
	}

	for (const command of [
		'git',
		config.nodePath,
		'bun',
		'caddy',
		'systemctl'
	]) {
		ensureCommandExists(command);
	}

	ensureNodeVersion(config.nodePath);
	ensureServiceAccount(config.serviceUser);
	await ensureDirectory(resolve(config.appRoot, 'apps/web'));
	await ensureEnvFile(config);
	await writeSystemFiles(config);

	runCommand('systemctl', ['daemon-reload']);
	runCommand('systemctl', ['enable', '--now', 'caddy']);

	const { validation } = await readValidatedEnv(config.envFilePath);
	if (validation.errors.length === 0) {
		runCommand('systemctl', ['enable', '--now', config.serviceName]);
		ensureServiceActive(config.serviceName);
	} else {
		runCommand('systemctl', ['enable', config.serviceName]);
		process.stdout.write(
			`Created ${config.envFilePath}, but the app service was not started because the production env is incomplete:\n- ${validation.errors.join('\n- ')}\n`
		);
	}
	process.stdout.write('Install complete\n');
};

const deployCommand = async (options: CliOptions) => {
	const config = resolveConfig(options);
	const { validation } = await readValidatedEnv(config.envFilePath);

	if (validation.errors.length > 0) {
		throw new Error(`Production env is invalid:\n- ${validation.errors.join('\n- ')}`);
	}

	if (!hasFlag(options, 'skip-pull')) {
		runCommand('git', ['pull', '--ff-only'], { cwd: config.repoRoot });
	}

	runCommand(bunExecutablePath, ['install', '--frozen-lockfile'], { cwd: config.repoRoot });
	ensureCommandExists(config.nodePath);
	ensureNodeVersion(config.nodePath);
	const buildEnv = createChildProcessEnv(
		{
			...process.env,
			PATH: prependNodePath(config.nodePath, process.env.PATH)
		},
		validation.env
	);
	runCommand(bunExecutablePath, ['run', 'stroke-json:wasm:smoke'], {
		cwd: config.repoRoot,
		env: buildEnv
	});
	runCommand(bunExecutablePath, ['run', '--filter', '@not-the-louvre/web', 'build'], {
		cwd: config.repoRoot,
		env: buildEnv
	});
	await ensureBuildOutput(resolve(config.webRoot, DEFAULT_BUILD_DIR));
	runCommand(bunExecutablePath, ['run', '--filter', '@not-the-louvre/web', 'validate:build-output'], {
		cwd: config.repoRoot,
		env: buildEnv
	});
	runCommand('systemctl', ['restart', config.serviceName]);
	ensureServiceActive(config.serviceName);
	process.stdout.write(`Deploy complete for ${config.serviceName}\n`);
};

const envSetCommand = async (options: CliOptions) => {
	ensureRoot();
	const config = resolveConfig(options);
	const keyValues = options.positionals;

	if (keyValues.length === 0) {
		throw new Error('env:set requires at least one KEY=value pair');
	}

	const updates = Object.fromEntries(
		keyValues.map((entry) => {
			const separatorIndex = entry.indexOf('=');
			if (separatorIndex === -1) {
				throw new Error(`Invalid env assignment: ${entry}`);
			}

			return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)];
		})
	);

	const existingText = existsSync(config.envFilePath)
		? await readFile(config.envFilePath, 'utf8')
		: '';
	const nextDocument = applyEnvUpdates(parseEnvDocument(existingText), updates);
	const validation = validateProductionEnv(envDocumentToRecord(nextDocument));

	if (validation.errors.length > 0) {
		throw new Error(
			`Refusing to write invalid production env:\n- ${validation.errors.join('\n- ')}`
		);
	}

	await writeFile(config.envFilePath, serializeEnvDocument(nextDocument), 'utf8');
	await chmod(config.envFilePath, 0o640);
	runCommand('chown', [`root:${config.serviceUser}`, config.envFilePath]);
	runCommand('systemctl', ['restart', config.serviceName]);
	ensureServiceActive(config.serviceName);
	process.stdout.write(`Updated ${config.envFilePath}\n`);
};

const envEditCommand = async (options: CliOptions) => {
	ensureRoot();
	const config = resolveConfig(options);
	await ensureEnvFile(config);

	const editor = process.env.EDITOR || 'vi';
	const backupPath = `${config.envFilePath}.bak`;
	await copyFile(config.envFilePath, backupPath);

	const result = spawnSync(editor, [config.envFilePath], { stdio: 'inherit' });
	if (result.status !== 0) {
		await rm(backupPath, { force: true });
		throw new Error(`${editor} exited with code ${result.status ?? 'unknown'}`);
	}

	const { validation } = await readValidatedEnv(config.envFilePath);
	if (validation.errors.length > 0) {
		await copyFile(backupPath, config.envFilePath);
		await rm(backupPath, { force: true });
		throw new Error(
			`Edited env is invalid and has been restored:\n- ${validation.errors.join('\n- ')}`
		);
	}

	await rm(backupPath, { force: true });
	runCommand('systemctl', ['restart', config.serviceName]);
	ensureServiceActive(config.serviceName);
	process.stdout.write(`Edited ${config.envFilePath}\n`);
};

const statusCommand = async (options: CliOptions) => {
	const config = resolveConfig(options);
	const envExists = existsSync(config.envFilePath);

	process.stdout.write(`service: ${config.serviceName}\n`);
	process.stdout.write(`domain: ${config.domain || '(not configured)'}\n`);
	process.stdout.write(`upstream: ${config.host}:${config.port}\n`);
	process.stdout.write(`env file: ${config.envFilePath} (${envExists ? 'present' : 'missing'})\n`);

	if (envExists) {
		const { validation } = await readValidatedEnv(config.envFilePath);
		process.stdout.write(
			validation.errors.length === 0
				? 'env validation: ok\n'
				: `env validation:\n- ${validation.errors.join('\n- ')}\n`
		);
	}

	runCommand('systemctl', ['status', '--no-pager', config.serviceName], { allowFailure: true });
	if (existsSync(config.caddyfilePath)) {
		await runValidatedCaddy(config.caddyfilePath);
	}
};

const uninstallCommand = async (options: CliOptions) => {
	ensureRoot();
	const config = resolveConfig(options);

	runCommand('systemctl', ['disable', '--now', config.serviceName], { allowFailure: true });
	await rm(config.systemdUnitPath, { force: true });

	if (existsSync(config.caddyfilePath)) {
		const existing = await readFile(config.caddyfilePath, 'utf8');
		await writeFile(
			config.caddyfilePath,
			removeManagedBlock(
				removeManagedBlock(existing, `${config.serviceName}:global`),
				config.serviceName
			),
			'utf8'
		);
		await runValidatedCaddy(config.caddyfilePath);
		runCommand('systemctl', ['reload', 'caddy']);
	}

	if (hasFlag(options, 'delete-env')) {
		await rm(config.envFilePath, { force: true });
	}

	runCommand('systemctl', ['daemon-reload']);
	process.stdout.write(`Uninstalled ${config.serviceName}\n`);
};

const main = async () => {
	const options = parseCliOptions(process.argv.slice(2));

	switch (options.command) {
		case 'install':
			await installCommand(options);
			break;
		case 'deploy':
			await deployCommand(options);
			break;
		case 'env:set':
			await envSetCommand(options);
			break;
		case 'env:edit':
			await envEditCommand(options);
			break;
		case 'status':
			await statusCommand(options);
			break;
		case 'uninstall':
			await uninstallCommand(options);
			break;
		default:
			throw new Error(`Unsupported command: ${options.command satisfies never}`);
	}
};

await main();
