export type RawImage = {
	data: Uint8ClampedArray;
	height: number;
	width: number;
};

export const cropCenter = (image: RawImage, width: number, height: number): RawImage => {
	const left = Math.max(0, Math.floor((image.width - width) / 2));
	const top = Math.max(0, Math.floor((image.height - height) / 2));
	const data = new Uint8ClampedArray(width * height * 4);

	for (let y = 0; y < height; y += 1) {
		const sourceStart = ((top + y) * image.width + left) * 4;

		data.set(image.data.subarray(sourceStart, sourceStart + width * 4), y * width * 4);
	}

	return { data, height, width };
};

// Multiplies each pixel's alpha by the antialiased coverage of a rounded
// rectangle spanning the full image, using the signed distance to its edge.
export const applyRoundedRectAlpha = (image: RawImage, radius: number): RawImage => {
	const data = new Uint8ClampedArray(image.data);
	const halfWidth = image.width / 2;
	const halfHeight = image.height / 2;

	for (let y = 0; y < image.height; y += 1) {
		for (let x = 0; x < image.width; x += 1) {
			const distanceX = Math.abs(x + 0.5 - halfWidth) - (halfWidth - radius);
			const distanceY = Math.abs(y + 0.5 - halfHeight) - (halfHeight - radius);
			const outside = Math.hypot(Math.max(distanceX, 0), Math.max(distanceY, 0));
			const inside = Math.min(Math.max(distanceX, distanceY), 0);
			const distance = outside + inside - radius;
			const coverage = Math.min(Math.max(0.5 - distance, 0), 1);
			const index = (y * image.width + x) * 4;

			data[index + 3] = image.data[index + 3] * coverage;
		}
	}

	return { data, height: image.height, width: image.width };
};
