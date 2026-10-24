import { z } from 'zod';
import {
	NICKNAME_PATTERN,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	normalizeNickname
} from '#lib/shared/auth/credentials.js';
import { RECOVERY_KEY_LENGTH } from './config';

const nicknameSchema = z
	.string()
	.transform(normalizeNickname)
	.refine((value: string) => NICKNAME_PATTERN.test(value), {
		message: 'Nickname must be 3-20 chars and use only lowercase letters, numbers, or underscores'
	});

const passwordSchema = z
	.string()
	.min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`)
	.max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters long`);

const recoveryKeySchema = z
	.string()
	.trim()
	.length(RECOVERY_KEY_LENGTH, 'Recovery key must be a UUIDv4 string');

export const signupSchema = z.object({
	nickname: nicknameSchema,
	password: passwordSchema
});

export const availabilitySchema = z.object({
	nickname: nicknameSchema
});

export const signInSchema = z.object({
	nickname: nicknameSchema,
	password: passwordSchema
});

export const recoverSchema = z.object({
	nickname: nicknameSchema,
	recoveryKey: recoveryKeySchema,
	newPassword: passwordSchema
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
