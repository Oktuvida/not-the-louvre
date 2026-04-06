<script lang="ts">
	import {
		createMuseumWindowFrameUrl,
		museumWindowAspectRatio
	} from '$lib/features/home-entry-scene/canvas/museum-canvas';

	const frameUrl = createMuseumWindowFrameUrl();
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
