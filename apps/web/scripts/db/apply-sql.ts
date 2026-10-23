import process from 'node:process';
import postgres from 'postgres';

// Runs one SQL file against DATABASE_URL, e.g. the Supabase platform objects a
// plain Postgres needs before `drizzle-kit migrate` (see supabase-platform-objects.sql).
const [filePath] = process.argv.slice(2);
const databaseUrl = process.env.DATABASE_URL;

if (!filePath) throw new Error('Usage: bun run scripts/db/apply-sql.ts <file.sql>');
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
	await sql.file(filePath);
	process.stdout.write(`Applied ${filePath}\n`);
} finally {
	await sql.end();
}
