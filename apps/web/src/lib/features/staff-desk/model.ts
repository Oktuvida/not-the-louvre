import type { ModerationQueuePage } from '#lib/server/artwork/types.js';
import type { getTextModerationSnapshot } from '#lib/server/moderation/service.js';
import type { listUsers } from '#lib/server/user/admin.service.js';

export type StaffCase = ModerationQueuePage['items'][number];
export type StaffUsersPage = Awaited<ReturnType<typeof listUsers>>;
export type StaffPerson = StaffUsersPage['items'][number];
export type StaffTextPolicy = Awaited<ReturnType<typeof getTextModerationSnapshot>>;

export type StaffDeskData = {
	moderationPage: ModerationQueuePage | null;
	permissions: { canManageUsers: boolean; canModerate: boolean; canUpdateTextPolicy: boolean };
	textPolicy: StaffTextPolicy | null;
	usersPage: StaffUsersPage | null;
};

/** What a moderator can decide about a case. */
export type CaseAction = 'delete' | 'dismiss' | 'hide' | 'mark_nsfw' | 'unhide';

export type AvatarAction = 'clear_nsfw' | 'hide' | 'mark_nsfw' | 'unhide';

export type PeopleFilter = 'all' | 'banned' | 'moderators';

/** Where a case's decision goes: each kind of thing has its own moderation route. */
export const caseModerationPath = (item: StaffCase) => {
	if (item.targetType === 'wish') return `/api/wishes/${item.wishId}/moderation`;
	if (item.targetType === 'comment') {
		return `/api/artworks/${item.artworkId}/comments/${item.commentId}/moderation`;
	}
	return `/api/artworks/${item.artworkId}/moderation`;
};

export const countLabel = (count: number, one: string, many = `${one}s`) =>
	`${count} ${count === 1 ? one : many}`;
