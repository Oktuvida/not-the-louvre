type RawLine = {
	type: 'raw';
	raw: string;
};

type EntryLine = {
	type: 'entry';
	key: string;
	value: string;
	raw: string;
	modified: boolean;
};

export type EnvDocumentLine = RawLine | EntryLine;

export type EnvDocument = {
	lines: EnvDocumentLine[];
};

export type ProductionEnvValidation = {
	env: Record<string, string>;
	errors: string[];
};

export const createChildProcessEnv = (
	baseEnv: Record<string, string | undefined>,
	productionEnv: Record<string, string>
): NodeJS.ProcessEnv => ({
	...baseEnv,
	...productionEnv,
	NODE_ENV: baseEnv.NODE_ENV ?? 'production'
});

const ENV_ENTRY_PATTERN = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
const SIMPLE_ENV_VALUE_PATTERN = /^[A-Za-z0-9_.-]+$/;
const MIN_SECRET_LENGTH = 32;

const decodeDoubleQuotedValue = (value: string) => value.replace(/\\(["\\nrt$`])/g, '$1');

const parseEnvValue = (rawValue: string) => {
	const trimmedValue = rawValue.trim();

	if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
		return decodeDoubleQuotedValue(trimmedValue.slice(1, -1));
	}

	if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
		return trimmedValue.slice(1, -1);
	}

	return trimmedValue;
};

const encodeEnvValue = (value: string) => {
	if (value.length > 0 && SIMPLE_ENV_VALUE_PATTERN.test(value)) {
		return value;
	}

	const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `"${escapedValue}"`;
};

const cloneLine = (line: EnvDocumentLine): EnvDocumentLine =>
	line.type === 'raw' ? { ...line } : { ...line };

const isAbsoluteHttpsOrigin = (value: string) => {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.origin === value;
	} catch {
		return false;
	}
};

export const parseEnvDocument = (text: string): EnvDocument => ({
	lines: text.split(/\r?\n/).map((rawLine) => {
		const match = ENV_ENTRY_PATTERN.exec(rawLine);

		if (!match) {
			return { type: 'raw', raw: rawLine } satisfies RawLine;
		}

		return {
			type: 'entry',
			key: match[1],
			value: parseEnvValue(match[2]),
			raw: rawLine,
			modified: false
		} satisfies EntryLine;
	})
});

export const envDocumentToRecord = (document: EnvDocument) => {
	const entries = document.lines.filter((line): line is EntryLine => line.type === 'entry');
	return Object.fromEntries(entries.map((line) => [line.key, line.value]));
};

export const applyEnvUpdates = (
	document: EnvDocument,
	updates: Record<string, string>
): EnvDocument => {
	const nextLines = document.lines.map(cloneLine);
	const seenKeys = new Set<string>();

	for (const [key, value] of Object.entries(updates)) {
		const line = nextLines.find(
			(candidate): candidate is EntryLine => candidate.type === 'entry' && candidate.key === key
		);

		if (line) {
			line.value = value;
			line.modified = true;
			seenKeys.add(key);
			continue;
		}

		nextLines.push({ type: 'entry', key, value, raw: '', modified: true });
		seenKeys.add(key);
	}

	return { lines: nextLines };
};

export const serializeEnvDocument = (document: EnvDocument) =>
	`${document.lines
		.map((line) => {
			if (line.type === 'raw') {
				return line.raw;
			}

			if (!line.modified) {
				return line.raw;
			}

			return `${line.key}=${encodeEnvValue(line.value)}`;
		})
		.join('\n')}\n`;

export const validateProductionEnv = (
	input: Record<string, string | undefined>
): ProductionEnvValidation => {
	const env = Object.fromEntries(
		Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
	);
	const errors: string[] = [];

	if (!env.HOST) env.HOST = '127.0.0.1';
	if (!env.PORT) env.PORT = '3000';
	if (!env.ARTWORK_STORAGE_BUCKET) env.ARTWORK_STORAGE_BUCKET = 'artworks';

	const requireKey = (key: string) => {
		if (!env[key]) {
			errors.push(`${key} is required`);
		}
	};

	requireKey('DATABASE_URL');
	requireKey('ORIGIN');
	requireKey('BETTER_AUTH_SECRET');
	requireKey('SUPABASE_JWT_SECRET');

	const publicUrl = env.SUPABASE_PUBLIC_URL || env.PUBLIC_SUPABASE_URL;
	const anonKey = env.SUPABASE_ANON_KEY || env.PUBLIC_SUPABASE_ANON_KEY || env.ANON_KEY;
	const storageCredentialCount =
		Number(Boolean(env.SUPABASE_SECRET_KEY)) + Number(Boolean(env.SERVICE_ROLE_KEY));

	if (!publicUrl) {
		errors.push('A public Supabase URL is required: SUPABASE_PUBLIC_URL or PUBLIC_SUPABASE_URL');
	} else if (!env.SUPABASE_PUBLIC_URL) {
		env.SUPABASE_PUBLIC_URL = publicUrl;
	}

	if (!anonKey) {
		errors.push(
			'A Supabase anon key is required: SUPABASE_ANON_KEY, PUBLIC_SUPABASE_ANON_KEY, or ANON_KEY'
		);
	} else if (!env.SUPABASE_ANON_KEY) {
		env.SUPABASE_ANON_KEY = anonKey;
	}

	if (storageCredentialCount !== 1) {
		errors.push(
			'Exactly one storage credential must be configured: SUPABASE_SECRET_KEY or SERVICE_ROLE_KEY'
		);
	}

	if (env.ORIGIN && !isAbsoluteHttpsOrigin(env.ORIGIN)) {
		errors.push('ORIGIN must be an absolute https URL');
	}

	if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length < MIN_SECRET_LENGTH) {
		errors.push(`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
	}

	if (env.SUPABASE_JWT_SECRET && env.SUPABASE_JWT_SECRET.length < MIN_SECRET_LENGTH) {
		errors.push(`SUPABASE_JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
	}

	return { env, errors };
};
