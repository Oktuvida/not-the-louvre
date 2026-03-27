import type { ProductRole } from '$lib/server/auth/types';

export type UserRecord = {
	avatarUrl: string | null;
	createdAt: Date;
	id: string;
	nickname: string;
	role: ProductRole;
	updatedAt: Date;
};

export type UserRepository = {
	findUserById(id: string): Promise<UserRecord | null>;
	updateUserAvatarUrl(
		id: string,
		avatarUrl: string | null,
		updatedAt: Date
	): Promise<UserRecord | null>;
};
