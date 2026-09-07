// The credential rules both sides validate against. The client checked a copy
// of this regex and the server another, so a rule change used to need two
// edits and a mismatch let the signup form accept a nickname the API rejects.
export const NICKNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Nicknames are stored and compared in their normalized form, so the client
// must normalize with exactly the same rule before it validates or submits.
export const normalizeNickname = (value: string) => value.trim().toLowerCase();
