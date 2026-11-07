import { describe, expect, it } from 'vitest';
import type { InkDocument, InkStroke } from '#lib/stroke/v3.js';
import { exportTimelapseVideo } from './export-video';

/*
 * The video, judged the way a visitor would: played back. It is encoded for
 * real, opened in a <video>, and its frames are read off the screen.
 */

// Small: the encoding is real, and on a machine with no video chip it is slow.
const side = 256;

const BACKGROUND = [253, 251, 247];
const INK = [29, 53, 87];
const RED = [230, 57, 70];

const line = (from: [number, number], to: [number, number], start: number) => {
	const points: [number, number][] = Array.from({ length: 11 }, (_, i) => [
		from[0] + ((to[0] - from[0]) * i) / 10,
		from[1] + ((to[1] - from[1]) * i) / 10
	]);
	return {
		brush: 'round@1',
		color: '#1d3557',
		pointer: 'mouse',
		points,
		size: 60,
		start,
		times: points.map((_, i) => i * 16)
	} satisfies InkStroke;
};

const drawing = (strokes: InkStroke[]): InkDocument => ({
	background: '#fdfbf7',
	height: 768,
	kind: 'artwork',
	strokes,
	width: 768
});

const twoLines = drawing([line([150, 200], [350, 200], 0), line([450, 550], [650, 550], 500)]);

/** Opens a video, and reads a colour off any moment of it, in document pixels. */
const play = async (blob: Blob) => {
	const video = document.createElement('video');
	video.muted = true;
	video.preload = 'auto';
	video.src = URL.createObjectURL(blob);
	await new Promise((resolve, reject) => {
		video.onloadeddata = resolve;
		video.onerror = () => reject(new Error('The video does not play'));
	});

	const colourAt = async (seconds: number, x: number, y: number) => {
		await new Promise((resolve) => {
			video.onseeked = resolve;
			video.currentTime = seconds;
		});
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const context = canvas.getContext('2d', { willReadFrequently: true })!;
		context.drawImage(video, 0, 0);
		const scale = canvas.width / 768;
		return [...context.getImageData(x * scale, y * scale, 1, 1).data.slice(0, 3)];
	};

	return { colourAt, video };
};

/** Video is lossy: near enough the colour, not the exact one. */
const expectNear = (actual: number[], expected: number[]) => {
	actual.forEach((channel, index) => {
		expect(Math.abs(channel - expected[index]!)).toBeLessThanOrEqual(24);
	});
};

describe('exportTimelapseVideo', () => {
	it('draws the piece from blank paper to the finished picture, and rests on it', async () => {
		const { blob, extension } = await exportTimelapseVideo({ drawing: twoLines, side });

		expect(['mp4', 'webm']).toContain(extension);
		expect(blob.type).toContain(`video/${extension}`);

		const { colourAt, video } = await play(blob);
		expect(video.videoWidth).toBe(side);
		expect(video.videoHeight).toBe(side);
		// Two thirds of a second of drawing and two of rest.
		expect(video.duration).toBeGreaterThan(2.4);
		expect(video.duration).toBeLessThan(3);

		expectNear(await colourAt(0, 250, 200), BACKGROUND);
		expectNear(await colourAt(0, 550, 550), BACKGROUND);

		const end = video.duration - 0.1;
		expectNear(await colourAt(end, 250, 200), INK);
		expectNear(await colourAt(end, 550, 550), INK);
	});

	it('comes out the size of a square post by default', async () => {
		const { blob } = await exportTimelapseVideo({
			drawing: drawing([line([100, 100], [200, 100], 0)])
		});

		const { video } = await play(blob);
		expect(video.videoWidth).toBe(1080);
		expect(video.videoHeight).toBe(1080);
	}, 60_000);

	it('draws a fork over the image it was drawn on', async () => {
		const parent = document.createElement('canvas');
		parent.width = parent.height = 8;
		const context = parent.getContext('2d')!;
		context.fillStyle = '#e63946';
		context.fillRect(0, 0, 8, 8);

		const { blob } = await exportTimelapseVideo({
			backdropUrl: parent.toDataURL(),
			drawing: twoLines,
			side
		});

		const { colourAt } = await play(blob);
		expectNear(await colourAt(0, 700, 100), RED);
	});

	it('says how far along it is, up to the whole way', async () => {
		const seen: number[] = [];

		await exportTimelapseVideo({
			drawing: twoLines,
			onProgress: (share) => seen.push(share),
			side
		});

		expect(seen.length).toBeGreaterThan(1);
		expect(seen).toEqual([...seen].sort((a, b) => a - b));
		expect(seen.at(-1)).toBe(1);
	});

	it('stops when the visitor gives up on it', async () => {
		const giveUp = new AbortController();

		const exporting = exportTimelapseVideo({
			drawing: twoLines,
			onProgress: () => giveUp.abort(),
			side,
			signal: giveUp.signal
		});

		await expect(exporting).rejects.toMatchObject({ name: 'AbortError' });
	});
});
