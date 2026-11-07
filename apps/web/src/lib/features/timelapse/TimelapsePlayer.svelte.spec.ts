import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
		// Half a minute of lines: time enough to press Pause on any machine.
		const { slider } = await renderPlayer({
			drawing: drawing(
				Array.from({ length: 12 }, (_, i) => line([100, 100], [700, 700], i * 2600, 220))
			)
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

	describe('saving it as a video', () => {
		const VIDEO = { blob: new Blob(['video'], { type: 'video/mp4' }), extension: 'mp4' };

		afterEach(() => {
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
		});

		const saved = () => {
			const names: string[] = [];
			vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
				this: HTMLAnchorElement
			) {
				names.push(this.download);
			});
			return names;
		};

		it('saves the replay under the name of the piece', async () => {
			const names = saved();
			const exportVideo = vi.fn().mockResolvedValue(VIDEO);

			await renderPlayer({
				autoplay: false,
				backdropUrl: '/parent.webp',
				drawing: twoLines,
				exportVideo,
				videoName: 'two-lines'
			} as never);
			await page.getByRole('button', { name: 'Save as video' }).click();

			await vi.waitFor(() => expect(names).toEqual(['two-lines.mp4']));
			expect(exportVideo.mock.calls[0]![0]).toMatchObject({
				backdropUrl: '/parent.webp',
				drawing: twoLines
			});
		});

		it('shows how far along it is, and stays pressed until it is done', async () => {
			saved();
			let report: (share: number) => void = () => {};
			let finish: (video: typeof VIDEO) => void = () => {};
			const exportVideo = vi.fn(({ onProgress }: { onProgress: (share: number) => void }) => {
				report = onProgress;
				return new Promise((resolve) => (finish = resolve));
			});

			await renderPlayer({
				autoplay: false,
				drawing: twoLines,
				exportVideo,
				videoName: 'two-lines'
			} as never);
			await page.getByRole('button', { name: 'Save as video' }).click();

			report(0.42);
			const working = page.getByRole('button', { name: /Making the video/ });
			await expect.element(working).toHaveTextContent('42%');
			await expect.element(working).toBeDisabled();

			finish(VIDEO);
			await expect.element(page.getByRole('button', { name: 'Save as video' })).toBeEnabled();
			expect(exportVideo).toHaveBeenCalledOnce();
		});

		it('says so when the video could not be made, and lets the visitor try again', async () => {
			const onVideoFailed = vi.fn();

			await renderPlayer({
				autoplay: false,
				drawing: twoLines,
				exportVideo: vi.fn().mockRejectedValue(new Error('no encoder')),
				onVideoFailed,
				videoName: 'two-lines'
			} as never);
			await page.getByRole('button', { name: 'Save as video' }).click();

			await vi.waitFor(() => expect(onVideoFailed).toHaveBeenCalledOnce());
			await expect.element(page.getByRole('button', { name: 'Save as video' })).toBeEnabled();
		});

		it('gives up on the video when the replay is closed, without a word', async () => {
			const onVideoFailed = vi.fn();
			let signal: AbortSignal | undefined;
			const exportVideo = vi.fn((options: { signal: AbortSignal }) => {
				signal = options.signal;
				return new Promise((_, reject) => {
					options.signal.addEventListener('abort', () =>
						reject(new DOMException('Gave up', 'AbortError'))
					);
				});
			});

			const screen = await render(TimelapsePlayer, {
				autoplay: false,
				drawing: twoLines,
				exportVideo,
				label: 'Timelapse',
				onVideoFailed,
				videoName: 'two-lines'
			} as never);
			await page.getByRole('button', { name: 'Save as video' }).click();
			await vi.waitFor(() => expect(signal).toBeDefined());

			await screen.unmount();

			expect(signal?.aborted).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(onVideoFailed).not.toHaveBeenCalled();
		});

		it('is not offered where the browser cannot make video', async () => {
			vi.stubGlobal('VideoEncoder', undefined);

			await renderPlayer({ autoplay: false, drawing: twoLines, videoName: 'two-lines' } as never);

			await expect.element(page.getByRole('button', { name: /^Speed/ })).toBeVisible();
			expect(page.getByRole('button', { name: 'Save as video' }).query()).toBeNull();
		});
	});

	it('speeds up when asked', async () => {
		await renderPlayer({ autoplay: false, drawing: twoLines });

		await page.getByRole('button', { name: /^Speed/ }).click();

		await expect.element(page.getByRole('button', { name: /^Speed/ })).toHaveTextContent('2×');
	});
});
