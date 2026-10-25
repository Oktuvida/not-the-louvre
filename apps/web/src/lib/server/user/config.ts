// A guard, not a budget: a lossless 256px image cannot get much past its raw
// 256 KiB of pixels.
// As for artworks: a 340 px lossless WebP stays under it however busy the picture.
export const AVATAR_MEDIA_MAX_BYTES = 512 * 1024;
export const AVATAR_MEDIA_CONTENT_TYPE = 'image/webp';
export const AVATAR_MEDIA_WIDTH = 256;
export const AVATAR_MEDIA_HEIGHT = 256;
export const AVATAR_STORAGE_KEY_PREFIX = 'avatars';
