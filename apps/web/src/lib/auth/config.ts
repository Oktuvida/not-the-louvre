// Barrel kept for the existing `$lib/auth/config` imports; the rules live in
// the shared layer so the server validators read the same source.
export {
	NICKNAME_PATTERN,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	normalizeNickname
} from '$lib/shared/auth/credentials';
