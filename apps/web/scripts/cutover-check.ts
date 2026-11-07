/**
 * Tries every key the cutover needs before anything moves. It only reads:
 * production's database, one image from Supabase Storage and the R2 bucket.
 *
 * From apps/web, with the cutover's variables loaded: bun run cutover:check
 */
import pg from 'pg';
import { r2, required, supabaseStorage } from './cutover-connections';

const db = new pg.Client({ connectionString: required('DATABASE_URL') });
await db.connect();

try {
	const { rows } = await db.query(
		`select storage_key as key, (select count(*)::int from app.artworks) as artworks
		 from app.artworks order by created_at desc limit 1`
	);
	const newest = rows[0] as { artworks: number; key: string };
	console.log(`Database: ${new URL(required('DATABASE_URL')).host}, ${newest.artworks} artworks`);

	const image = await supabaseStorage.read(newest.key);
	if (!image) throw new Error('Supabase Storage has no such image: check SUPABASE_BUCKET');
	console.log(`Storage: read ${image.bytes.length} bytes of ${image.contentType}`);

	await r2.exists('cutover-check');
	console.log(`R2: the bucket answers`);
} finally {
	await db.end();
}
