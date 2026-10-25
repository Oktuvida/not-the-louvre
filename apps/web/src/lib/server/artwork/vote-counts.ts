import { sql } from 'drizzle-orm';
import type { ArtworkVoteValue } from '#lib/shared/content/votes.js';

/*
 * An artwork's up or down votes, counted from the rows, as a select column
 * over `app.artworks`. The outer id is spelled out: Drizzle leaves a column
 * unqualified in a single-table select, and a bare "id" inside this subquery
 * would be the vote's own id, so every count came back 0.
 */
export const voteCountSql = (value: ArtworkVoteValue) =>
	sql<number>`coalesce((
		select count(*)::int
		from "app"."artwork_votes" vote
		where vote.artwork_id = "artworks"."id"
			and vote.value = ${sql.raw(`'${value}'::app.artwork_vote_value`)}
	), 0)`;
