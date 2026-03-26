import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

export const generateRecoveryKey = () => randomUUID();

export const hashRecoveryKey = async (recoveryKey: string) => hashPassword(recoveryKey);

export const verifyRecoveryKey = async (hash: string, recoveryKey: string) =>
	verifyPassword({ hash, password: recoveryKey });
