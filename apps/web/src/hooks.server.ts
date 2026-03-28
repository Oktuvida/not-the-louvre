import { json, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { resolveSessionContext } from '$lib/server/auth/service';
import { logSecurityEvent } from '$lib/server/security/logging';
import { getTrustedOriginDecision } from '$lib/server/security/trusted-origin';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const trustedOriginDecision = getTrustedOriginDecision(event.request);

	if (!trustedOriginDecision.allowed) {
		logSecurityEvent('http.untrusted_origin_blocked', {
			method: event.request.method,
			origin: trustedOriginDecision.originValue,
			originSource: trustedOriginDecision.originSource,
			pathname: trustedOriginDecision.pathname,
			requestOrigin: trustedOriginDecision.requestOrigin,
			trustedOrigin: trustedOriginDecision.trustedOrigin
		});

		return json(
			{
				code: 'FORBIDDEN',
				message: 'Trusted origin required for state-changing API requests'
			},
			{ status: 403 }
		);
	}

	const sessionContext = await resolveSessionContext(event.request.headers);

	if (sessionContext && 'reason' in sessionContext) {
		event.locals.session = sessionContext.session;
		event.locals.authUser = sessionContext.authUser;
		event.locals.integrityFailure = sessionContext;
		logSecurityEvent('auth.integrity_failure', {
			authUserId: sessionContext.authUser.id,
			pathname: event.url.pathname,
			reason: sessionContext.reason,
			sessionId: sessionContext.session.id
		});
	} else if (sessionContext) {
		event.locals.session = sessionContext.session;
		event.locals.authUser = sessionContext.authUser;
		event.locals.user = sessionContext.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
