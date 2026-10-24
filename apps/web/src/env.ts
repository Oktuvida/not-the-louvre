import { defineEnvVars } from '@sveltejs/kit/env';

// Runtime environment, read per request (Worker secrets in production, `.env`
// locally). An unset variable reads as the empty string: every consumer treats
// empty as absent (`if (!value)`, `a || b`), so missing and blank behave alike.
export const variables = defineEnvVars({
	ORIGIN: { schema: (input) => input ?? '' },
	BETTER_AUTH_SECRET: { schema: (input) => input ?? '' },
	DATABASE_URL: { schema: (input) => input ?? '' }
});
