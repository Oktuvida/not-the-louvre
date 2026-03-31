const EXPORT_TYPE = 'image/webp';
const EXPORT_QUALITIES = [0.72, 0.6, 0.48, 0.36] as const;
const EXPORT_SCALES = [1, 0.85, 0.7] as const;
const MAX_EXPORT_BYTES = 100 * 1024;

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
	new Promise<Blob | null>((resolve) => {
		canvas.toBlob((blob) => resolve(blob), type, quality);
	});

const createScaledCanvas = (sourceCanvas: HTMLCanvasElement, scale: number) => {
	if (scale === 1) {
		return sourceCanvas;
	}

	const exportCanvas = document.createElement('canvas');
	exportCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
	exportCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

	const exportContext = exportCanvas.getContext('2d');
	if (!exportContext) {
		return null;
	}

	exportContext.fillStyle = '#fdfbf7';
	exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
	exportContext.imageSmoothingEnabled = true;
	exportContext.imageSmoothingQuality = 'high';
	exportContext.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

	return exportCanvas;
};

export const exportArtworkFile = async (canvas: HTMLCanvasElement) => {
	for (const scale of EXPORT_SCALES) {
		const exportCanvas = createScaledCanvas(canvas, scale);
		if (!exportCanvas) {
			continue;
		}

		for (const quality of EXPORT_QUALITIES) {
			const blob = await canvasToBlob(exportCanvas, EXPORT_TYPE, quality);
			if (!blob || blob.size === 0 || blob.type !== EXPORT_TYPE) {
				continue;
			}

			if (blob.size <= MAX_EXPORT_BYTES) {
				return new File([blob], 'artwork.webp', { type: EXPORT_TYPE });
			}
		}
	}

	return null;
};
