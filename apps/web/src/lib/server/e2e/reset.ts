import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { sharedPageEdgeCacheKeys } from '#lib/server/http/edge-cache.js';
import { deleteAllMediaObjects } from '#lib/server/media/object-storage.js';
import { edgeCache } from '#lib/server/platform.js';

const RESET_SQL = `
	truncate table
		app.content_reports,
		app.artwork_votes,
		app.artwork_comments,
		app.artwork_engagement_rate_limits,
		app.artwork_publish_rate_limits,
		app.artworks,
		app.wishes,
		app.auth_rate_limits,
		app.users,
		better_auth.account,
		better_auth.session,
		better_auth.verification,
		better_auth.user
	restart identity cascade
`;

export const resetBackendState = async (origin: string) => {
	await db.execute(sql.raw(RESET_SQL));
	await deleteAllMediaObjects();

	// A wiped gallery must not go on showing signed-out visitors the last walls.
	const cache = edgeCache();
	await Promise.all(sharedPageEdgeCacheKeys(origin).map((key) => cache?.delete(key)));

	return {
		resetAt: new Date().toISOString()
	};
};
