import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { listArtworkDiscovery } from '$lib/server/artwork/read.service';
import { getViewerContentPreferences } from '$lib/server/moderation/service';
import { avatarService } from '$lib/server/user/avatar.service';
import { AuthFlowError } from '$lib/server/auth/errors';
import { ArtworkFlowError } from '$lib/server/artwork/errors';
import {
	toHomePreviewCards,
	toHomeSceneArtworkSlots
} from '$lib/features/home-entry-scene/state/home-entry.svelte';
import {
	getNicknameAvailability,
	recoverAccount,
	signInWithNickname,
	signOutCurrentSession,
	signUpWithNickname
} from '$lib/server/auth/service';
import {
	availabilitySchema,
	recoverSchema,
	signInSchema,
	signupSchema
} from '$lib/server/auth/validation';
import { getIp } from 'better-auth/api';
import { resolveUserAvatarUrl } from '$lib/user/avatar-url';

const INTEGRITY_FAILURE_MESSAGE = 'Authenticated session is missing its product user profile';

type HomeActionName = 'checkNickname' | 'recover' | 'saveAvatar' | 'signIn' | 'signOut' | 'signUp';

const toFailure = (action: HomeActionName, error: unknown, fallback: string) => {
	if (
		error instanceof AuthFlowError ||
		error instanceof ArtworkFlowError ||
		(typeof error === 'object' &&
			error !== null &&
			'status' in error &&
			'message' in error &&
			'code' in error)
	) {
		const authError = error as Pick<AuthFlowError, 'code' | 'message' | 'status'>;

		return fail(authError.status, {
			action,
			code: authError.code,
			message: authError.message
		});
	}

	if (error instanceof Error) {
		return fail(500, { action, message: error.message || fallback });
	}

	return fail(500, { action, message: fallback });
};

export const load: PageServerLoad = async ({ locals }) => {
	const [topDiscovery, viewerContentPreferences, studioDiscovery] = await Promise.all([
		listArtworkDiscovery(
			{ cursor: null, limit: 3, sort: 'top', window: 'all' },
			{ user: locals.user }
		),
		locals.user
			? getViewerContentPreferences({ user: locals.user })
			: Promise.resolve({ adultContentEnabled: false }),
		locals.user
			? listArtworkDiscovery(
					{ authorId: locals.user.id, cursor: null, limit: 50, sort: 'top', window: 'all' },
					{ user: locals.user }
				)
			: Promise.resolve(null)
	]);
	const topArtworks = toHomePreviewCards(topDiscovery.items);
	const adultContentEnabled = viewerContentPreferences.adultContentEnabled;
	const studioArtworks = studioDiscovery ? toHomeSceneArtworkSlots(studioDiscovery.items) : [];

	if (locals.integrityFailure) {
		return {
			auth: {
				integrityFailure: {
					message: INTEGRITY_FAILURE_MESSAGE,
					reason: locals.integrityFailure.reason
				},
				onboarding: null,
				status: 'integrity-failure',
				user: null
			},
			adultContentEnabled,
			studioArtworks: [],
			topArtworks
		};
	}

	if (!locals.user) {
		return {
			auth: {
				integrityFailure: null,
				onboarding: null,
				status: 'signed-out',
				user: null
			},
			adultContentEnabled,
			studioArtworks: [],
			topArtworks
		};
	}

	return {
		auth: {
			integrityFailure: null,
			onboarding: {
				status: locals.user.avatarOnboardingCompletedAt ? 'complete' : 'needs-avatar'
			},
			status: 'authenticated',
			user: {
				...locals.user,
				avatarUrl: resolveUserAvatarUrl(
					locals.user.id,
					locals.user.avatarUrl,
					locals.user.avatarUrl ? locals.user.updatedAt.getTime() : null
				)
			}
		},
		adultContentEnabled,
		studioArtworks,
		topArtworks
	};
};

