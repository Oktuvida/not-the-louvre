import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
	account,
	artworkCommentRealtime,
	artworkComments,
	artworkEngagementRateLimits,
	artworkNsfwSource,
	artworkPublishRateLimits,
	contentReportStatus,
	artworkReportReason,
	artworkVoteRealtime,
	artworkVoteValue,
	artworkVotes,
	artworks,
	authRateLimits,
	contentReports,
	engagementRateLimitKind,
	moderationTextPolicies,
	moderationTextPolicyContext,
	session,
	user,
	userRole,
	users,
	viewerContentPreferences
} from './schema';

describe('database schema namespaces', () => {
	it('places domain tables and enums in the app schema', () => {
		expect(getTableConfig(users).schema).toBe('app');
		expect(getTableConfig(authRateLimits).schema).toBe('app');
		expect(getTableConfig(artworks).schema).toBe('app');
		expect(getTableConfig(artworkVotes).schema).toBe('app');
		expect(getTableConfig(artworkVoteRealtime).schema).toBe('app');
		expect(getTableConfig(artworkComments).schema).toBe('app');
		expect(getTableConfig(artworkCommentRealtime).schema).toBe('app');
		expect(getTableConfig(contentReports).schema).toBe('app');
		expect(getTableConfig(artworkEngagementRateLimits).schema).toBe('app');
		expect(getTableConfig(artworkPublishRateLimits).schema).toBe('app');
		expect(getTableConfig(moderationTextPolicies).schema).toBe('app');
		expect(getTableConfig(viewerContentPreferences).schema).toBe('app');
		expect(userRole.schema).toBe('app');
		expect(artworkVoteValue.schema).toBe('app');
		expect(artworkReportReason.schema).toBe('app');
		expect(contentReportStatus.schema).toBe('app');
		expect(engagementRateLimitKind.schema).toBe('app');
		expect(artworkNsfwSource.schema).toBe('app');
		expect(moderationTextPolicyContext.schema).toBe('app');
	});

	it('places Better Auth tables in the better_auth schema', () => {
		expect(getTableConfig(user).schema).toBe('better_auth');
		expect(getTableConfig(session).schema).toBe('better_auth');
		expect(getTableConfig(account).schema).toBe('better_auth');
	});

	it('tracks avatar onboarding completion separately from avatar media presence', () => {
		const userColumns = getTableConfig(users).columns;

		expect(userColumns.find((candidate) => candidate.name === 'avatar_url')?.notNull).toBe(false);
		expect(
			userColumns.find((candidate) => candidate.name === 'avatar_onboarding_completed_at')?.notNull
		).toBe(false);
		expect(userColumns.find((candidate) => candidate.name === 'avatar_is_nsfw')?.notNull).toBe(
			true
		);
		expect(userColumns.find((candidate) => candidate.name === 'avatar_is_hidden')?.notNull).toBe(
			true
		);
		expect(userColumns.find((candidate) => candidate.name === 'is_banned')?.notNull).toBe(true);
		expect(userColumns.find((candidate) => candidate.name === 'banned_at')?.notNull).toBe(false);
		expect(userColumns.find((candidate) => candidate.name === 'ban_reason')?.notNull).toBe(false);
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
			'is_nsfw',
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
		const nsfwSourceColumn = artworkColumns.find((candidate) => candidate.name === 'nsfw_source');
		const nsfwLabeledAtColumn = artworkColumns.find(
			(candidate) => candidate.name === 'nsfw_labeled_at'
		);

		expect(parentIdColumn).toBeDefined();
		expect(parentIdColumn?.notNull).toBe(false);
		expect(nsfwSourceColumn?.notNull).toBe(false);
		expect(nsfwLabeledAtColumn?.notNull).toBe(false);
	});

	it('stores db-backed text moderation policies per context', () => {
		const policyColumns = getTableConfig(moderationTextPolicies).columns;

		expect(policyColumns.find((candidate) => candidate.name === 'context')?.notNull).toBe(true);
		expect(policyColumns.find((candidate) => candidate.name === 'allowlist')?.notNull).toBe(true);
		expect(policyColumns.find((candidate) => candidate.name === 'blocklist')?.notNull).toBe(true);
		expect(policyColumns.find((candidate) => candidate.name === 'version')?.notNull).toBe(true);
	});

	it('stores viewer adult-content preferences separately from artworks', () => {
		const preferenceColumns = getTableConfig(viewerContentPreferences).columns;

		expect(preferenceColumns.find((candidate) => candidate.name === 'user_id')?.notNull).toBe(true);
		expect(
			preferenceColumns.find((candidate) => candidate.name === 'adult_content_enabled')?.notNull
		).toBe(true);
		expect(
			preferenceColumns.find((candidate) => candidate.name === 'adult_content_consented_at')
				?.notNull
		).toBe(false);
		expect(
			preferenceColumns.find((candidate) => candidate.name === 'adult_content_revoked_at')?.notNull
		).toBe(false);
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

	it('defines narrow realtime-safe vote and comment relations for artwork detail subscriptions', () => {
		const voteRealtimeColumns = getTableConfig(artworkVoteRealtime).columns;
		const commentRealtimeColumns = getTableConfig(artworkCommentRealtime).columns;

		expect(voteRealtimeColumns.map((candidate) => candidate.name)).toEqual([
			'id',
			'artwork_id',
			'value',
			'created_at',
			'updated_at'
		]);
		expect(commentRealtimeColumns.map((candidate) => candidate.name)).toEqual([
			'id',
			'artwork_id',
			'author_id',
			'body',
			'is_visible',
			'created_at',
			'updated_at'
		]);
	});

	it('stores hidden-state fields on artworks and comments', () => {
		const artworkColumns = getTableConfig(artworks).columns;
		const commentColumns = getTableConfig(artworkComments).columns;

		expect(artworkColumns.find((candidate) => candidate.name === 'is_hidden')?.notNull).toBe(true);
		expect(artworkColumns.find((candidate) => candidate.name === 'hidden_at')?.notNull).toBe(false);
		expect(commentColumns.find((candidate) => candidate.name === 'is_hidden')?.notNull).toBe(true);
		expect(commentColumns.find((candidate) => candidate.name === 'hidden_at')?.notNull).toBe(false);
	});

	it('stores reports with a single moderation target and structured reason metadata', () => {
		const reportConfig = getTableConfig(contentReports);
		const reportColumns = reportConfig.columns;

		expect(reportColumns.find((candidate) => candidate.name === 'reporter_id')?.notNull).toBe(true);
		expect(reportColumns.find((candidate) => candidate.name === 'artwork_id')?.notNull).toBe(false);
		expect(reportColumns.find((candidate) => candidate.name === 'comment_id')?.notNull).toBe(false);
		expect(reportColumns.find((candidate) => candidate.name === 'reason')?.notNull).toBe(true);
		expect(reportColumns.find((candidate) => candidate.name === 'status')?.notNull).toBe(true);
		expect(reportColumns.find((candidate) => candidate.name === 'reviewed_by')?.notNull).toBe(
			false
		);
		expect(reportColumns.find((candidate) => candidate.name === 'reviewed_at')?.notNull).toBe(
			false
		);
		expect(reportColumns.find((candidate) => candidate.name === 'details')?.notNull).toBe(false);

		expect(reportConfig.checks.map((constraint) => constraint.name)).toContain(
			'content_reports_single_target_check'
		);
		expect(reportConfig.checks.map((constraint) => constraint.name)).toContain(
			'content_reports_review_resolution_check'
		);
	});
});
