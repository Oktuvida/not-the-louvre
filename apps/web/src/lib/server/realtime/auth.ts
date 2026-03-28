import { env } from '$env/dynamic/private';
import { SignJWT } from 'jose';
import type { CanonicalUser } from '$lib/server/auth/types';

const REALTIME_TOKEN_TTL_SECONDS = 60 * 5;

const getSupabaseJwtSecret = () => env.SUPABASE_JWT_SECRET || env.JWT_SECRET;

const getSupabaseJwtIssuer = () => env.SUPABASE_JWT_ISSUER || 'supabase-demo';

export const createRealtimeAuthToken = async (
	user: Pick<CanonicalUser, 'email' | 'id' | 'role'>
) => {
	const secret = getSupabaseJwtSecret();

	if (!secret) {
		throw new Error('Supabase realtime JWT secret is not configured');
	}

	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + REALTIME_TOKEN_TTL_SECONDS;
	const token = await new SignJWT({
		app_metadata: { provider: 'better-auth' },
		email: user.email,
		role: 'authenticated',
		sub: user.id,
		user_role: user.role
	})
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setAudience('authenticated')
		.setExpirationTime(expiresAt)
		.setIssuedAt(issuedAt)
		.setIssuer(getSupabaseJwtIssuer())
		.setSubject(user.id)
		.sign(new TextEncoder().encode(secret));

	return {
		expiresAt: new Date(expiresAt * 1000).toISOString(),
		token
	};
};
