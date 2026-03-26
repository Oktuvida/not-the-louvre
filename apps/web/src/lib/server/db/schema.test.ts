import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { account, authRateLimits, session, user, userRole, users } from './schema';

describe('database schema namespaces', () => {
	it('places domain tables and enums in the app schema', () => {
		expect(getTableConfig(users).schema).toBe('app');
		expect(getTableConfig(authRateLimits).schema).toBe('app');
		expect(userRole.schema).toBe('app');
	});

	it('places Better Auth tables in the better_auth schema', () => {
		expect(getTableConfig(user).schema).toBe('better_auth');
		expect(getTableConfig(session).schema).toBe('better_auth');
		expect(getTableConfig(account).schema).toBe('better_auth');
	});
});
