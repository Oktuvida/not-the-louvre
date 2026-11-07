import { ArtworkFlowError } from '#lib/server/artwork/errors.js';
import { assertNotBanned } from '#lib/server/auth/guards.js';
import type { CanonicalUser, ProductRole } from '#lib/server/auth/types.js';
import { resolveUserAvatarUrl } from '#lib/shared/user/avatar-url.js';
import { userRepository as defaultRepository } from './repository';
import type { ListedUser, UserRecord, UserRepository, UserStanding, UserTotals } from './types';

type AdminContext = {
	user?: CanonicalUser | null;
};

type AdminDependencies = {
	repository?: UserRepository;
};

type PublicUserProfile = {
	avatarIsHidden: boolean;
	avatarIsNsfw: boolean;
	avatarUrl: string | null;
	banReason: string | null;
	bannedAt: Date | null;
	createdAt: Date;
	id: string;
	isBanned: boolean;
	nickname: string;
	role: ProductRole;
};

const toPublicProfile = (record: UserRecord): PublicUserProfile => ({
	avatarIsHidden: record.avatarIsHidden,
	avatarIsNsfw: record.avatarIsNsfw,
	avatarUrl: record.avatarIsHidden ? null : resolveUserAvatarUrl(record.id, record.avatarUrl),
	banReason: record.banReason,
	bannedAt: record.bannedAt,
	createdAt: record.createdAt,
	id: record.id,
	isBanned: record.isBanned,
	nickname: record.nickname,
	role: record.role
});

type UserListPage = {
	items: (PublicUserProfile & { artworkCount: number })[];
	pageInfo: {
		hasMore: boolean;
		nextCursor: string | null;
	};
	/** The whole museum, whatever this page was asked to find. */
	totals: UserTotals;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const ASSIGNABLE_ROLES: ProductRole[] = ['user', 'moderator'];

const requireAdmin = (context: AdminContext) => {
	if (!context.user) {
		throw new ArtworkFlowError(401, 'Authentication required', 'UNAUTHENTICATED');
	}
	assertNotBanned(context.user);
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
	filter?: string | null;
	limit?: number;
	search?: string | null;
};

const toStanding = (filter: string | null | undefined): UserStanding | null =>
	filter === 'banned' || filter === 'moderators' ? filter : null;

const toListedUser = (record: ListedUser) => ({
	...toPublicProfile(record),
	artworkCount: record.artworkCount
});

export const listUsers = async (
	input: ListUsersInput,
	context: AdminContext,
	dependencies: AdminDependencies = {}
): Promise<UserListPage> => {
	requireAdmin(context);

	const repository = dependencies.repository ?? defaultRepository;
	const limit = !input.limit ? DEFAULT_LIMIT : Math.min(input.limit, MAX_LIMIT);
	const cursor = decodeCursor(input.cursor);

	const [records, totals] = await Promise.all([
		repository.listUsers({
			cursor,
			limit: limit + 1,
			search: input.search?.trim() || null,
			standing: toStanding(input.filter)
		}),
		repository.countUsers()
	]);
	const hasMore = records.length > limit;
	const visible = hasMore ? records.slice(0, limit) : records;
	const last = visible[visible.length - 1];
	const nextCursor = hasMore && last ? encodeCursor(last) : null;

	return {
		items: visible.map(toListedUser),
		pageInfo: { hasMore, nextCursor },
		totals
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

type BanUserInput = {
	reason: string;
	userId: string;
};

export const banUser = async (
	input: BanUserInput,
	context: AdminContext,
	dependencies: AdminDependencies = {}
): Promise<PublicUserProfile> => {
	const admin = requireAdmin(context);
	const repository = dependencies.repository ?? defaultRepository;
	const reason = input.reason.trim();

	if (!reason) {
		throw new ArtworkFlowError(400, 'Ban reason is required', 'VALIDATION_ERROR');
	}

	if (input.userId === admin.id) {
		throw new ArtworkFlowError(403, 'Cannot ban yourself', 'FORBIDDEN');
	}

	const target = await repository.findUserById(input.userId);
	if (!target) {
		throw new ArtworkFlowError(404, 'User not found', 'NOT_FOUND');
	}

	const updated = await repository.updateBanState(input.userId, {
		banReason: reason,
		bannedAt: new Date(),
		isBanned: true,
		updatedAt: new Date()
	});

	if (!updated) {
		throw new ArtworkFlowError(500, 'Ban update failed', 'PUBLISH_FAILED');
	}

	return toPublicProfile(updated);
};

type UnbanUserInput = {
	userId: string;
};

export const unbanUser = async (
	input: UnbanUserInput,
	context: AdminContext,
	dependencies: AdminDependencies = {}
): Promise<PublicUserProfile> => {
	requireAdmin(context);
	const repository = dependencies.repository ?? defaultRepository;
	const target = await repository.findUserById(input.userId);

	if (!target) {
		throw new ArtworkFlowError(404, 'User not found', 'NOT_FOUND');
	}

	const updated = await repository.updateBanState(input.userId, {
		banReason: null,
		bannedAt: null,
		isBanned: false,
		updatedAt: new Date()
	});

	if (!updated) {
		throw new ArtworkFlowError(500, 'Ban update failed', 'PUBLISH_FAILED');
	}

	return toPublicProfile(updated);
};
