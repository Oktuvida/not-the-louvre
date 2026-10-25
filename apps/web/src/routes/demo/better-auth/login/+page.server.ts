import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import { getIP } from 'better-auth/api';
import type { RouteMeta } from '#lib/features/shared-ui/site-meta.js';
import { toActionFailure } from '#lib/server/http/errors.js';
import {
	getNicknameAvailability,
	recoverAccount,
	signInWithNickname,
	signUpWithNickname
} from '#lib/server/auth/service.js';
import {
	availabilitySchema,
	recoverSchema,
	signInSchema,
	signupSchema
} from '#lib/server/auth/validation.js';

const toFailure = (error: unknown, fallback: string) =>
	toActionFailure(error, { fallbackMessage: fallback, scope: 'demo auth action' });

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		throw redirect(302, '/demo/better-auth');
	}
	return {
		// The root layout renders the only <title>; the route names itself here.
		meta: { title: 'Nickname Auth Demo' } satisfies RouteMeta,
		recoveryKey: event.url.searchParams.get('recoveryKey') ?? undefined
	};
};

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const parsed = signInSchema.safeParse({
			nickname: formData.get('nickname')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid sign-in input' });
		}

		try {
			await signInWithNickname(
				parsed.data,
				getIP(event.request, auth.options),
				event.request.headers
			);
		} catch (error) {
			return toFailure(error, 'Unexpected sign-in error');
		}

		throw redirect(302, '/demo/better-auth');
	},
	signUp: async (event) => {
		const formData = await event.request.formData();
		const parsed = signupSchema.safeParse({
			nickname: formData.get('nickname')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid signup input' });
		}

		let recoveryKey: string;
		try {
			const result = await signUpWithNickname(parsed.data, event.request.headers);
			recoveryKey = result.response.recoveryKey;
		} catch (error) {
			return toFailure(error, 'Unexpected registration error');
		}

		throw redirect(302, `/demo/better-auth?recoveryKey=${encodeURIComponent(recoveryKey)}`);
	},
	checkNickname: async (event) => {
		const formData = await event.request.formData();
		const parsed = availabilitySchema.safeParse({
			nickname: formData.get('nickname')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid nickname' });
		}

		const result = await getNicknameAvailability(parsed.data.nickname);
		return {
			availability: result.available ? 'available' : result.valid ? 'taken' : 'invalid'
		};
	},
	recover: async (event) => {
		const formData = await event.request.formData();
		const parsed = recoverSchema.safeParse({
			nickname: formData.get('recoveryNickname')?.toString() ?? '',
			recoveryKey: formData.get('recoveryKey')?.toString() ?? '',
			newPassword: formData.get('newPassword')?.toString() ?? ''
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid recovery input' });
		}

		try {
			const result = await recoverAccount(parsed.data, getIP(event.request, auth.options));
			return { recoveryKey: result.recoveryKey, rotatedRecoveryKey: result.recoveryKey };
		} catch (error) {
			return toFailure(error, 'Unexpected recovery error');
		}
	}
};
