/**
 * Backfills `media_placeholder` for artworks published before the column
 * existed: downloads each stored AVIF, renders the 24px blurred-preview data
 * URI the publish pipeline now produces, and stores it on the row.
 *
 * Run with production credentials (safe to re-run; only touches NULL rows):
 *   DATABASE_URL="postgres://..." \
 *   SUPABASE_PUBLIC_URL="https://<ref>.supabase.co" \
 *   SUPABASE_SECRET_KEY="<service key>" \
 *   bun run scripts/backfill-media-placeholders.ts
 */
import postgres from 'postgres';
import { ARTWORK_STORAGE_BUCKET } from '../src/lib/server/artwork/config';
import { decodeImage } from '../src/lib/server/media/codecs';
import { encodeArtworkMediaPlaceholder } from '../src/lib/server/media/sanitization';

const databaseUrl = process.env.DATABASE_URL;
const storageBaseUrl = process.env.SUPABASE_PUBLIC_URL;
const storageKeySecret = process.env.SUPABASE_SECRET_KEY || process.env.SERVICE_ROLE_KEY;
const storageBucket = process.env.ARTWORK_STORAGE_BUCKET || ARTWORK_STORAGE_BUCKET;

if (!databaseUrl || !storageBaseUrl || !storageKeySecret) {
	console.error('Missing DATABASE_URL, SUPABASE_PUBLIC_URL, or SUPABASE_SECRET_KEY');
	process.exit(1);
}

const sql = postgres(databaseUrl, { connect_timeout: 10, max: 1, prepare: false });

const fetchStorageObject = async (storageKey: string) => {
	const encodedKey = encodeURIComponent(storageKey).replace(/%2F/g, '/');
	const response = await fetch(
		`${storageBaseUrl}/storage/v1/object/${storageBucket}/${encodedKey}`,
		{ headers: { authorization: `Bearer ${storageKeySecret}` } }
	);

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`storage fetch failed (${response.status}) ${body.slice(0, 120)}`);
	}

	return new Uint8Array(await response.arrayBuffer());
};

const rows = await sql<{ id: string; storage_key: string }[]>`
	select id, storage_key from app.artworks
	where media_placeholder is null
	order by created_at asc
`;

console.log(`${rows.length} artworks without placeholder`);

let done = 0;
let failed = 0;

for (const row of rows) {
	try {
		const avifBytes = await fetchStorageObject(row.storage_key);
		const image = await decodeImage(avifBytes, 'avif');
		const placeholder = await encodeArtworkMediaPlaceholder(image);

		await sql`
			update app.artworks set media_placeholder = ${placeholder}
			where id = ${row.id} and media_placeholder is null
		`;
		done += 1;
		console.log(`ok   ${row.id} (${placeholder.length} chars)`);
	} catch (error) {
		failed += 1;
		console.error(`fail ${row.id}: ${error instanceof Error ? error.message : error}`);
	}
}

await sql.end({ timeout: 5 });
console.log(`done: ${done} updated, ${failed} failed`);
