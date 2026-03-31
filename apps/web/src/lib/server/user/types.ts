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

export type ListUsersInput = {
	cursor: { createdAt: Date; id: string } | null;
	limit: number;
};

export type UserRepository = {
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
