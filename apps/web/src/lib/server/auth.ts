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
		disabled: __PLAYWRIGHT__
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false
	},
	session: {
		// Serves getSession from the signed session_data cookie instead of a
		// session+user join on every request. The window is deliberately short:
		// the cookie rides on all ~48 image requests a gallery room fires, and a
		// revoked session keeps working until it expires. Ban and role changes
		// are unaffected — those come from the app.users profile, which
		// resolveSessionContext still reads.
		cookieCache: {
			enabled: true,
			maxAge: 60
		}
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
