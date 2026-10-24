import { fail } from '@sveltejs/kit';
import { openStoredDrawingDocument } from '#lib/server/drawing-document/document-store.js';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import { listArtworkDiscovery } from '#lib/server/artwork/read.service.js';
import { avatarService } from '#lib/server/user/avatar.service.js';
import { userRepository } from '#lib/server/user/repository.js';
import { toActionFailure } from '#lib/server/http/errors.js';
import {
	homeSceneArtworkSlotNames,
	toHomePreviewCards,
	toHomeSceneArtworkSlots
} from '#lib/features/home-entry-scene/state/home-entry.svelte.js';
import {
	getNicknameAvailability,
	recoverAccount,
	signInWithNickname,
	signOutCurrentSession,
	signUpWithNickname
} from '#lib/server/auth/service.js';
import {
	availabilitySchema,
	recoverSchema,
	signInSchema,
	signupSchema
} from '#lib/server/auth/validation.js';
import { getIP } from 'better-auth/api';
import { resolveUserAvatarUrl } from '#lib/user/avatar-url.js';

const INTEGRITY_FAILURE_MESSAGE = 'Authenticated session is missing its product user profile';

// The studio wall has exactly one frame per slot name, and
// toHomeSceneArtworkSlots drops everything past them.
const HOME_SCENE_ARTWORK_SLOT_COUNT = homeSceneArtworkSlotNames.length;

type HomeActionName = 'checkNickname' | 'recover' | 'saveAvatar' | 'signIn' | 'signOut' | 'signUp';

// Every home action answers with the shared envelope plus its own discriminator.
const toFailure = (action: HomeActionName, error: unknown, fallback: string) =>
	toActionFailure(error, {
		extra: { action },
		fallbackMessage: fallback,
		scope: `home ${action} action`
	});

export const load: PageServerLoad = async ({ locals, parent }) => {
	const [topDiscovery, parentData, studioDiscovery, avatarUserRecord] = await Promise.all([
		listArtworkDiscovery(
			{ cursor: null, limit: 3, sort: 'top', window: 'all' },
			{ user: locals.user }
		),
		parent(),
		locals.user
			? listArtworkDiscovery(
					{
						authorId: locals.user.id,
						cursor: null,
						// The studio wall has exactly HOME_SCENE_ARTWORK_SLOT_COUNT
						// frames; asking for more pulled placeholder data URIs and
						// vote subqueries for rows no mapper ever read, and left the
						// wall showing the lowest-scoring slice of the page.
						limit: HOME_SCENE_ARTWORK_SLOT_COUNT,
						sort: 'top',
						window: 'all'
					},
					{ user: locals.user }
				)
			: Promise.resolve(null),
		locals.user ? userRepository.findUserById(locals.user.id) : Promise.resolve(null)
	]);
	const topArtworks = toHomePreviewCards(topDiscovery.items);
	const adultContentEnabled = parentData.adultContentEnabled;
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
				avatarDrawingDocument: avatarUserRecord
					? await openStoredDrawingDocument({
							key: avatarUserRecord.avatarDocumentKey ?? null,
							legacyBase64: avatarUserRecord.avatarDocument ?? null,
							version: avatarUserRecord.avatarDocumentVersion ?? null
						})
					: null,
				avatarUrl: resolveUserAvatarUrl(locals.user.id, locals.user.avatarUrl)
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
			const result = await recoverAccount(parsed.data, getIP(event.request, auth.options));

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
		const drawingDocument = formData.get('drawingDocument')?.toString() ?? '';

		if (!drawingDocument.trim()) {
			return fail(400, {
				action: 'saveAvatar',
				message: 'Avatar drawing document is required'
			});
		}

		try {
			const updatedUser = await avatarService.uploadAvatar(
				event.locals.user ?? null,
				drawingDocument
			);

			if (event.locals.user) {
				event.locals.user = {
					...event.locals.user,
					avatarOnboardingCompletedAt: updatedUser.avatarOnboardingCompletedAt,
					avatarUrl: updatedUser.avatarUrl
				};
			}

			return {
				action: 'saveAvatar',
				avatarUrl: resolveUserAvatarUrl(updatedUser.id, updatedUser.avatarUrl) ?? '',
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
				getIP(event.request, auth.options),
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
