import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { CanonicalUser } from '$lib/server/auth/types';
import {
	buildBaselineProfanityMatcher,
	buildPhraseMatcher,
	type TextModerationContext
} from '$lib/shared/moderation/text-policy';
import { moderationRepository } from './repository';
import type { ModerationRepository, TextModerationPolicyRecord } from './types';

type ModerationContext = {
	user?: (Pick<CanonicalUser, 'id' | 'role'> & Partial<CanonicalUser>) | null;
};

type ServiceDependencies = {
	now?: () => Date;
	repository?: ModerationRepository;
};

type UpdateTextModerationPoliciesInput = {
	policies: Partial<
		Record<
			TextModerationContext,
			{ allowlist: string[]; blocklist: string[]; expectedVersion: number }
		>
	>;
};

type SetViewerAdultContentEnabledInput = {
	enabled: boolean;
};

const POLICY_CONTEXTS: TextModerationContext[] = ['nickname', 'comment', 'artwork_title'];
const baselineMatcher = buildBaselineProfanityMatcher();

const blockedMessages: Record<TextModerationContext, string> = {
	artwork_title: 'Choose a different artwork title.',
	comment: 'This comment breaks the gallery rules.',
	nickname: 'Choose a different nickname.'
};

const getDependencies = (dependencies: ServiceDependencies = {}) => ({
	now: dependencies.now ?? (() => new Date()),
	repository: dependencies.repository ?? moderationRepository
});

const requireAdmin = (context: ModerationContext) => {
	if (!context.user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}

	if (context.user.role !== 'admin') {
		throw new ArtworkFlowError(403, 'Admin access required', 'FORBIDDEN');
	}

	return context.user;
};

const requireUser = (context: ModerationContext) => {
	if (!context.user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}

	return context.user;
};

const sortUnique = (values: string[]) =>
	Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) =>
		left.localeCompare(right)
	);

const buildPolicyMap = (records: TextModerationPolicyRecord[]) => {
	const entries = records.map((record) => [record.context, record] as const);

	return Object.fromEntries(entries) as Partial<
		Record<TextModerationContext, TextModerationPolicyRecord>
	>;
};

export const getTextModerationSnapshot = async (dependencies: ServiceDependencies = {}) => {
	const { repository } = getDependencies(dependencies);
	const records = buildPolicyMap(await repository.listTextPolicies());

	return {
		policies: Object.fromEntries(
			POLICY_CONTEXTS.map((context) => {
				const record = records[context];
				return [
					context,
					{
						allowlist: record?.allowlist ?? [],
						blocklist: record?.blocklist ?? [],
						version: record?.version ?? 0
					}
				];
			})
		) as Record<
			TextModerationContext,
			{ allowlist: string[]; blocklist: string[]; version: number }
		>
	};
};

export const checkTextModeration = async (
	value: string,
	context: TextModerationContext,
	dependencies: ServiceDependencies = {}
) => {
	if (baselineMatcher.hasMatch(value)) {
		return {
			message: blockedMessages[context],
			status: 'blocked' as const
		};
	}

	const snapshot = await getTextModerationSnapshot(dependencies);
	const policy = snapshot.policies[context];
	const matcher = buildPhraseMatcher({
		allowlist: policy.allowlist,
		blocklist: policy.blocklist
	});

	if (!matcher.hasMatch(value)) {
		return { status: 'allowed' as const };
	}

	return {
		message: blockedMessages[context],
		status: 'blocked' as const
	};
};

export const updateTextModerationPolicies = async (
	input: UpdateTextModerationPoliciesInput,
	context: ModerationContext,
	dependencies: ServiceDependencies = {}
) => {
	const admin = requireAdmin(context);
	const { now, repository } = getDependencies(dependencies);
	const updatedAt = now();

	for (const policyContext of POLICY_CONTEXTS) {
		const nextPolicy = input.policies[policyContext];
		if (!nextPolicy) {
			continue;
		}

		const updated = await repository.updateTextPolicy({
			allowlist: sortUnique(nextPolicy.allowlist),
			blocklist: sortUnique(nextPolicy.blocklist),
			context: policyContext,
			expectedVersion: nextPolicy.expectedVersion,
			updatedAt,
			updatedBy: admin.id
		});

		if (!updated) {
			throw new ArtworkFlowError(409, 'Policy version conflict', 'INVALID_POLICY_VERSION');
		}
	}

	return getTextModerationSnapshot({ repository });
};

export const getViewerContentPreferences = async (
	context: ModerationContext,
	dependencies: ServiceDependencies = {}
) => {
	const user = requireUser(context);
	const { repository } = getDependencies(dependencies);
	const preference = await repository.findViewerContentPreference(user.id);

	return {
		adultContentConsentedAt: preference?.adultContentConsentedAt ?? null,
		adultContentEnabled: preference?.adultContentEnabled ?? false,
		adultContentRevokedAt: preference?.adultContentRevokedAt ?? null
	};
};

export const setViewerAdultContentEnabled = async (
	input: SetViewerAdultContentEnabledInput,
	context: ModerationContext,
	dependencies: ServiceDependencies = {}
) => {
	const user = requireUser(context);
	const { now, repository } = getDependencies(dependencies);
	const currentTime = now();

	return repository.upsertViewerContentPreference({
		adultContentConsentedAt: input.enabled ? currentTime : null,
		adultContentEnabled: input.enabled,
		adultContentRevokedAt: input.enabled ? null : currentTime,
		updatedAt: currentTime,
		userId: user.id
	});
};
