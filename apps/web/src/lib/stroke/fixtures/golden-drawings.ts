import {
	createEmptyDrawingDocumentV2,
	type DrawingDocumentV2,
	type DrawingStroke
} from '../../features/stroke-json/document';

/*
 * Drawings whose published image is kept in fixtures/golden/<name>.png. The
 * server's render must reproduce them exactly and the studio canvas closely,
 * so the picture on the wall is the picture that was drawn.
 */

const level = (pressure: number) => Math.round(pressure * 1023) / 1023;

const wave = (count: number, y: number, amplitude: number) =>
	Array.from(
		{ length: count },
		(_, index) =>
			[
				80 + (index * 600) / (count - 1),
				Math.round((y + Math.sin(index / 6) * amplitude) * 4) / 4
			] as [number, number]
	);

const round = (stroke: Omit<DrawingStroke, 'brush' | 'pointer'>): DrawingStroke => ({
	brush: 'round@1',
	pointer: 'mouse',
	...stroke
});

const pen = (points: [number, number][], pressures: number[], color: string, size: number) => ({
	brush: 'ink@1' as const,
	color,
	pointer: 'pen' as const,
	points,
	pressures: pressures.map(level),
	size,
	start: 0,
	times: points.map((_, index) => index * 4)
});

const drawing = (tail: DrawingStroke[]): DrawingDocumentV2 => ({
	...createEmptyDrawingDocumentV2('artwork'),
	tail
});

export const GOLDEN_DRAWINGS: { document: DrawingDocumentV2; name: string }[] = [
	{
		name: 'round-lines',
		document: drawing([
			round({ color: '#1d3557', points: wave(60, 200, 40), size: 4 }),
			round({ color: '#e76f51', points: wave(60, 400, 60), size: 18 }),
			round({ color: '#2a9d8f', points: [[384, 640]], size: 32 })
		])
	},
	{
		name: 'pen-pressure',
		document: drawing([
			pen(
				wave(80, 300, 50),
				Array.from({ length: 80 }, (_, index) => 0.1 + (index / 79) * 0.9),
				'#264653',
				24
			),
			pen(
				wave(40, 560, 20),
				Array.from({ length: 40 }, (_, index) => 0.5 + Math.sin(index / 4) * 0.4),
				'#9c4a3c',
				12
			)
		])
	},
	{
		name: 'eraser-over-ink',
		document: drawing([
			round({ color: '#1d3557', points: wave(60, 384, 0), size: 48 }),
			{
				brush: 'eraser@1',
				color: '#fdfbf7',
				pointer: 'touch',
				points: [
					[384, 200],
					[384, 568]
				],
				size: 20,
				start: 0,
				times: [0, 40]
			}
		])
	}
];
