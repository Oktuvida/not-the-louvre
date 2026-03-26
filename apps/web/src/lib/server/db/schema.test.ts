import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
	account,
	artworkPublishRateLimits,
	artworks,
	authRateLimits,
	session,
	user,
	userRole,
	users
} from './schema';

describe('database schema namespaces', () => {
	it('places domain tables and enums in the app schema', () => {
		expect(getTableConfig(users).schema).toBe('app');
		expect(getTableConfig(authRateLimits).schema).toBe('app');
		expect(getTableConfig(artworks).schema).toBe('app');
		expect(getTableConfig(artworkPublishRateLimits).schema).toBe('app');
		expect(userRole.schema).toBe('app');
	});

	it('places Better Auth tables in the better_auth schema', () => {
		expect(getTableConfig(user).schema).toBe('better_auth');
		expect(getTableConfig(session).schema).toBe('better_auth');
		expect(getTableConfig(account).schema).toBe('better_auth');
	});

	it('requires artwork ownership and publish metadata fields', () => {
		const artworkColumns = getTableConfig(artworks).columns;
		const requiredColumns = [
			'id',
			'author_id',
			'title',
			'storage_key',
			'media_content_type',
			'media_size_bytes'
		];

		for (const columnName of requiredColumns) {
			const column = artworkColumns.find((candidate) => candidate.name === columnName);
			expect(column?.notNull, `${columnName} should be required`).toBe(true);
		}
	});

	it('tracks publish rate limits per actor in the app schema', () => {
		const rateLimitColumns = getTableConfig(artworkPublishRateLimits).columns;
		const actorKeyColumn = rateLimitColumns.find((candidate) => candidate.name === 'actor_key');
		const attemptCountColumn = rateLimitColumns.find(
			(candidate) => candidate.name === 'attempt_count'
		);

		expect(actorKeyColumn?.notNull).toBe(true);
		expect(attemptCountColumn?.notNull).toBe(true);
	});
});
