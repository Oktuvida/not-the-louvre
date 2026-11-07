<script lang="ts">
	import { onMount } from 'svelte';
	import { Download, Pause, Play, RotateCcw, X } from 'lucide-svelte';
	import { saveBlob } from '#lib/client/save-blob.js';
	import { createInkSurface, type InkSurface } from '#lib/features/studio-drawing/ink-surface.js';
	import type { InkDocument } from '#lib/stroke/v3.js';
	import { canExportVideo, exportTimelapseVideo } from './export-video';
	import { createReplay } from './replay';

	/*
	 * An artwork drawn again, stroke by stroke, at the pace it was drawn, on the
	 * studio's ink surface. A visitor can take it away as a video, which is made
	 * on a surface of its own and leaves the replay on screen alone.
	 */

	let {
		drawing,
		backdropUrl = null,
		autoplay = true,
		exportVideo = exportTimelapseVideo,
		label = 'Timelapse',
		onClose,
		onVideoFailed,
		videoName
	}: {
		/** The drawing; it is read once, so a new one needs a new player. */
		drawing: InkDocument;
		/** The image a fork was drawn over, under every stroke. */
		backdropUrl?: string | null;
		autoplay?: boolean;
		exportVideo?: typeof exportTimelapseVideo;
		label?: string;
		onClose?: () => void;
		onVideoFailed?: () => void;
		/** What to call the video, without its extension; none, and none is offered. */
		videoName?: string;
	} = $props();

	const SPEEDS = [1, 2, 4, 8, 16];
	// A replay should be over in about half a minute: a long drawing starts faster.
	const COMFORTABLE_REPLAY_MS = 30_000;

	// svelte-ignore state_referenced_locally
	const replay = createReplay(drawing);
	const { timeline } = replay;
	const initialSpeed =
		SPEEDS.find((speed) => timeline.duration / speed <= COMFORTABLE_REPLAY_MS) ?? SPEEDS.at(-1)!;

	let at = $state(0);
	let playing = $state(false);
	let speed = $state(initialSpeed);
	let surface = $state<InkSurface | null>(null);
	let canvasRef: HTMLCanvasElement | undefined = $state();
	let overlayRef: HTMLCanvasElement | undefined = $state();

	const finished = $derived(!playing && at >= timeline.duration);

	$effect(() => {
		const moment = at;
		if (surface) replay.showMoment(surface, moment);
	});

	let frame = 0;
	let lastFrameAt = 0;

	const tick = (now: number) => {
		at = Math.min(timeline.duration, at + (lastFrameAt ? now - lastFrameAt : 0) * speed);
		lastFrameAt = now;
		if (at >= timeline.duration) {
			playing = false;
			frame = 0;
			return;
		}
		frame = requestAnimationFrame(tick);
	};

	const play = () => {
		if (at >= timeline.duration) at = 0;
		playing = true;
		lastFrameAt = 0;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(tick);
	};

	const pause = () => {
		playing = false;
		cancelAnimationFrame(frame);
		frame = 0;
	};

	const nextSpeed = () => {
		speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
	};

	const canSaveVideo = canExportVideo();
	let videoProgress = $state<number | null>(null);
	let giveUpOnVideo: AbortController | null = null;
	const videoPercent = $derived(Math.round((videoProgress ?? 0) * 100));

	const saveVideo = async () => {
		if (!videoName || videoProgress !== null) return;

		const giveUp = new AbortController();
		giveUpOnVideo = giveUp;
		videoProgress = 0;

		try {
			const { blob, extension } = await exportVideo({
				backdropUrl,
				drawing,
				onProgress: (share) => {
					videoProgress = share;
				},
				signal: giveUp.signal
			});
			saveBlob(blob, `${videoName}.${extension}`);
		} catch {
			// Closing the replay gives up on the video: nothing went wrong.
			if (!giveUp.signal.aborted) onVideoFailed?.();
		} finally {
			videoProgress = null;
		}
	};

	// The parent's image under a fork's strokes, painted once it has loaded.
	$effect(() => {
		const source = backdropUrl;
		const target = surface;
		if (!source || !target) return;

		let current = true;
		const image = new Image();
		image.decoding = 'async';
		image.src = source;
		void image.decode().then(
			() => {
				if (current) target.setBackdrop(image);
			},
			() => {}
		);
		return () => {
			current = false;
		};
	});

	onMount(() => {
		if (!canvasRef || !overlayRef) return;

		const canvas = canvasRef;
		const inkSurface = createInkSurface(canvas, overlayRef);
		const fitToBox = () =>
			inkSurface.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);

		fitToBox();
		inkSurface.showDocument(replay.shown);
		surface = inkSurface;
		if (autoplay) play();

		const resizeObserver = new ResizeObserver(fitToBox);
		resizeObserver.observe(canvas);

		return () => {
			resizeObserver.disconnect();
			cancelAnimationFrame(frame);
			giveUpOnVideo?.abort();
			inkSurface.destroy();
			surface = null;
		};
	});
