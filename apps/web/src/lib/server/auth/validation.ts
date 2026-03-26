import { z } from 'zod';
import { NICKNAME_PATTERN, RECOVERY_KEY_LENGTH } from './config';

const normalizeInput = (value: string) => value.trim().toLowerCase();

export const normalizeNickname = (value: string) => normalizeInput(value);

export const nicknameSchema = z
	.string()
	.transform(normalizeNickname)
	.refine((value: string) => NICKNAME_PATTERN.test(value), {
		message: 'Nickname must be 3-20 chars and use only lowercase letters, numbers, or underscores'
	});

export const passwordSchema = z
	.string()
	.min(8, 'Password must be at least 8 characters long')
	.max(128, 'Password must be at most 128 characters long');

export const recoveryKeySchema = z
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
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
