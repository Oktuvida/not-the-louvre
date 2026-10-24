/**
 * Moves production off Supabase Storage and the inline drawing columns, onto
 * the R2 bucket (src/lib/server/cutover/cutover.ts says what each step does).
 * Safe to re-run: every step picks up only what is still left.
 *
 * At the cutover, from apps/web, in this order:
 *   1. bun run cutover --copy-only   (main still live; changes nothing it reads)
 *   2. deploy remaster
 *   3. bun run cutover               (copies what main wrote in between, then redraws)
 *
 * Environment:
 *   DATABASE_URL           production Postgres (direct connection, not the pooler)
 *   SUPABASE_URL           https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY   service-role key, to read the private bucket
 *   SUPABASE_BUCKET        defaults to "artworks"
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *                          an R2 API token with write access to the bucket
 *   R2_BUCKET              defaults to "not-the-louvre"
 */
import { S3Client } from 'bun';
import pg from 'pg';
import {
	runCutover,
	type ObjectSource,
	type ObjectTarget
} from '../src/lib/server/cutover/cutover';

const required = (name: string) => {
	const value = process.env[name];
	if (!value) {
		console.error(`Missing ${name}; see the header of scripts/cutover.ts.`);
		process.exit(1);
	}
	return value;
};

const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '');
const supabaseKey = required('SUPABASE_SERVICE_KEY');
const supabaseBucket = process.env.SUPABASE_BUCKET || 'artworks';

const source: ObjectSource = {
	async read(key) {
		const path = encodeURIComponent(key).replace(/%2F/g, '/');
		const response = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseBucket}/${path}`, {
			headers: { authorization: `Bearer ${supabaseKey}` }
		});
		if (response.status === 400 || response.status === 404) return null;
		if (!response.ok) throw new Error(`Supabase Storage answered ${response.status} for ${key}`);
		return {
			bytes: new Uint8Array(await response.arrayBuffer()),
			contentType: response.headers.get('content-type') ?? 'application/octet-stream'
		};
	}
};

const r2 = new S3Client({
	accessKeyId: required('R2_ACCESS_KEY_ID'),
	bucket: process.env.R2_BUCKET || 'not-the-louvre',
	endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
	secretAccessKey: required('R2_SECRET_ACCESS_KEY')
});

const target: ObjectTarget = {
	has: (key) => r2.exists(key),
	async put(key, bytes, contentType) {
		await r2.write(key, bytes, { type: contentType });
	},
	async read(key) {
		return new Uint8Array(await r2.file(key).arrayBuffer());
	}
};

const db = new pg.Client({ connectionString: required('DATABASE_URL') });
await db.connect();

try {
	const report = await runCutover({
		db,
		log: (line) => console.log(line),
		redraw: !process.argv.includes('--copy-only'),
		source,
		target
	});

	console.log(JSON.stringify(report, null, 2));
	if (report.failures.length > 0 || report.invalidDocuments.length > 0) {
		console.error('Some objects did not move; the report above lists them. Re-run after fixing.');
		process.exitCode = 1;
	}
} finally {
	await db.end();
}
