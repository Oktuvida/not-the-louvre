import { createInkSurface } from '#lib/features/studio-drawing/ink-surface.js';
import type { InkDocument } from '#lib/stroke/v3.js';
import { createReplay } from './replay';
import { planVideo, VIDEO_FPS, VIDEO_SIDE } from './video-plan';

/*
 * A replay as a video file, made in the browser: the strokes are drawn again
 * frame by frame and encoded by the device's own encoder, faster than the
 * replay plays, so the server never touches video. H.264 in an MP4 is what
 * plays and posts everywhere; a browser that cannot encode it gets VP9 in a
 * WebM. The muxer is 700 KB, so it loads when a video is asked for.
 */

export type TimelapseVideo = { blob: Blob; extension: 'mp4' | 'webm' };

/** How many frames go by between letting the page repaint its progress. */
const FRAMES_BETWEEN_BREATHS = 8;

const breathe = () => new Promise((resolve) => setTimeout(resolve));

export const canExportVideo = () => typeof VideoEncoder !== 'undefined';

const loadBackdrop = async (url: string) => {
	const image = new Image();
	image.src = url;
	await image.decode();
	return image;
};

export const exportTimelapseVideo = async ({
	backdropUrl = null,
	drawing,
	onProgress,
	side = VIDEO_SIDE,
	signal
}: {
	/** The image a fork was drawn over, under every stroke. */
	backdropUrl?: string | null;
	drawing: InkDocument;
	/** How much of the video is done, from just over 0 to 1. */
	onProgress?: (share: number) => void;
	side?: number;
	signal?: AbortSignal;
}): Promise<TimelapseVideo> => {
	const {
		BufferTarget,
		CanvasSource,
		getFirstEncodableVideoCodec,
		Mp4OutputFormat,
		Output,
		QUALITY_HIGH,
		WebMOutputFormat
	} = await import('mediabunny');

	const codec = await getFirstEncodableVideoCodec(['avc', 'vp9'], { height: side, width: side });
	if (!codec) throw new Error('This browser cannot encode video');

	const canvas = document.createElement('canvas');
	const surface = createInkSurface(canvas, document.createElement('canvas'));
	surface.resize(side, side, 1);
	if (backdropUrl) surface.setBackdrop(await loadBackdrop(backdropUrl));

	const replay = createReplay(drawing);
	const plan = planVideo(replay.timeline.duration);
	surface.showDocument(replay.shown);

	const extension = codec === 'avc' ? 'mp4' : 'webm';
	const target = new BufferTarget();
	const output = new Output({
		format:
			extension === 'mp4'
				? new Mp4OutputFormat({ fastStart: 'in-memory' })
				: new WebMOutputFormat(),
		target
	});
	const source = new CanvasSource(canvas, { bitrate: QUALITY_HIGH, codec });
	output.addVideoTrack(source, { frameRate: VIDEO_FPS });

	try {
		await output.start();

		for (let frame = 0; frame < plan.frames; frame += 1) {
			signal?.throwIfAborted();

			replay.showMoment(surface, plan.momentOf(frame));
			surface.flush();
			await source.add(frame / VIDEO_FPS, 1 / VIDEO_FPS);

			onProgress?.((frame + 1) / plan.frames);
			if ((frame + 1) % FRAMES_BETWEEN_BREATHS === 0) await breathe();
		}

		await output.finalize();
	} catch (error) {
		await output.cancel().catch(() => {});
		throw error;
	} finally {
		surface.destroy();
	}

	return {
		blob: new Blob([target.buffer!], { type: `video/${extension}` }),
		extension
	};
};
