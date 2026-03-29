<script lang="ts">
	import { onMount } from 'svelte';
	import { drawingTools } from '$lib/features/studio-drawing/state/drawing.svelte';

	let {
		canvasRef = $bindable<HTMLCanvasElement | null>(null),
		clearVersion = 0,
		interactive = true,
		statusMessage = '',
		statusTone = 'idle'
	}: {
		canvasRef?: HTMLCanvasElement | null;
		clearVersion?: number;
		interactive?: boolean;
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

	const stopDrawing = () => {
		isDrawing = false;
	};

	onMount(() => {
		paintBackground();

		window.addEventListener('mouseup', stopDrawing);
		window.addEventListener('blur', stopDrawing);

		return () => {
			window.removeEventListener('mouseup', stopDrawing);
			window.removeEventListener('blur', stopDrawing);
		};
	});

	$effect(() => {
		if (clearVersion >= 0) {
			paintBackground();
		}
	});

	function startDrawing(e: MouseEvent) {
		if (!interactive) return;
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
		if (!interactive) return;
		if (e.buttons === 0) {
			stopDrawing();
			return;
		}
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
</script>

<div class="relative flex h-full w-full items-stretch">
	<canvas
		bind:this={canvasRef}
		width={800}
		height={600}
		class={`h-full w-full rounded-lg ${interactive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-85'}`}
		style="background: #fdfbf7;"
		aria-disabled={!interactive}
		onmousedown={startDrawing}
		onmousemove={draw}
		onmouseup={stopDrawing}
	></canvas>

	{#if statusMessage}
		<div
			class={`absolute -bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 text-sm italic ${statusTone === 'error' ? 'text-[#8f3720]' : 'text-[#6b625a]'}`}
			style="font-family: 'Baloo 2', sans-serif;"
		>
			<div
				class={`h-2 w-2 rounded-full ${statusTone === 'error' ? 'bg-[#c84f4f]' : 'bg-[#8b9d91]'}`}
			></div>
			{statusMessage}
		</div>
	{/if}
</div>