</script>

<div class="timelapse">
	<!-- Sized inline as well: a canvas sized from its own pixel count would
	     grow every time its backing store does. -->
	<canvas
		bind:this={canvasRef}
		class="timelapse-canvas"
		style="width: 100%; aspect-ratio: 1; display: block;"
		aria-label={label}
	></canvas>
	<canvas bind:this={overlayRef} class="timelapse-overlay" aria-hidden="true"></canvas>

	<div class="timelapse-controls">
		<button
			type="button"
			class="timelapse-button"
			aria-label={playing ? 'Pause' : finished ? 'Replay' : 'Play'}
			onclick={playing ? pause : play}
		>
			{#if playing}
				<Pause class="h-4 w-4" />
			{:else if finished}
				<RotateCcw class="h-4 w-4" />
			{:else}
				<Play class="h-4 w-4" />
			{/if}
		</button>
		<input
			class="timelapse-scrubber"
			type="range"
			min="0"
			max={timeline.duration}
			step="any"
			value={at}
			aria-label="Replay position"
			oninput={(event) => {
				at = Number(event.currentTarget.value);
			}}
		/>
		<button
			type="button"
			class="timelapse-button timelapse-speed"
			aria-label={`Speed ${speed}×`}
			onclick={nextSpeed}>{speed}×</button
		>
		{#if videoName && canSaveVideo}
			<button
				type="button"
				class="timelapse-button timelapse-save"
				aria-label={videoProgress === null ? 'Save as video' : `Making the video, ${videoPercent}%`}
				disabled={videoProgress !== null}
				onclick={saveVideo}
			>
				{#if videoProgress === null}
					<Download class="h-4 w-4" />
				{:else}
					{videoPercent}%
				{/if}
			</button>
		{/if}
		{#if onClose}
			<button type="button" class="timelapse-button" aria-label="Close timelapse" onclick={onClose}>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>
</div>

<style>
	.timelapse {
		position: relative;
		width: 100%;
	}

	.timelapse-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.timelapse-controls {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		background: linear-gradient(to top, rgba(45, 36, 32, 0.72), rgba(45, 36, 32, 0));
		color: #fdfbf7;
	}

	.timelapse-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
		border-radius: 999px;
		background: rgba(253, 251, 247, 0.16);
		font-family: var(--font-display);
		font-size: 0.8rem;
		font-weight: 800;
	}

	.timelapse-button:focus-visible {
		outline: 2px solid #fdfbf7;
		outline-offset: 2px;
	}

	.timelapse-speed,
	.timelapse-save {
		padding-inline: 8px;
	}

	/* Wide enough for 100%: the bar stays put while the number climbs. */
	.timelapse-save:disabled {
		min-width: 46px;
		font-variant-numeric: tabular-nums;
	}

	.timelapse-scrubber {
		flex: 1;
		min-width: 0;
		accent-color: #fdfbf7;
	}
</style>
