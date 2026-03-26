import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const authSchemaPath = resolve(rootDir, 'src/lib/server/db/auth.schema.ts');

const source = readFileSync(authSchemaPath, 'utf8');

const transformed = source
	.replace(
		'import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";',
		'import { pgSchema, text, timestamp, boolean, index } from "drizzle-orm/pg-core";\n\nconst betterAuthSchema = pgSchema("better_auth");'
	)
	.replaceAll('pgTable(', 'betterAuthSchema.table(');

mkdirSync(dirname(authSchemaPath), { recursive: true });
writeFileSync(authSchemaPath, transformed);
