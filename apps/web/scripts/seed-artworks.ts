/**
 * Seed script: inserts ~50 published artworks with varied scores, staggered timestamps,
 * and multiple authors into the local dev database.
 *
 * Usage: bun run db:seed
 * Requires: DATABASE_URL env var (auto-loaded from .env by Bun)
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from '../src/lib/server/db/auth.schema';
import { artworks, users } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set. Add it to apps/web/.env or pass it explicitly.');
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const SEED_AUTHORS = [
	{ id: 'seed-author-1', name: 'Ash Palette', nickname: 'ash_palette', email: 'ash@seed.local' },
	{
		id: 'seed-author-2',
		name: 'Coral Brush',
		nickname: 'coral_brush',
		email: 'coral@seed.local'
	},
	{
		id: 'seed-author-3',
		name: 'Dusk Canvas',
		nickname: 'dusk_canvas',
		email: 'dusk@seed.local'
	},
	{
		id: 'seed-author-4',
		name: 'Ember Sketch',
		nickname: 'ember_sketch',
		email: 'ember@seed.local'
	}
];

const ARTWORK_COUNT = 200;
const SPREAD_DAYS = 7;
const now = Date.now();

const makeArtworkTitle = (index: number): string => {
	const titles = [
		'Sunset Over Mountains',
		'Ocean Breeze',
		'Forest Whisper',
		'City at Dawn',
		'Desert Mirage',
		'Midnight Garden',
		'Starlit Path',
		'Coastal Drift',
		'Autumn Fire',
		'Frozen Lake'
	];
	return `${titles[index % titles.length]} #${index + 1}`;
};

async function seed() {
	process.stdout.write('Seeding authors...\n');

	for (const author of SEED_AUTHORS) {
		await db
			.insert(user)
			.values({
				id: author.id,
				email: author.email,
				name: author.name,
				emailVerified: true
			})
			.onConflictDoNothing();

		await db
			.insert(users)
			.values({
				id: author.id,
				nickname: author.nickname,
				recoveryHash: `seed-recovery-${author.id}`
			})
			.onConflictDoNothing();
	}

	process.stdout.write(`  ${SEED_AUTHORS.length} authors ready.\n`);
	process.stdout.write(`Seeding ${ARTWORK_COUNT} artworks...\n`);

	for (let i = 0; i < ARTWORK_COUNT; i++) {
		const author = SEED_AUTHORS[i % SEED_AUTHORS.length]!;
		const daysAgo = (i / ARTWORK_COUNT) * SPREAD_DAYS;
		const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
		const score = Math.round((Math.sin(i * 0.7) * 0.5 + 0.5) * 100);

		await db
			.insert(artworks)
			.values({
				id: `seed-artwork-${String(i + 1).padStart(3, '0')}`,
				authorId: author.id,
				title: makeArtworkTitle(i),
				storageKey: `seed/artwork-${String(i + 1).padStart(3, '0')}.avif`,
				mediaContentType: 'image/avif',
				mediaSizeBytes: 128,
				score,
				createdAt,
				updatedAt: createdAt
			})
			.onConflictDoNothing();
	}

	process.stdout.write(`  ${ARTWORK_COUNT} artworks seeded.\n`);
	process.stdout.write('Done.\n');
}

try {
	await seed();
} catch (error) {
	process.stderr.write(`Seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
} finally {
	await client.end();
}
