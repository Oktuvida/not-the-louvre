import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
	account,
	artworkComments,
	artworkEngagementRateLimits,
	artworkPublishRateLimits,
	artworkVoteValue,
	artworkVotes,
	artworks,
	authRateLimits,
	engagementRateLimitKind,
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
		expect(getTableConfig(artworkVotes).schema).toBe('app');
		expect(getTableConfig(artworkComments).schema).toBe('app');
		expect(getTableConfig(artworkEngagementRateLimits).schema).toBe('app');
		expect(getTableConfig(artworkPublishRateLimits).schema).toBe('app');
		expect(userRole.schema).toBe('app');
		expect(artworkVoteValue.schema).toBe('app');
		expect(engagementRateLimitKind.schema).toBe('app');
	});

	it('places Better Auth tables in the better_auth schema', () => {
		expect(getTableConfig(user).schema).toBe('better_auth');
		expect(getTableConfig(session).schema).toBe('better_auth');
		expect(getTableConfig(account).schema).toBe('better_auth');
	});

	it('requires artwork ownership, publish metadata, and engagement summary fields', () => {
		const artworkColumns = getTableConfig(artworks).columns;
		const requiredColumns = [
			'id',
			'author_id',
			'title',
			'storage_key',
			'media_content_type',
			'media_size_bytes',
			'score',
			'comment_count',
			'fork_count'
		];

		for (const columnName of requiredColumns) {
			const column = artworkColumns.find((candidate) => candidate.name === columnName);
			expect(column?.notNull, `${columnName} should be required`).toBe(true);
		}
	});

	it('stores optional parent lineage references for forked artworks', () => {
		const artworkColumns = getTableConfig(artworks).columns;
		const parentIdColumn = artworkColumns.find((candidate) => candidate.name === 'parent_id');

		expect(parentIdColumn).toBeDefined();
		expect(parentIdColumn?.notNull).toBe(false);
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

	it('stores one active vote per user and artwork', () => {
		const voteColumns = getTableConfig(artworkVotes).columns;
		const requiredColumns = ['id', 'artwork_id', 'user_id', 'value'];

		for (const columnName of requiredColumns) {
			const column = voteColumns.find((candidate) => candidate.name === columnName);
			expect(column?.notNull, `${columnName} should be required`).toBe(true);
		}
	});

	it('stores comments with chronological metadata and durable engagement rate limits', () => {
		const commentColumns = getTableConfig(artworkComments).columns;
		const rateLimitColumns = getTableConfig(artworkEngagementRateLimits).columns;

		expect(commentColumns.find((candidate) => candidate.name === 'artwork_id')?.notNull).toBe(true);
		expect(commentColumns.find((candidate) => candidate.name === 'author_id')?.notNull).toBe(true);
		expect(commentColumns.find((candidate) => candidate.name === 'body')?.notNull).toBe(true);
		expect(commentColumns.find((candidate) => candidate.name === 'created_at')?.notNull).toBe(true);

		expect(rateLimitColumns.find((candidate) => candidate.name === 'kind')?.notNull).toBe(true);
		expect(rateLimitColumns.find((candidate) => candidate.name === 'actor_key')?.notNull).toBe(
			true
		);
		expect(
			rateLimitColumns.find((candidate) => candidate.name === 'window_started_at')?.notNull
		).toBe(true);
	});
});
