<script lang="ts" module>
	import { getCanvasContext, getFrequentReadCanvasContext } from '$lib/client/canvas-2d';
	import {
		drawArtworkFrame,
		getArtworkFrameOpeningRatio
	} from '$lib/features/artwork-presentation/canvas/artwork-frame-canvas';
	import type { ArtworkFrameRenderOptions } from '$lib/features/artwork-presentation/model/frame';

	type FrameOpening = { h: number; w: number; x: number; y: number };
	type PaintedFrame = { opening: FrameOpening; source: HTMLCanvasElement };

	/* drawArtworkFrame is deterministic — every seed inside it is a constant —
	 * so two frames with the same pixel size and render options are identical
	 * bitmaps. Painting one of them costs up to three whole-canvas
	 * getImageData/putImageData passes, so a grid of cards collapses onto a
	 * handful of cached sources that every instance just blits. */
	const FRAME_CACHE_LIMIT = 24;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- module-level bitmap cache, deliberately non-reactive
	const frameCache = new Map<string, PaintedFrame>();

	const paintFrame = (
		key: string,
		width: number,
		height: number,
		renderOptions: ArtworkFrameRenderOptions
	): PaintedFrame | null => {
		const cached = frameCache.get(key);

		if (cached) {
			// Refresh the LRU position so hot sizes survive the eviction sweep.
			frameCache.delete(key);
			frameCache.set(key, cached);
			return cached;
		}

		const source = document.createElement('canvas');
		source.width = width;
		source.height = height;

		const context = getFrequentReadCanvasContext(source);

		if (!context) {
			return null;
		}

		const painted: PaintedFrame = {
			opening: drawArtworkFrame(context, width, height, renderOptions),
			source
		};
		frameCache.set(key, painted);

		while (frameCache.size > FRAME_CACHE_LIMIT) {
			const oldest = frameCache.keys().next().value;
			if (oldest === undefined) break;
			frameCache.delete(oldest);
		}

		return painted;
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ArtworkFrameDescriptor } from '$lib/features/artwork-presentation/model/frame';

	let {
		children,
		frame,
		className = '',
		openingClass = '',
		testId
	}: {
		children?: Snippet;
		frame: ArtworkFrameDescriptor;
		className?: string;
		openingClass?: string;
		testId?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let host = $state<HTMLDivElement | null>(null);
	let measuredOpeningStyle = $state<string | null>(null);
	let renderedKey = '';

	/* Server-rendered geometry. The canvas insets the opening by a ratio of the
	 * shorter side; expressed as a percentage per axis that is exact for the
	 * square boxes every call site gives the frame, and the effect below
	 * replaces it with the measured pixels a moment later either way. Without
	 * it the SSR markup paints the artwork at 100% of the frame box and
	 * hydration snaps it down by ~28%. */
	const openingInset = $derived(getArtworkFrameOpeningRatio(frame.preset.renderOptions) * 100);
	const openingStyle = $derived(
		measuredOpeningStyle ??
			[
				`left:${openingInset}%`,
				`top:${openingInset}%`,
				`width:${100 - openingInset * 2}%`,
				`height:${100 - openingInset * 2}%`
			].join(';')
	);

	const renderFrame = () => {
		if (!canvas || !host) {
			return;
		}

		const bounds = host.getBoundingClientRect();

		if (bounds.width === 0 || bounds.height === 0) {
			return;
		}

		/* Pin the canvas' CSS box to the host's measured box. A canvas with no CSS
		 * size lays out at its *bitmap* size, so the ResizeObserver below would
		 * observe its own writes and grow the frame a little on every frame. */
		canvas.style.width = `${bounds.width}px`;
		canvas.style.height = `${bounds.height}px`;

		const ratio = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.round(bounds.width * ratio));
		const height = Math.max(1, Math.round(bounds.height * ratio));
		const renderOptions = frame.preset.renderOptions;
		// Keyed on the options and not on preset.id: resolveArtworkFrame clones a
		// premium preset and overrides `aged`/`colorScheme` per podium position
		// while keeping the same id, so gold would be served to silver and bronze.
		const key = `${width}x${height}|${JSON.stringify(renderOptions)}`;

		// Memo guard: the mount effect and the ResizeObserver's initial callback
		// both fire, and neither should repaint what is already on the canvas.
		if (key === renderedKey) {
			return;
		}

		const painted = paintFrame(key, width, height, renderOptions);

		if (!painted) {
			return;
		}

		canvas.width = width;
		canvas.height = height;

		const context = getCanvasContext(canvas);

		if (!context) {
			return;
		}

		context.clearRect(0, 0, width, height);
		context.drawImage(painted.source, 0, 0);

		renderedKey = key;
		measuredOpeningStyle = [
			`left:${(painted.opening.x / width) * 100}%`,
			`top:${(painted.opening.y / height) * 100}%`,
			`width:${(painted.opening.w / width) * 100}%`,
			`height:${(painted.opening.h / height) * 100}%`
		].join(';');
	};

	$effect(() => {
		void frame.preset.renderOptions;
		void canvas;
		void host;
		renderFrame();
	});

	// A ResizeObserver on the host also catches the virtualizer re-chunking its
	// columns, which never fires a window resize. rAF-coalesced, the same shape
	// VirtualizedGrid uses, so a drag-resize does one repaint per frame.
	$effect(() => {
		if (!host) {
			return;
		}

		let pendingFrame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(pendingFrame);
			pendingFrame = requestAnimationFrame(() => {
				renderFrame();
			});
		});

		observer.observe(host);

		return () => {
			cancelAnimationFrame(pendingFrame);
			observer.disconnect();
		};
	});
</script>

<div
	bind:this={host}
	class={`frame-root ${className}`}
	data-testid={testId}
	data-frame-preset={frame.preset.id}
	data-frame-tier={frame.tier}
	data-premium-marker={frame.isPremium ? 'true' : 'false'}
>
	<canvas bind:this={canvas} class="frame-canvas absolute inset-0 h-full w-full"></canvas>

	<div class={`artwork-opening ${openingClass}`} style={openingStyle}>
		{@render children?.()}
	</div>
</div>

<style>
	.frame-root {
		position: relative;
		display: block;
	}

	/* A canvas is `inline` by default, and an inline box sits on a text
	 * baseline: the descender gap under it would feed back into the host's
	 * height every time the ResizeObserver re-measured. */
	.frame-canvas {
		display: block;
	}

	.artwork-opening {
		position: absolute;
		overflow: hidden;
	}
</style>
