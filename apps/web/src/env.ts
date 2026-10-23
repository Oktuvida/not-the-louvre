import { defineEnvVars } from '@sveltejs/kit/env';

// Runtime environment, read per request (Worker secrets in production, `.env`
// locally). An unset variable reads as the empty string: every consumer treats
// empty as absent (`if (!value)`, `a || b`), so missing and blank behave alike.
export const variables = defineEnvVars({
	PUBLIC_SUPABASE_ANON_KEY: { schema: (input) => input ?? '' },
	SUPABASE_ANON_KEY: { schema: (input) => input ?? '' },
	ANON_KEY: { schema: (input) => input ?? '' },
	PUBLIC_SUPABASE_URL: { schema: (input) => input ?? '' },
	SUPABASE_PUBLIC_URL: { schema: (input) => input ?? '' },
	ORIGIN: { schema: (input) => input ?? '' },
	BETTER_AUTH_SECRET: { schema: (input) => input ?? '' },
	SUPABASE_JWT_SECRET: { schema: (input) => input ?? '' },
	JWT_SECRET: { schema: (input) => input ?? '' },
	SUPABASE_JWT_ISSUER: { schema: (input) => input ?? '' },
	DATABASE_URL: { schema: (input) => input ?? '' }
});
