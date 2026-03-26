import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { resolveSessionContext } from '$lib/server/auth/service';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const sessionContext = await resolveSessionContext(event.request.headers);

	if (sessionContext && 'reason' in sessionContext) {
		event.locals.session = sessionContext.session;
		event.locals.authUser = sessionContext.authUser;
		event.locals.integrityFailure = sessionContext;
	} else if (sessionContext) {
		event.locals.session = sessionContext.session;
		event.locals.authUser = sessionContext.authUser;
		event.locals.user = sessionContext.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
