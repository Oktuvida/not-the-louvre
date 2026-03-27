import { ArtworkFlowError } from '$lib/server/artwork/errors';
import type { CanonicalUser } from '$lib/server/auth/types';
import type { ProductRole } from '$lib/server/auth/types';
import { userRepository as defaultRepository } from './repository';
import type { UserRecord, UserRepository } from './types';

type AdminContext = {
	user?: CanonicalUser | null;
};

type AdminDependencies = {
	repository?: UserRepository;
};

const resolveAvatarUrl = (userId: string, storageKey: string | null) =>
	storageKey ? `/api/users/${userId}/avatar` : null;

type PublicUserProfile = {
	avatarUrl: string | null;
	createdAt: Date;
	id: string;
	nickname: string;
	role: ProductRole;
};

const toPublicProfile = (record: UserRecord): PublicUserProfile => ({
	avatarUrl: resolveAvatarUrl(record.id, record.avatarUrl),
	createdAt: record.createdAt,
	id: record.id,
	nickname: record.nickname,
	role: record.role
});

type UserListPage = {
	items: PublicUserProfile[];
	pageInfo: {
		hasMore: boolean;
		nextCursor: string | null;
	};
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const ASSIGNABLE_ROLES: ProductRole[] = ['user', 'moderator'];

const requireAdmin = (context: AdminContext) => {
	if (!context.user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}
	if (context.user.role !== 'admin') {
		throw new ArtworkFlowError(403, 'Admin access required', 'FORBIDDEN');
	}
	return context.user;
};

const decodeCursor = (value: string | null | undefined): { createdAt: Date; id: string } | null => {
	if (!value) return null;
	try {
		const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
			createdAt?: string;
			id?: string;
		};
		if (!parsed.createdAt || !parsed.id) throw new Error('Invalid cursor');
		const createdAt = new Date(parsed.createdAt);
		if (Number.isNaN(createdAt.getTime())) throw new Error('Invalid cursor');
		return { createdAt, id: parsed.id };
	} catch {
		throw new ArtworkFlowError(400, 'Invalid user list cursor', 'INVALID_CURSOR');
	}
};

const encodeCursor = (record: UserRecord): string =>
	Buffer.from(
		JSON.stringify({ createdAt: record.createdAt.toISOString(), id: record.id }),
		'utf8'
	).toString('base64url');

type ListUsersInput = {
	cursor?: string | null;
	limit?: number;
};

export const listUsers = async (
	input: ListUsersInput,
	context: AdminContext,
	dependencies: AdminDependencies = {}
): Promise<UserListPage> => {
	requireAdmin(context);

	const repository = dependencies.repository ?? defaultRepository;
	const limit = !input.limit ? DEFAULT_LIMIT : Math.min(input.limit, MAX_LIMIT);
	const cursor = decodeCursor(input.cursor);

	const records = await repository.listUsers({ cursor, limit: limit + 1 });
	const hasMore = records.length > limit;
	const visible = hasMore ? records.slice(0, limit) : records;
	const last = visible[visible.length - 1];
	const nextCursor = hasMore && last ? encodeCursor(last) : null;

	return {
		items: visible.map(toPublicProfile),
		pageInfo: { hasMore, nextCursor }
	};
};

type UpdateUserRoleInput = {
	role: string;
	userId: string;
};

export const updateUserRole = async (
	input: UpdateUserRoleInput,
	context: AdminContext,
	dependencies: AdminDependencies = {}
): Promise<PublicUserProfile> => {
	const admin = requireAdmin(context);
	const repository = dependencies.repository ?? defaultRepository;

	if (input.userId === admin.id) {
		throw new ArtworkFlowError(403, 'Cannot change your own role', 'FORBIDDEN');
	}

	if (!ASSIGNABLE_ROLES.includes(input.role as ProductRole)) {
		throw new ArtworkFlowError(400, 'Invalid role', 'INVALID_ROLE');
	}

	const target = await repository.findUserById(input.userId);
	if (!target) {
		throw new ArtworkFlowError(404, 'User not found', 'NOT_FOUND');
	}

	if (target.role === 'admin') {
		throw new ArtworkFlowError(403, "Cannot change another admin's role", 'FORBIDDEN');
	}

	const updated = await repository.updateUserRole(
		input.userId,
		input.role as ProductRole,
		new Date()
	);
	if (!updated) {
		throw new ArtworkFlowError(500, 'Role update failed', 'PUBLISH_FAILED');
	}

	return toPublicProfile(updated);
};
