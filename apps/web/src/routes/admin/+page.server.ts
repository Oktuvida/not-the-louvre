import { error } from '@sveltejs/kit';
import { listModerationQueue } from '$lib/server/artwork/read.service';
import { getTextModerationSnapshot } from '$lib/server/moderation/service';
import { listUsers } from '$lib/server/user/admin.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		error(401, 'Authentication required');
	}

	if (user.role !== 'admin' && user.role !== 'moderator') {
		error(403, 'Moderator access required');
	}

	const canManageUsers = user.role === 'admin';
	const canModerate = user.role === 'admin' || user.role === 'moderator';

	const [usersPage, moderationPage, textPolicy] = await Promise.all([
		canManageUsers ? listUsers({}, { user }) : Promise.resolve(null),
		canModerate ? listModerationQueue({}, { user }) : Promise.resolve(null),
		canManageUsers ? getTextModerationSnapshot() : Promise.resolve(null)
	]);

	return {
		moderationPage,
		permissions: {
			canManageUsers,
			canModerate,
			canUpdateTextPolicy: canManageUsers
		},
		textPolicy,
		usersPage,
		viewer: {
			id: user.id,
			isBanned: Boolean(user.isBanned),
			nickname: user.nickname,
			role: user.role
		}
	};
};
