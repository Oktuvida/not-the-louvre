import type { RequestHandler } from './$types';
import { userRepository } from '$lib/server/user/repository';

const resolveAvatarUrl = (userId: string, storageKey: string | null) =>
	storageKey ? `/api/users/${userId}/avatar` : null;

export const GET: RequestHandler = async (event) => {
	const user = await userRepository.findUserById(event.params.userId);

	if (!user) {
		return new Response('User not found', { status: 404 });
	}

	return Response.json({
		avatarUrl: user.avatarIsHidden ? null : resolveAvatarUrl(user.id, user.avatarUrl),
		createdAt: user.createdAt,
		id: user.id,
		nickname: user.nickname,
		role: user.role
	});
};
