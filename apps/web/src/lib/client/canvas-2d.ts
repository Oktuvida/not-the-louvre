/**
 * `willReadFrequently` keeps the bitmap on the CPU, which is what the
 * getImageData/putImageData weathering passes need — and exactly what a canvas
 * that only ever composites should avoid. Ask for the right one per canvas.
 */
export function getFrequentReadCanvasContext(
	canvas: HTMLCanvasElement
): CanvasRenderingContext2D | null {
	try {
		return canvas.getContext('2d', { willReadFrequently: true });
	} catch {
		return canvas.getContext('2d');
	}
}

/** GPU-backed 2D context for canvases that only draw and composite. */
export function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
	try {
		return canvas.getContext('2d');
	} catch {
		return null;
	}
}
