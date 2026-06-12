<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createMuseumWindowFrameUrl,
		museumWindowAspectRatio
	} from '$lib/features/home-entry-scene/canvas/museum-canvas';
	import { rasterizeSvgUrl } from '$lib/features/home-entry-scene/canvas/svg-bitmap';

	// The frame renders at most 49rem (784px) wide; raster at 2x for sharpness.
	const FRAME_MAX_WIDTH_CSS_PX = 784;
	const FRAME_VIEWBOX_RATIO = 640 / 720;

	// The SVG source renders the first (SSR-ready) frame; the bitmap replaces
	// it after mount so the wall zoom never re-rasterizes the vector art on
	// the main thread (see svg-bitmap).
	const frameSvgUrl = createMuseumWindowFrameUrl();
	let frameUrl = $state(frameSvgUrl);

	onMount(() => {
		const rasterScale = Math.min(window.devicePixelRatio || 1, 2);
		void rasterizeSvgUrl(frameSvgUrl, {
			height: FRAME_MAX_WIDTH_CSS_PX * rasterScale * FRAME_VIEWBOX_RATIO,
			width: FRAME_MAX_WIDTH_CSS_PX * rasterScale
		})
			.then((url) => {
				frameUrl = url;
			})
			.catch(() => {
				// Keep the SVG source if rasterization fails.
			});
	});
</script>

<img
	data-testid="museum-window-frame"
	src={frameUrl}
	alt=""
	aria-hidden="true"
	draggable="false"
	class="absolute inset-0 h-full w-full select-none"
	style={`aspect-ratio:${museumWindowAspectRatio};`}
/>
