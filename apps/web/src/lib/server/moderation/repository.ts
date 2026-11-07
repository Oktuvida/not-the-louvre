import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { moderationTextPolicies, viewerContentPreferences } from '#lib/server/db/schema.js';
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
	ambientAudioEnabled: row.ambientAudioEnabled,
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
		const saved = {
			allowlist: input.allowlist,
			blocklist: input.blocklist,
			updatedAt: input.updatedAt,
			updatedBy: input.updatedBy,
			version: input.expectedVersion + 1
		};
		// A context nobody has saved yet has no row: the snapshot reads it as
		// version 0, and an update alone would refuse its first save for ever.
		const [record] = await db
			.insert(moderationTextPolicies)
			.values({ ...saved, context: input.context })
			.onConflictDoUpdate({
				set: saved,
				target: moderationTextPolicies.context,
				where: eq(moderationTextPolicies.version, input.expectedVersion)
			})
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
				ambientAudioEnabled: input.ambientAudioEnabled,
				updatedAt: input.updatedAt,
				userId: input.userId
			})
			.onConflictDoUpdate({
				target: viewerContentPreferences.userId,
				set: {
					adultContentConsentedAt: input.adultContentConsentedAt,
					adultContentEnabled: input.adultContentEnabled,
					adultContentRevokedAt: input.adultContentRevokedAt,
					ambientAudioEnabled: input.ambientAudioEnabled,
					updatedAt: input.updatedAt
				}
			})
			.returning();

		return mapViewerPreference(record);
	}
};
