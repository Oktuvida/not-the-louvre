import type { Session, User } from 'better-auth';

export type ProductRole = 'user' | 'moderator' | 'admin';

export type CanonicalUser = {
	id: string;
	authUserId: string;
	nickname: string;
	role: ProductRole;
	avatarUrl: string | null;
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
