import { describe, expect, it } from 'vitest';
import {
	applyEnvUpdates,
	parseEnvDocument,
	serializeEnvDocument,
	validateProductionEnv
} from './env';

describe('deploy env document helpers', () => {
	it('preserves comments and unrelated keys while updating shell-safe values', () => {
		const original = [
			'# Deploy env',
			'ORIGIN="https://old.example.com"',
			'SUPABASE_SECRET_KEY=old-secret',
			'EXTRA_FLAG=true',
			''
		].join('\n');

		const updated = applyEnvUpdates(parseEnvDocument(original), {
			DATABASE_URL: 'postgres://user:pass@example.com:5432/db?sslmode=require',
			ORIGIN: 'https://app.example.com',
			SUPABASE_SECRET_KEY: "secret with spaces and 'quotes'"
		});

		const serialized = serializeEnvDocument(updated);

		expect(serialized).toContain('# Deploy env');
		expect(serialized).toContain('ORIGIN="https://app.example.com"');
		expect(serialized).toContain('SUPABASE_SECRET_KEY="secret with spaces and \'quotes\'"');
		expect(serialized).toContain(
			'DATABASE_URL="postgres://user:pass@example.com:5432/db?sslmode=require"'
		);
		expect(serialized).toContain('EXTRA_FLAG=true');
	});
});

describe('validateProductionEnv', () => {
	it('accepts canonical production variables and applies runtime defaults', () => {
		const result = validateProductionEnv({
			BETTER_AUTH_SECRET: '12345678901234567890123456789012',
			DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
			ORIGIN: 'https://app.example.com',
			SUPABASE_ANON_KEY: 'anon',
			SUPABASE_JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
			SUPABASE_PUBLIC_URL: 'https://project.supabase.co',
			SUPABASE_SECRET_KEY: 'service-secret'
		});

		expect(result.errors).toEqual([]);
		expect(result.env.HOST).toBe('127.0.0.1');
		expect(result.env.PORT).toBe('3000');
	});

	it('accepts current alias names for realtime config', () => {
		const result = validateProductionEnv({
			BETTER_AUTH_SECRET: '12345678901234567890123456789012',
			DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
			ORIGIN: 'https://app.example.com',
			PUBLIC_SUPABASE_ANON_KEY: 'anon',
			PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
			SERVICE_ROLE_KEY: 'service-role',
			SUPABASE_JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz123456'
		});

		expect(result.errors).toEqual([]);
	});

	it('rejects conflicting storage credentials and insecure origins', () => {
		const result = validateProductionEnv({
			BETTER_AUTH_SECRET: 'short',
			DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
			ORIGIN: 'http://app.example.com',
			SUPABASE_ANON_KEY: 'anon',
			SUPABASE_JWT_SECRET: 'tiny',
			SUPABASE_PUBLIC_URL: 'https://project.supabase.co',
			SUPABASE_SECRET_KEY: 'secret-a',
			SERVICE_ROLE_KEY: 'secret-b'
		});

		expect(result.errors).toContain('ORIGIN must be an absolute https URL');
		expect(result.errors).toContain(
			'Exactly one storage credential must be configured: SUPABASE_SECRET_KEY or SERVICE_ROLE_KEY'
		);
		expect(result.errors).toContain('BETTER_AUTH_SECRET must be at least 32 characters');
		expect(result.errors).toContain('SUPABASE_JWT_SECRET must be at least 32 characters');
	});
});
