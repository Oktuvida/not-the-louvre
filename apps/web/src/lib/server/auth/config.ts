export const NICKNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

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
