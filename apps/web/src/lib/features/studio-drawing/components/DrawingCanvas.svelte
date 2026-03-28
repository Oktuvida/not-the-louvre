<script lang="ts">
	import { onMount } from 'svelte';
	import { drawingTools } from '$lib/features/studio-drawing/state/drawing.svelte';

	let {
		canvasRef = $bindable<HTMLCanvasElement | null>(null),
		clearVersion = 0,
		statusMessage = '',
		statusTone = 'idle'
	}: {
		canvasRef?: HTMLCanvasElement | null;
		clearVersion?: number;
		statusMessage?: string;
		statusTone?: 'error' | 'success' | 'idle';
	} = $props();

	let isDrawing = $state(false);

	const paintBackground = () => {
		if (!canvasRef) return;
		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#fdfbf7';
		ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
	};

	onMount(() => {
		paintBackground();
	});

	$effect(() => {
		if (clearVersion >= 0) {
			paintBackground();
		}
	});

	function startDrawing(e: MouseEvent) {
		if (!canvasRef) return;
		const rect = canvasRef.getBoundingClientRect();
		const scaleX = canvasRef.width / rect.width;
		const scaleY = canvasRef.height / rect.height;
		const x = (e.clientX - rect.left) * scaleX;
		const y = (e.clientY - rect.top) * scaleY;

		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;

		ctx.beginPath();
		ctx.moveTo(x, y);
		isDrawing = true;
	}

	function draw(e: MouseEvent) {
		if (!isDrawing || !canvasRef) return;
		const rect = canvasRef.getBoundingClientRect();
		const scaleX = canvasRef.width / rect.width;
		const scaleY = canvasRef.height / rect.height;
		const x = (e.clientX - rect.left) * scaleX;
		const y = (e.clientY - rect.top) * scaleY;

		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;

		ctx.lineTo(x, y);
		ctx.strokeStyle = drawingTools.activeColor;
		ctx.lineWidth = drawingTools.brushSize;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke();
	}

	function stopDrawing() {
		isDrawing = false;
	}
</script>

<div class="relative">
	<div class="relative rounded-sm border-[8px] border-[#5d4e37] bg-[#fdfbf7] p-8 shadow-2xl">
		<div
			class="absolute -top-4 left-1/2 h-8 w-32 -translate-x-1/2 rounded-t-lg bg-[#5d4e37] shadow-md"
		></div>

		<canvas
			bind:this={canvasRef}
			width={800}
			height={600}
			class="w-full cursor-crosshair border-4 border-[#2d2420] shadow-inner"
			style="background: #fdfbf7; max-width: 800px;"
			onmousedown={startDrawing}
			onmousemove={draw}
			onmouseup={stopDrawing}
			onmouseleave={stopDrawing}
		></canvas>

		<div
			class="pointer-events-none absolute inset-8 opacity-10"
			style="background-image:url(data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E)"
		></div>
	</div>

	{#if statusMessage}
		<div
			class={`absolute -bottom-12 left-1/2 flex -translate-x-1/2 items-center gap-2 text-sm italic ${statusTone === 'error' ? 'text-[#8f3720]' : 'text-[#6b625a]'}`}
			style="font-family: 'Baloo 2', sans-serif;"
		>
			<div
				class={`h-2 w-2 rounded-full ${statusTone === 'error' ? 'bg-[#c84f4f]' : 'bg-[#8b9d91]'}`}
			></div>
			{statusMessage}
		</div>
	{/if}
</div>
