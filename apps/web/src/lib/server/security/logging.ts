type SecurityEvent =
	| 'auth.abuse_limit_denied'
	| 'auth.integrity_failure'
	| 'http.untrusted_origin_blocked';

type SecurityContextValue = boolean | null | number | string | undefined;

type SecurityContext = Record<string, SecurityContextValue>;

const compactContext = (context: SecurityContext) =>
	Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));

export const logSecurityEvent = (event: SecurityEvent, context: SecurityContext) => {
	console.warn(
		JSON.stringify({
			category: 'security',
			event,
			timestamp: new Date().toISOString(),
			...compactContext(context)
		})
	);
};
