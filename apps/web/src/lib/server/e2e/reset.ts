import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { resetPlaywrightArtworkStorage } from '#lib/server/artwork/storage.js';
import { resetPlaywrightAvatarStorage } from '#lib/server/user/storage.js';

const RESET_SQL = `
	truncate table
		app.content_reports,
		app.artwork_votes,
		app.artwork_vote_realtime,
		app.artwork_comments,
		app.artwork_comment_realtime,
		app.artwork_engagement_rate_limits,
		app.artwork_publish_rate_limits,
		app.artworks,
		app.auth_rate_limits,
		app.users,
		better_auth.account,
		better_auth.session,
		better_auth.verification,
		better_auth.user
	restart identity cascade
`;

export const resetBackendState = async () => {
	await db.execute(sql.raw(RESET_SQL));
	resetPlaywrightArtworkStorage();
	resetPlaywrightAvatarStorage();

	return {
		resetAt: new Date().toISOString()
	};
};
