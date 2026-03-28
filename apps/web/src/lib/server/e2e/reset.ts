import { dbClient } from '$lib/server/db';
import { resetPlaywrightArtworkStorage } from '$lib/server/artwork/storage';

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
	await dbClient.unsafe(RESET_SQL);
	resetPlaywrightArtworkStorage();

	return {
		resetAt: new Date().toISOString()
	};
};
