import { beforeEach, describe, expect, it } from 'vitest';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { CanonicalUser } from '$lib/server/auth/types';
import type {
	ModerationRepository,
	TextModerationPolicyRecord,
	ViewerContentPreferenceRecord
} from './types';

const now = new Date('2026-03-29T12:00:00.000Z');

const createUser = (role: CanonicalUser['role'] = 'user'): CanonicalUser => ({
	authUserId: `auth-${role}`,
	avatarOnboardingCompletedAt: null,
	avatarUrl: null,
	createdAt: now,
	email: `${role}@not-the-louvre.local`,
	emailVerified: true,
	id: `${role}-1`,
	image: null,
	isBanned: false,
	name: role,
	nickname: role,
	role,
	updatedAt: now
});

const createRepository = () => {
	const policies = new Map<string, TextModerationPolicyRecord>([
		[
			'nickname',
			{
				allowlist: [],
				blocklist: ['cabron'],
				context: 'nickname',
				createdAt: now,
				updatedAt: now,
				updatedBy: null,
				version: 1
			}
		],
		[
			'comment',
			{
				allowlist: ['classic nude study'],
				blocklist: ['nude'],
				context: 'comment',
				createdAt: now,
				updatedAt: now,
				updatedBy: null,
				version: 2
			}
		],
		[
			'artwork_title',
			{
				allowlist: [],
				blocklist: ['mierda'],
				context: 'artwork_title',
				createdAt: now,
				updatedAt: now,
				updatedBy: null,
				version: 3
			}
		]
	]);
	const preferences = new Map<string, ViewerContentPreferenceRecord>();

	const repository: ModerationRepository = {
		async findViewerContentPreference(userId) {
			return preferences.get(userId) ?? null;
		},
		async listTextPolicies() {
			return Array.from(policies.values()).sort((left, right) =>
				left.context.localeCompare(right.context)
			);
		},
		async upsertViewerContentPreference(input) {
			const next: ViewerContentPreferenceRecord = {
				...(preferences.get(input.userId) ?? {
					createdAt: input.updatedAt,
					userId: input.userId
				}),
				adultContentConsentedAt: input.adultContentConsentedAt,
				adultContentEnabled: input.adultContentEnabled,
				adultContentRevokedAt: input.adultContentRevokedAt,
				ambientAudioEnabled: input.ambientAudioEnabled,
				updatedAt: input.updatedAt
			};

			preferences.set(input.userId, next);
			return next;
		},
		async updateTextPolicy(input) {
			const current = policies.get(input.context) ?? null;
			if (!current || current.version !== input.expectedVersion) {
				return null;
			}

			const next: TextModerationPolicyRecord = {
				...current,
				allowlist: input.allowlist,
				blocklist: input.blocklist,
				updatedAt: input.updatedAt,
				updatedBy: input.updatedBy,
				version: current.version + 1
			};

			policies.set(input.context, next);
			return next;
		}
	};

	return { policies, preferences, repository };
};

