import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { CanonicalUser } from './types';

export const assertAuthenticatedUser = (user: CanonicalUser | null | undefined): CanonicalUser => {
	if (!user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}

	return user;
};

export const assertNotBanned = <T extends Pick<CanonicalUser, 'isBanned'>>(user: T): T => {
	if (user.isBanned) {
		throw new ArtworkFlowError(403, 'This account cannot perform this action.', 'BANNED_USER');
	}

	return user;
};

export const assertActiveUser = (user: CanonicalUser | null | undefined): CanonicalUser =>
	assertNotBanned(assertAuthenticatedUser(user));
