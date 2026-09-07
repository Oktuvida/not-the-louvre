// One nickname rule for both sides; re-exported so the existing
// `$lib/server/auth/config` importers keep working.
export { NICKNAME_PATTERN } from '$lib/shared/auth/credentials';

export const AUTH_RATE_LIMITS = {
	login: {
		maxFailures: 5,
		windowMs: 15 * 60 * 1000,
		blockMs: 15 * 60 * 1000
	},
	recovery: {
		maxFailures: 5,
		windowMs: 15 * 60 * 1000,
		blockMs: 15 * 60 * 1000
	}
} as const;

export const RECOVERY_KEY_LENGTH = 36;
