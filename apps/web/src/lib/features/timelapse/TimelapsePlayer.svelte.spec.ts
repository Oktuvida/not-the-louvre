import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { InkDocument, InkStroke } from '#lib/stroke/v3.js';
import TimelapsePlayer from './TimelapsePlayer.svelte';

/*
 * The replay, judged by what a visitor sees on the canvas: blank paper at the
 * start, the strokes in the order and at the pace they were drawn, and the
 * finished drawing at the end.
 */

const BACKGROUND = [253, 251, 247];
const INK = [29, 53, 87];
const RED = [230, 57, 70];

const line = (from: [number, number], to: [number, number], start: number, step = 16) => {
	const points: [number, number][] = Array.from({ length: 11 }, (_, i) => [
		from[0] + ((to[0] - from[0]) * i) / 10,
		from[1] + ((to[1] - from[1]) * i) / 10
	]);
	return {
		brush: 'round@1',
		color: '#1d3557',
		pointer: 'mouse',
		points,
		size: 40,
		start,
		times: points.map((_, i) => i * step)
	} satisfies InkStroke;
};

const drawing = (strokes: InkStroke[]): InkDocument => ({
	background: '#fdfbf7',
	height: 768,
	kind: 'artwork',
	strokes,
	width: 768
});

// Two quick lines: the first takes 160 ms, the second starts 340 ms after it.
const twoLines = drawing([line([150, 200], [350, 200], 0), line([450, 550], [650, 550], 500)]);

const renderPlayer = async (props: {
	autoplay?: boolean;
	backdropUrl?: string;
	drawing: InkDocument;
}) => {
	await render(TimelapsePlayer, { label: 'Timelapse', ...props });
	const canvas = page.getByLabelText('Timelapse', { exact: true }).element() as HTMLCanvasElement;
	const slider = page
		.getByRole('slider', { name: 'Replay position' })
		.element() as HTMLInputElement;

	const colourAt = (x: number, y: number) => {
		const data = canvas
			.getContext('2d')!
			.getImageData(
				Math.floor((x * canvas.width) / 768),
				Math.floor((y * canvas.height) / 768),
				1,
				1
			).data;
		return [data[0], data[1], data[2]];
	};

	const scrubTo = (at: number) => {
		slider.value = String(at);
		slider.dispatchEvent(new Event('input', { bubbles: true }));
	};

	return { canvas, colourAt, scrubTo, slider };
};

describe('TimelapsePlayer', () => {
	it('plays the drawing from blank paper to the finished picture', async () => {
		const { colourAt } = await renderPlayer({ drawing: twoLines });

		await expect.poll(() => colourAt(250, 200)).toEqual(INK);
		await expect.poll(() => colourAt(550, 550)).toEqual(INK);
		await expect.element(page.getByRole('button', { name: 'Replay' })).toBeVisible();
	});

	it('shows what was on the paper at any moment the visitor scrubs to', async () => {
		const { colourAt, scrubTo } = await renderPlayer({ autoplay: false, drawing: twoLines });

		await expect.poll(() => colourAt(250, 200)).toEqual(BACKGROUND);

		// Between the two lines: only the first is down.
		scrubTo(300);
		await expect.poll(() => colourAt(250, 200)).toEqual(INK);
		expect(colourAt(550, 550)).toEqual(BACKGROUND);

		// Halfway through the first line: its start, not its end.
		scrubTo(80);
		await expect.poll(() => colourAt(350, 200)).toEqual(BACKGROUND);
		expect(colourAt(170, 200)).toEqual(INK);
	});

	it('stops where the visitor pauses it', async () => {
		// One long line, a little over two seconds.
		const { slider } = await renderPlayer({
			drawing: drawing([line([100, 100], [700, 700], 0, 220)])
		});

		await page.getByRole('button', { name: 'Pause' }).click();
		const pausedAt = Number(slider.value);
		await new Promise((resolve) => setTimeout(resolve, 300));

		expect(Number(slider.value)).toBe(pausedAt);
		expect(pausedAt).toBeLessThan(Number(slider.max));
	});

	it('replays a fork over the image it was drawn on', async () => {
		const parent = document.createElement('canvas');
		parent.width = parent.height = 8;
		const context = parent.getContext('2d')!;
		context.fillStyle = '#e63946';
		context.fillRect(0, 0, 8, 8);

		const { colourAt } = await renderPlayer({
			autoplay: false,
			backdropUrl: parent.toDataURL(),
			drawing: twoLines
		});

		await expect.poll(() => colourAt(700, 100)).toEqual(RED);
	});

	it('speeds up when asked', async () => {
		await renderPlayer({ autoplay: false, drawing: twoLines });

		await page.getByRole('button', { name: /^Speed/ }).click();

		await expect.element(page.getByRole('button', { name: /^Speed/ })).toHaveTextContent('2×');
	});
});
