import type { ProductRole } from '$lib/server/auth/types';

export type UserRecord = {
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
	findUserById(id: string): Promise<UserRecord | null>;
	listUsers(input: ListUsersInput): Promise<UserRecord[]>;
	updateUserAvatarUrl(
		id: string,
		avatarUrl: string | null,
		updatedAt: Date
	): Promise<UserRecord | null>;
	updateUserRole(id: string, role: ProductRole, updatedAt: Date): Promise<UserRecord | null>;
};
