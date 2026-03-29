import type { TextModerationContext } from '$lib/shared/moderation/text-policy';

export type TextModerationPolicyRecord = {
	allowlist: string[];
	blocklist: string[];
	context: TextModerationContext;
	createdAt: Date;
	updatedAt: Date;
	updatedBy: string | null;
	version: number;
};

export type ViewerContentPreferenceRecord = {
	adultContentConsentedAt: Date | null;
	adultContentEnabled: boolean;
	adultContentRevokedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	userId: string;
};

export type UpdateTextPolicyInput = {
	allowlist: string[];
	blocklist: string[];
	context: TextModerationContext;
	expectedVersion: number;
	updatedAt: Date;
	updatedBy: string;
};

export type UpsertViewerContentPreferenceInput = {
	adultContentConsentedAt: Date | null;
	adultContentEnabled: boolean;
	adultContentRevokedAt: Date | null;
	updatedAt: Date;
	userId: string;
};

export type ModerationRepository = {
	findViewerContentPreference(userId: string): Promise<ViewerContentPreferenceRecord | null>;
	listTextPolicies(): Promise<TextModerationPolicyRecord[]>;
	updateTextPolicy(input: UpdateTextPolicyInput): Promise<TextModerationPolicyRecord | null>;
	upsertViewerContentPreference(
		input: UpsertViewerContentPreferenceInput
	): Promise<ViewerContentPreferenceRecord>;
};
