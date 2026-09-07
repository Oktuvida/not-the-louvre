import type { Session, User } from 'better-auth';
import type { ProductRole } from '$lib/shared/viewer';

// The role vocabulary is shared with the drizzle enum and the client
// components; re-exported so `$lib/server/auth/types` keeps working.
export type { ProductRole };

export type CanonicalUser = {
	id: string;
	authUserId: string;
	nickname: string;
	role: ProductRole;
	avatarUrl: string | null;
	avatarOnboardingCompletedAt?: Date | null;
	isBanned: boolean;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type AuthSessionContext = {
	session: Session;
	authUser: User;
	user: CanonicalUser;
};

export type AuthIntegrityFailure = {
	session: Session;
	authUser: User;
	reason: 'missing-product-user';
};
