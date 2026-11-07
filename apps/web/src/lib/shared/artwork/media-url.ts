// An artwork's image keeps its storage key except once: the cutover redraws
// lossy AVIF artworks as lossless WebP. The address names the format, so a
// browser that kept the AVIF forever is pointed at the WebP instead.
export const artworkMediaFormat = (mediaContentType: string) =>
	mediaContentType.replace('image/', '');

export const resolveArtworkMediaUrl = (artworkId: string, mediaContentType: string) =>
	`/api/artworks/${artworkId}/media?v=${encodeURIComponent(artworkMediaFormat(mediaContentType))}`;
