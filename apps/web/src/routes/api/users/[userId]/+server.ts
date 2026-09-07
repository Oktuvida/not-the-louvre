import type { RequestHandler } from './$types';
import { userRepository } from '$lib/server/user/repository';
import { resolveUserAvatarUrl } from '$lib/shared/user/avatar-url';

export const GET: RequestHandler = async (event) => {
	const user = await userRepository.findUserAvatarRefById(event.params.userId);

	if (!user) {
		return new Response('User not found', { status: 404 });
	}

	return Response.json({
		avatarUrl: user.avatarIsHidden ? null : resolveUserAvatarUrl(user.id, user.avatarUrl),
		createdAt: user.createdAt,
		id: user.id,
		nickname: user.nickname,
		role: user.role
	});
};