export const actions: Actions = {
	checkNickname: async (event) => {
		const formData = await event.request.formData();
		const parsed = availabilitySchema.safeParse({
			nickname: formData.get('nickname')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'checkNickname',
				message: parsed.error.issues[0]?.message ?? 'Invalid nickname'
			});
		}

		const result = await getNicknameAvailability(parsed.data.nickname);

		return {
			action: 'checkNickname',
			availability: result.available ? 'available' : result.valid ? 'taken' : 'invalid'
		};
	},
	recover: async (event) => {
		const formData = await event.request.formData();
		const parsed = recoverSchema.safeParse({
			newPassword: formData.get('newPassword')?.toString() ?? '',
			nickname:
				formData.get('nickname')?.toString() ?? formData.get('recoveryNickname')?.toString() ?? '',
			recoveryKey: formData.get('recoveryKey')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'recover',
				message: parsed.error.issues[0]?.message ?? 'Invalid recovery input'
			});
		}

		try {
			const result = await recoverAccount(parsed.data, getIp(event.request, auth.options));

			return {
				action: 'recover',
				recoveryKey: result.recoveryKey,
				rotatedRecoveryKey: result.recoveryKey,
				success: true
			};
		} catch (error) {
			return toFailure('recover', error, 'Unexpected recovery error');
		}
	},
	saveAvatar: async (event) => {
		const formData = await event.request.formData();
		const file = formData.get('file');

		if (!(file instanceof File)) {
			return fail(400, {
				action: 'saveAvatar',
				message: 'Avatar file is required'
			});
		}

		try {
			const updatedUser = await avatarService.uploadAvatar(event.locals.user ?? null, file);

			if (event.locals.user) {
				event.locals.user = {
					...event.locals.user,
					avatarOnboardingCompletedAt: updatedUser.avatarOnboardingCompletedAt,
					avatarUrl: updatedUser.avatarUrl
				};
			}

			return {
				action: 'saveAvatar',
				avatarUrl:
					resolveUserAvatarUrl(
						updatedUser.id,
						updatedUser.avatarUrl,
						updatedUser.updatedAt.getTime()
					) ?? '',
				onboarding: 'complete',
				success: true
			};
		} catch (error) {
			return toFailure('saveAvatar', error, 'Unexpected avatar save error');
		}
	},
	signIn: async (event) => {
		const formData = await event.request.formData();
		const parsed = signInSchema.safeParse({
			nickname: formData.get('nickname')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'signIn',
				message: parsed.error.issues[0]?.message ?? 'Invalid sign-in input'
			});
		}

		try {
			const result = await signInWithNickname(
				parsed.data,
				getIp(event.request, auth.options),
				event.request.headers
			);

			event.locals.user = result.response.user;

			return { action: 'signIn', success: true };
		} catch (error) {
			return toFailure('signIn', error, 'Unexpected sign-in error');
		}
	},
	signOut: async (event) => {
		try {
			await signOutCurrentSession(event.request.headers);
			event.locals.authUser = undefined;
			event.locals.integrityFailure = undefined;
			event.locals.session = undefined;
			event.locals.user = undefined;

			return { action: 'signOut', success: true };
		} catch (error) {
			return toFailure('signOut', error, 'Unexpected sign-out error');
		}
	},
	signUp: async (event) => {
		const formData = await event.request.formData();
		const parsed = signupSchema.safeParse({
			nickname: formData.get('nickname')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, {
				action: 'signUp',
				message: parsed.error.issues[0]?.message ?? 'Invalid signup input'
			});
		}

		try {
			const result = await signUpWithNickname(parsed.data, event.request.headers);
			event.locals.user = result.response.user;

			return {
				action: 'signUp',
				onboarding: 'needs-avatar',
				recoveryKey: result.response.recoveryKey,
				success: true
			};
		} catch (error) {
			return toFailure('signUp', error, 'Unexpected registration error');
		}
	}
};
