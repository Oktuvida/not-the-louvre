import { json, type Handle, type RequestEvent } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { resolveSessionContext } from '$lib/server/auth/service';
import { runWithRequestDbConnection } from '$lib/server/db';
import { logSecurityEvent } from '$lib/server/security/logging';
import { getTrustedOriginDecision } from '$lib/server/security/trusted-origin';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Reads whose answer depends only on the route params: the media reader ignores
// the viewer entirely and the avatar/favicon readers key off the userId in the
// path. Resolving the session first would put two queries — and, on Workers, a
// whole Postgres connection — in front of the edge-cache lookup these handlers
// do first, on every one of the ~48 image requests a gallery room fires. The
// method matters: the avatar route's writes do read locals.user.
const SESSION_INDEPENDENT_GET_ROUTE_IDS = new Set([
	'/api/artworks/[artworkId]/media',
	'/api/users/[userId]/avatar',
	'/api/users/[userId]/favicon'
]);

const needsSessionContext = (event: RequestEvent) =>
	event.request.method !== 'GET' ||
	event.route.id === null ||
	!SESSION_INDEPENDENT_GET_ROUTE_IDS.has(event.route.id);

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

	const sessionContext = needsSessionContext(event)
		? await resolveSessionContext(event.request.headers)
		: null;

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

export const handle: Handle = (input) =>
	runWithRequestDbConnection(async () => handleBetterAuth(input), {
		connectionString: input.event.platform?.env?.HYPERDRIVE?.connectionString,
		context: input.event.platform?.context
	});
