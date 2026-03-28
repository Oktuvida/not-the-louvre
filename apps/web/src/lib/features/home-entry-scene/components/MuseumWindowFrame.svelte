<script lang="ts">
	import { onMount } from 'svelte';
	import {
		drawMuseumWindowFrame,
		museumWindowAspectRatio
	} from '$lib/features/home-entry-scene/canvas/museum-canvas';

	let canvas = $state<HTMLCanvasElement | null>(null);

	const renderFrame = () => {
		if (!canvas) {
			return;
		}

		const ratio = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
		const height = Math.max(1, Math.round(canvas.clientHeight * ratio));

		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext('2d');
		if (!context) {
			return;
		}

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, width, height);
		context.scale(width / 720, height / 640);
		drawMuseumWindowFrame(context);
		context.setTransform(1, 0, 0, 1, 0, 0);
	};

	onMount(() => {
		renderFrame();
		window.addEventListener('resize', renderFrame);

		return () => {
			window.removeEventListener('resize', renderFrame);
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="absolute inset-0 h-full w-full"
	style={`aspect-ratio:${museumWindowAspectRatio};`}
></canvas>
