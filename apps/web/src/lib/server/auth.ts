import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createFieldAttribute } from 'better-auth/db';
import { username } from 'better-auth/plugins/username';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { NICKNAME_PATTERN } from './auth/config';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			...schema,
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	logger: {
		disabled: process.env.PLAYWRIGHT === '1'
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false
	},
	user: {
		additionalFields: {
			nickname: createFieldAttribute('string', {
				required: false,
				returned: false
			})
		}
	},
	plugins: [
		username({
			minUsernameLength: 3,
			maxUsernameLength: 20,
			usernameValidator: (value) => NICKNAME_PATTERN.test(value),
			displayUsernameNormalization: false
		}),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
