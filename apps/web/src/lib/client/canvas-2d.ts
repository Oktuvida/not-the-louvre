export function getFrequentReadCanvasContext(
	canvas: HTMLCanvasElement
): CanvasRenderingContext2D | null {
	try {
		return canvas.getContext('2d', { willReadFrequently: true });
	} catch {
		return canvas.getContext('2d');
	}
}