describe('moderation service', () => {
	beforeEach(() => {
		// state is recreated per test
	});

	it('builds a public text policy snapshot grouped by context', async () => {
		const { getTextModerationSnapshot } = await import('./service');
		const { repository } = createRepository();

		const snapshot = await getTextModerationSnapshot({ repository });

		expect(snapshot.policies.nickname).toMatchObject({
			blocklist: ['cabron'],
			version: 1
		});
		expect(snapshot.policies.comment).toMatchObject({
			allowlist: ['classic nude study'],
			blocklist: ['nude'],
			version: 2
		});
		expect(snapshot.policies.artwork_title).toMatchObject({
			blocklist: ['mierda'],
			version: 3
		});
	});

	it('applies phrase policies to server-side text checks', async () => {
		const { checkTextModeration } = await import('./service');
		const { repository } = createRepository();

		await expect(
			checkTextModeration('mi mierda favorita', 'artwork_title', { repository })
		).resolves.toMatchObject({ status: 'blocked' });
		await expect(
			checkTextModeration('classic nude study', 'comment', { repository })
		).resolves.toMatchObject({ status: 'allowed' });
	});

	it('keeps the baseline profanity filter active when repository policies are empty', async () => {
		const { checkTextModeration } = await import('./service');
		const repository: ModerationRepository = {
			async findViewerContentPreference() {
				return null;
			},
			async listTextPolicies() {
				return [];
			},
			async updateTextPolicy() {
				return null;
			},
			async upsertViewerContentPreference() {
				throw new Error('not used');
			}
		};

		await expect(checkTextModeration('mierda', 'nickname', { repository })).resolves.toMatchObject({
			status: 'blocked'
		});
	});

	it('does not let custom allowlists disable the baseline profanity filter', async () => {
		const { checkTextModeration } = await import('./service');
		const { repository } = createRepository();

		await expect(
			checkTextModeration('classic nude study', 'comment', { repository })
		).resolves.toMatchObject({
			status: 'allowed'
		});
		await expect(checkTextModeration('mierda', 'nickname', { repository })).resolves.toMatchObject({
			status: 'blocked'
		});
	});

	it('allows admins to update text policies with optimistic concurrency', async () => {
		const { updateTextModerationPolicies } = await import('./service');
		const { policies, repository } = createRepository();

		const updated = await updateTextModerationPolicies(
			{
				policies: {
					comment: {
						allowlist: ['figure drawing'],
						blocklist: ['spoiler'],
						expectedVersion: 2
					}
				}
			},
			{ user: createUser('admin') },
			{ now: () => now, repository }
		);

		expect(updated.policies.comment).toMatchObject({
			allowlist: ['figure drawing'],
			blocklist: ['spoiler'],
			version: 3
		});
		expect(policies.get('comment')).toMatchObject({ version: 3 });
	});

	it('rejects non-admin text policy updates and version mismatches', async () => {
		const { updateTextModerationPolicies } = await import('./service');
		const { repository } = createRepository();

		await expect(
			updateTextModerationPolicies(
				{
					policies: {
						nickname: {
							allowlist: [],
							blocklist: ['otro'],
							expectedVersion: 1
						}
					}
				},
				{ user: createUser('moderator') },
				{ now: () => now, repository }
			)
		).rejects.toBeInstanceOf(ArtworkFlowError);

		await expect(
			updateTextModerationPolicies(
				{
					policies: {
						nickname: {
							allowlist: [],
							blocklist: ['otro'],
							expectedVersion: 99
						}
					}
				},
				{ user: createUser('admin') },
				{ now: () => now, repository }
			)
		).rejects.toMatchObject({ code: 'INVALID_POLICY_VERSION', status: 409 });
	});

	it('persists and revokes adult-content consent globally per viewer', async () => {
		const { getViewerContentPreferences, setViewerAdultContentEnabled } = await import('./service');
		const { preferences, repository } = createRepository();

		const enabled = await setViewerAdultContentEnabled(
			{ enabled: true },
			{ user: createUser('user') },
			{ now: () => now, repository }
		);

		expect(enabled).toMatchObject({
			adultContentConsentedAt: now,
			adultContentEnabled: true,
			adultContentRevokedAt: null
		});

		const revokedAt = new Date('2026-03-29T13:00:00.000Z');
		const disabled = await setViewerAdultContentEnabled(
			{ enabled: false },
			{ user: createUser('user') },
			{ now: () => revokedAt, repository }
		);

		expect(disabled).toMatchObject({
			adultContentEnabled: false,
			adultContentRevokedAt: revokedAt
		});
		expect(preferences.get('user-1')).toMatchObject({ adultContentEnabled: false });

		await expect(
			getViewerContentPreferences({ user: createUser('user') }, { repository })
		).resolves.toMatchObject({ adultContentEnabled: false });
	});

	it('keeps first-visit ambient audio unset until the viewer chooses and preserves adult-content state on audio updates', async () => {
		const {
			getViewerContentPreferences,
			setViewerAdultContentEnabled,
			setViewerAmbientAudioEnabled
		} = await import('./service');
		const { preferences, repository } = createRepository();

		await expect(
			getViewerContentPreferences({ user: createUser('user') }, { repository })
		).resolves.toMatchObject({ ambientAudioEnabled: null, adultContentEnabled: false });

		await setViewerAdultContentEnabled(
			{ enabled: true },
			{ user: createUser('user') },
			{ now: () => now, repository }
		);

		const disabledAudio = await setViewerAmbientAudioEnabled(
			{ enabled: false },
			{ user: createUser('user') },
			{ now: () => new Date('2026-03-29T14:00:00.000Z'), repository }
		);

		expect(disabledAudio).toMatchObject({
			adultContentEnabled: true,
			ambientAudioEnabled: false
		});
		expect(preferences.get('user-1')).toMatchObject({
			adultContentEnabled: true,
			ambientAudioEnabled: false
		});
	});
});
