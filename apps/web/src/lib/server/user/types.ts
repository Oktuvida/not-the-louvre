import type { ProductRole } from '$lib/server/auth/types';

export type UserRecord = {
	avatarDocument?: string | null;
	avatarDocumentVersion?: number | null;
	avatarIsHidden: boolean;
	avatarIsNsfw: boolean;
	avatarUrl: string | null;
	avatarOnboardingCompletedAt?: Date | null;
	banReason: string | null;
	bannedAt: Date | null;
	createdAt: Date;
	id: string;
	isBanned: boolean;
	nickname: string;
	role: ProductRole;
	updatedAt: Date;
};

// The completeness marker for a chunked avatar document: readers must treat a
// document whose version is null as absent, exactly as artworks do with
// drawing_version.
export type UserAvatarDocumentRef = {
	avatarDocumentVersion: number | null;
	id: string;
};

// Everything the avatar, favicon and public profile endpoints read, and
// nothing else — notably not the compressed avatar drawing document, which
// would otherwise cross the pooler on every uncached avatar hit.
export type UserAvatarRef = {
	avatarIsHidden: boolean;
	avatarIsNsfw: boolean;
	avatarUrl: string | null;
	createdAt: Date;
	id: string;
	nickname: string;
	role: ProductRole;
	updatedAt: Date;
};

export type ListUsersInput = {
	cursor: { createdAt: Date; id: string } | null;
	limit: number;
};

export type UserRepository = {
	// The expected-length guard makes each append exactly-once under ambiguous
	// connection failures, mirroring appendArtworkDrawingDocumentChunk.
	appendUserAvatarDocumentChunk(
		id: string,
		chunk: string,
		expectedLength: number,
		updatedAt: Date
	): Promise<boolean>;
	finalizeUserAvatarDocument(
		id: string,
		version: number,
		expectedTotalLength: number,
		updatedAt: Date
	): Promise<UserAvatarDocumentRef | null>;
	findUserAvatarDocumentLength(id: string): Promise<number | null>;
	findUserAvatarDocumentRef(id: string): Promise<UserAvatarDocumentRef | null>;
	findUserAvatarRefById(id: string): Promise<UserAvatarRef | null>;
	findUserById(id: string): Promise<UserRecord | null>;
	listUsers(input: ListUsersInput): Promise<UserRecord[]>;
	updateUserAvatar?(
		id: string,
		input: {
			avatarDocument?: string | null;
			avatarDocumentVersion?: number | null;
			avatarOnboardingCompletedAt: Date | null;
			avatarUrl: string | null;
			updatedAt: Date;
		}
	): Promise<UserRecord | null>;
	updateUserAvatarUrl(
		id: string,
		avatarUrl: string | null,
		avatarOnboardingCompletedAt: Date | null,
		updatedAt: Date
	): Promise<UserRecord | null>;
	updateAvatarModeration(
		id: string,
		input: {
			avatarIsHidden?: boolean;
			avatarIsNsfw?: boolean;
			updatedAt: Date;
		}
	): Promise<UserRecord | null>;
	updateBanState(
		id: string,
		input: {
			banReason: string | null;
			bannedAt: Date | null;
			isBanned: boolean;
			updatedAt: Date;
		}
	): Promise<UserRecord | null>;
	updateUserRole(id: string, role: ProductRole, updatedAt: Date): Promise<UserRecord | null>;
};
