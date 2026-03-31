import { spawn } from 'node:child_process';
import process from 'node:process';

const rawArgs = process.argv.slice(2);
const allowHangAfterPass = rawArgs.includes('--allow-hang-after-pass');
const vitestArgs = rawArgs.filter((arg) => arg !== '--allow-hang-after-pass');

const child = spawn(
	process.execPath,
	['./node_modules/vitest/vitest.mjs', '--run', ...vitestArgs],
	{
		cwd: process.cwd(),
		env: process.env,
		stdio: ['inherit', 'pipe', 'pipe']
	}
);

let sawPassingFileSummary = false;
let sawPassingTestSummary = false;
let sawFailureSummary = false;
let sawHangWarning = false;

const passingFileSummaryPattern = /Test Files\s+\d+\s+passed(?:\s+\|\s+\d+\s+skipped)?\s+\(\d+\)/;
const passingTestSummaryPattern = /Tests\s+\d+\s+passed(?:\s+\|\s+\d+\s+skipped)?\s+\(\d+\)/;
const failureSummaryPattern =
	/Test Files\s+\d+\s+failed|Tests\s+\d+\s+failed|\bFAIL\b|\bAssertionError:/;
const hangWarningPattern =
	/close timed out after \d+ms|Tests closed successfully but something prevents the main process from exiting/;

const inspectChunk = (chunk) => {
	const text = chunk.toString();

	if (passingFileSummaryPattern.test(text)) {
		sawPassingFileSummary = true;
	}

	if (passingTestSummaryPattern.test(text)) {
		sawPassingTestSummary = true;
	}

	if (failureSummaryPattern.test(text)) {
		sawFailureSummary = true;
	}

	if (hangWarningPattern.test(text)) {
		sawHangWarning = true;
	}

	return text;
};

child.stdout.on('data', (chunk) => {
	process.stdout.write(inspectChunk(chunk));
});

child.stderr.on('data', (chunk) => {
	process.stderr.write(inspectChunk(chunk));
});

const forwardSignal = (signal) => {
	if (!child.killed) {
		child.kill(signal);
	}
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	const passedWithoutFailures =
		sawPassingFileSummary && sawPassingTestSummary && !sawFailureSummary;

	if (code === 0 || code === null) {
		process.exit(code ?? 0);
		return;
	}

	if (allowHangAfterPass && passedWithoutFailures && sawHangWarning) {
		process.stderr.write(
			'Vitest browser mode reported a shutdown hang after all tests passed; treating the run as successful.\n'
		);
		process.exit(0);
		return;
	}

	process.exit(code);
});
