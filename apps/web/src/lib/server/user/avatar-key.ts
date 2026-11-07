import { contentHash } from '#lib/server/media/content-hash.js';
import { AVATAR_STORAGE_KEY_PREFIX } from './config';

// Named after the image itself, so a new avatar gets a new address and every
// cache may keep the old one without ever showing it again (see avatar-url.ts).
export const avatarStorageKey = async (userId: string, image: Uint8Array<ArrayBuffer>) =>
	`${AVATAR_STORAGE_KEY_PREFIX}/${userId}/${(await contentHash(image)).slice(0, 16)}.webp`;
