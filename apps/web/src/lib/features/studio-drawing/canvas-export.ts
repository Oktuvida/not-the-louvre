const EXPORT_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
	new Promise<Blob | null>((resolve) => {
		canvas.toBlob((blob) => resolve(blob), type, quality);
	});

export const exportArtworkFile = async (canvas: HTMLCanvasElement) => {
	for (const type of EXPORT_TYPES) {
		const blob = await canvasToBlob(canvas, type, type === 'image/png' ? undefined : 0.92);
		if (!blob || blob.size === 0 || blob.type !== type) {
			continue;
		}

		const extension = type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : 'png';
		return new File([blob], `artwork.${extension}`, { type });
	}

	return null;
};
