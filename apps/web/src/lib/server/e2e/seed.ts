import { sql } from 'drizzle-orm';
import { createEmptyDrawingDocument } from '#lib/features/stroke-json/document.js';
import { artworkStorage } from '#lib/server/artwork/storage.js';
import { db } from '#lib/server/db/index.js';
import { renderArtworkMedia, renderAvatarMedia } from '#lib/server/render/client.js';
import { seedAvatarDrawing } from '#lib/server/seed-avatars.js';
import { avatarStorageKey } from '#lib/server/user/avatar-key.js';
import { avatarStorage } from '#lib/server/user/storage.js';

const SEED_AUTHOR = { id: 'e2e-seed-author', nickname: 'seed_painter' };

/**
 * A gallery with more than one page in it, for journeys that scroll. One image
 * is rendered and stored under every artwork's key; the rows are what differ.
 * The artist has an avatar, stored the way a saved one is, so the cards carry
 * a face and the podium its wax seal.
 */
export const seedGalleryArtworks = async (count: number) => {
	await db.execute(sql`
		insert into better_auth.user (id, name, email, email_verified, created_at, updated_at, nickname)
		values (${SEED_AUTHOR.id}, ${SEED_AUTHOR.nickname}, ${`${SEED_AUTHOR.id}@e2e.local`}, true,
			now(), now(), ${SEED_AUTHOR.nickname})
		on conflict do nothing
	`);
	await db.execute(sql`
		insert into app.users (id, nickname, recovery_hash, role, created_at, updated_at)
		values (${SEED_AUTHOR.id}, ${SEED_AUTHOR.nickname}, 'e2e-seed', 'user', now(), now())
		on conflict do nothing
	`);

	const avatar = await renderAvatarMedia(seedAvatarDrawing(0));
	const avatarKey = await avatarStorageKey(
		SEED_AUTHOR.id,
		new Uint8Array(await avatar.file.arrayBuffer())
	);
	await avatarStorage.upload(avatarKey, avatar.file);
	await db.execute(sql`
		update app.users
		set avatar_url = ${avatarKey}, avatar_onboarding_completed_at = now(), updated_at = now()
		where id = ${SEED_AUTHOR.id}
	`);

	const media = await renderArtworkMedia({
		...createEmptyDrawingDocument('artwork'),
		strokes: [
			{
				color: '#2d2420',
				points: [
					[120, 120],
					[640, 640]
				],
				size: 24
			}
		]
	});
	const now = Date.now();
	const ids: string[] = [];

	for (let index = 0; index < count; index += 1) {
		const number = String(index + 1).padStart(2, '0');
		const id = `e2e-seeded-${number}`;
		const storageKey = `artworks/${SEED_AUTHOR.id}/${id}.webp`;
		await artworkStorage.upload(storageKey, media.file);
		await db.execute(sql`
			insert into app.artworks (id, author_id, title, storage_key, media_content_type,
				media_size_bytes, score, created_at, updated_at)
			values (${id}, ${SEED_AUTHOR.id}, ${`Seeded Piece ${number}`}, ${storageKey},
				${media.contentType}, ${media.sizeBytes}, ${count - index},
				${new Date(now - index * 60_000)}, ${new Date(now - index * 60_000)})
		`);
		ids.push(id);
	}

	return { ids };
};
