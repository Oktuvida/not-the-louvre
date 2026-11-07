import { S3Client } from 'bun';
import { supabaseObjectSource } from '../src/lib/server/cutover/supabase-source';

// What the cutover and its check connect to; the variables are in the header of
// scripts/cutover.ts.
export const required = (name: string) => {
	const value = process.env[name];
	if (!value) {
		console.error(`Missing ${name}; see the header of scripts/cutover.ts.`);
		process.exit(1);
	}
	return value;
};

export const supabaseStorage = supabaseObjectSource({
	bucket: process.env.SUPABASE_BUCKET || 'artworks',
	key: required('SUPABASE_SERVICE_KEY'),
	url: required('SUPABASE_URL').replace(/\/$/, '')
});

export const r2 = new S3Client({
	accessKeyId: required('R2_ACCESS_KEY_ID'),
	bucket: process.env.R2_BUCKET || 'not-the-louvre',
	endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
	secretAccessKey: required('R2_SECRET_ACCESS_KEY')
});
