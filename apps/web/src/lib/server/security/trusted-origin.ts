const UNSAFE_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

const normalizeOrigin = (value: string | null) => {
	if (!value) return null;

	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
};

const readOriginCandidate = (request: Request) => {
	const origin = normalizeOrigin(request.headers.get('origin'));
	if (origin) {
		return { source: 'origin', value: origin } as const;
	}

	const referer = normalizeOrigin(request.headers.get('referer'));
	if (referer) {
		return { source: 'referer', value: referer } as const;
	}

	return { source: 'missing', value: null } as const;
};

const isProtectedProductMutation = (request: Request) => {
	if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
		return false;
	}

	const { pathname } = new URL(request.url);
	return pathname.startsWith('/api/') && !pathname.startsWith('/api/auth');
};

export const getTrustedOriginDecision = (request: Request) => {
	if (!isProtectedProductMutation(request)) {
		return {
			allowed: true,
			pathname: new URL(request.url).pathname,
			requestOrigin: new URL(request.url).origin,
			trustedOrigin: null,
			originSource: 'not-applicable',
			originValue: null
		} as const;
	}

	const requestUrl = new URL(request.url);
	const trustedOrigins = new Set([requestUrl.origin]);
	const configuredOrigin = normalizeOrigin(process.env.ORIGIN ?? null);
	if (configuredOrigin) {
		trustedOrigins.add(configuredOrigin);
	}

	const candidate = readOriginCandidate(request);

	return {
		allowed: candidate.value !== null && trustedOrigins.has(candidate.value),
		pathname: requestUrl.pathname,
		requestOrigin: requestUrl.origin,
		trustedOrigin: configuredOrigin,
		originSource: candidate.source,
		originValue: candidate.value
	} as const;
};
