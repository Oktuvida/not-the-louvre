import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { moderationTextPolicies, viewerContentPreferences } from '$lib/server/db/schema';
import type {
	ModerationRepository,
	UpdateTextPolicyInput,
	UpsertViewerContentPreferenceInput,
	ViewerContentPreferenceRecord
} from './types';

const mapViewerPreference = (
	row: typeof viewerContentPreferences.$inferSelect
): ViewerContentPreferenceRecord => ({
	adultContentConsentedAt: row.adultContentConsentedAt,
	adultContentEnabled: row.adultContentEnabled,
	adultContentRevokedAt: row.adultContentRevokedAt,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
	userId: row.userId
});

export const moderationRepository: ModerationRepository = {
	async findViewerContentPreference(userId) {
		const row = await db.query.viewerContentPreferences.findFirst({
			where: eq(viewerContentPreferences.userId, userId)
		});

		return row ? mapViewerPreference(row) : null;
	},

	async listTextPolicies() {
		return db.query.moderationTextPolicies.findMany({
			orderBy: (table, { asc }) => [asc(table.context)]
		});
	},

	async updateTextPolicy(input: UpdateTextPolicyInput) {
		const [record] = await db
			.update(moderationTextPolicies)
			.set({
				allowlist: input.allowlist,
				blocklist: input.blocklist,
				updatedAt: input.updatedAt,
				updatedBy: input.updatedBy,
				version: input.expectedVersion + 1
			})
			.where(
				and(
					eq(moderationTextPolicies.context, input.context),
					eq(moderationTextPolicies.version, input.expectedVersion)
				)
			)
			.returning();

		return record ?? null;
	},

	async upsertViewerContentPreference(input: UpsertViewerContentPreferenceInput) {
		const [record] = await db
			.insert(viewerContentPreferences)
			.values({
				adultContentConsentedAt: input.adultContentConsentedAt,
				adultContentEnabled: input.adultContentEnabled,
				adultContentRevokedAt: input.adultContentRevokedAt,
				updatedAt: input.updatedAt,
				userId: input.userId
			})
			.onConflictDoUpdate({
				target: viewerContentPreferences.userId,
				set: {
					adultContentConsentedAt: input.adultContentConsentedAt,
					adultContentEnabled: input.adultContentEnabled,
					adultContentRevokedAt: input.adultContentRevokedAt,
					updatedAt: input.updatedAt
				}
			})
			.returning();

		return mapViewerPreference(record);
	}
};
