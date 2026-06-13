export type RawImage = {
	data: Uint8ClampedArray;
	height: number;
	width: number;
};

export type RgbColor = { b: number; g: number; r: number };

export const parseHexColor = (color: string): RgbColor => {
	const normalized = color.replace('#', '');
	const expanded =
		normalized.length === 3
			? normalized
					.split('')
					.map((channel) => channel + channel)
					.join('')
			: normalized;

	if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
		throw new Error(`Unsupported background color: ${color}`);
	}

	return {
		b: parseInt(expanded.slice(4, 6), 16),
		g: parseInt(expanded.slice(2, 4), 16),
		r: parseInt(expanded.slice(0, 2), 16)
	};
};

export const createSolidImage = (width: number, height: number, color: RgbColor): RawImage => {
	const data = new Uint8ClampedArray(width * height * 4);

	for (let index = 0; index < data.length; index += 4) {
		data[index] = color.r;
		data[index + 1] = color.g;
		data[index + 2] = color.b;
		data[index + 3] = 255;
	}

	return { data, height, width };
};

export const flattenOntoBackground = (image: RawImage, color: RgbColor): RawImage => {
	const data = new Uint8ClampedArray(image.data.length);

	for (let index = 0; index < data.length; index += 4) {
		const alpha = image.data[index + 3] / 255;
		const inverse = 1 - alpha;

		data[index] = image.data[index] * alpha + color.r * inverse;
		data[index + 1] = image.data[index + 1] * alpha + color.g * inverse;
		data[index + 2] = image.data[index + 2] * alpha + color.b * inverse;
		data[index + 3] = 255;
	}

	return { data, height: image.height, width: image.width };
};

export const blitWithAlpha = (canvas: RawImage, image: RawImage, left: number, top: number) => {
	for (let y = 0; y < image.height; y += 1) {
		const targetY = top + y;

		if (targetY < 0 || targetY >= canvas.height) {
			continue;
		}

		for (let x = 0; x < image.width; x += 1) {
			const targetX = left + x;

			if (targetX < 0 || targetX >= canvas.width) {
				continue;
			}

			const sourceIndex = (y * image.width + x) * 4;
			const targetIndex = (targetY * canvas.width + targetX) * 4;
			const alpha = image.data[sourceIndex + 3] / 255;
			const inverse = 1 - alpha;

			canvas.data[targetIndex] =
				image.data[sourceIndex] * alpha + canvas.data[targetIndex] * inverse;
			canvas.data[targetIndex + 1] =
				image.data[sourceIndex + 1] * alpha + canvas.data[targetIndex + 1] * inverse;
			canvas.data[targetIndex + 2] =
				image.data[sourceIndex + 2] * alpha + canvas.data[targetIndex + 2] * inverse;
			canvas.data[targetIndex + 3] = 255;
		}
	}
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
