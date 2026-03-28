<script lang="ts">
	import { resolve } from '$app/paths';
	import DrawingCanvas from '$lib/features/studio-drawing/components/DrawingCanvas.svelte';
	import DrawingToolTray from '$lib/features/studio-drawing/tools/DrawingToolTray.svelte';

	let lastSaved = $state<Date | null>(null);
	let canvasRef = $state<HTMLCanvasElement | null>(null);

	const publishArtwork = () => {
		lastSaved = new Date();
	};

	const clearCanvas = () => {
		if (!canvasRef) return;
		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#fdfbf7';
		ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
	};
</script>

<div class="relative h-screen w-full overflow-hidden bg-[#f5f0e8]">
	<!-- Studio Environment Background -->
	<div class="absolute inset-0">
		<div
			class="absolute inset-0 bg-gradient-to-t from-[#f5f0e8] via-transparent to-[#f5f0e8]/50"
		></div>
	</div>

	<!-- Back Button - Wooden Sign Style -->
	<a
		href={resolve('/')}
		class="absolute top-8 left-8 z-30 flex -rotate-1 items-center gap-2 rounded-lg border-3 border-[#2d2420] bg-[#8b9d91] px-6 py-3 font-semibold text-[#fdfbf7] shadow-lg transition-transform hover:scale-105"
		style="font-family: 'Baloo 2', sans-serif;"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
		>
		<span>Exit Studio</span>
	</a>

	<!-- Main Canvas Area - Easel Style (Centered) -->
	<div class="absolute inset-0 z-10 flex items-center justify-center">
		<DrawingCanvas bind:canvasRef {lastSaved} />
	</div>

	<!-- Drawing Tools - Right Side Centered -->
	<div class="absolute top-1/2 right-8 z-20 -translate-y-1/2">
		<DrawingToolTray onPublish={publishArtwork} onClear={clearCanvas} />
	</div>

	<!-- Character Painting Indicator -->
	<div
		class="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 text-sm text-[#6b625a] italic"
		style="font-family: 'Baloo 2', sans-serif;"
	>
		<div class="h-3 w-3 animate-bounce rounded-full bg-[#d4956c]"></div>
		Your character is painting...
	</div>
</div>
