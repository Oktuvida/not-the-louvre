<script lang="ts">
	import { onMount } from 'svelte';
	import {
		cloneDrawingDocument,
		createEmptyDrawingDocument,
		getDrawingPointWithinBounds,
		type DrawingDocumentV1,
		type DrawingPoint
	} from '$lib/features/stroke-json/document';
	import { renderDrawingDocumentToCanvas } from '$lib/features/stroke-json/canvas';
	import { drawingTools } from '$lib/features/studio-drawing/state/drawing.svelte';

	let {
		canvasRef = $bindable<HTMLCanvasElement | null>(null),
		drawingDocument = $bindable<DrawingDocumentV1>(createEmptyDrawingDocument('artwork')),
		clearVersion = 0,
		initialDrawingDocument = null,
		interactive = true,
		onInitialImageSettled,
		statusMessage = '',
		statusTone = 'idle'
	}: {
		canvasRef?: HTMLCanvasElement | null;
		drawingDocument?: DrawingDocumentV1;
		clearVersion?: number;
		initialDrawingDocument?: DrawingDocumentV1 | null;
		interactive?: boolean;
		onInitialImageSettled?: () => void;
		statusMessage?: string;
		statusTone?: 'error' | 'success' | 'idle';
	} = $props();

	let baselineDocument = $state<DrawingDocumentV1>(createEmptyDrawingDocument('artwork'));
	let isDrawing = $state(false);
	let lastAppliedClearVersion = $state<number | null>(null);

	const renderCurrentDocument = () => {
		if (!canvasRef) return;
		renderDrawingDocumentToCanvas(canvasRef, drawingDocument);
	};

	const stopDrawing = () => {
		isDrawing = false;
	};

	const getPoint = (event: MouseEvent): DrawingPoint | null => {
		if (!canvasRef) return null;

		const rect = canvasRef.getBoundingClientRect();
		const scaleX = canvasRef.width / rect.width;
		const scaleY = canvasRef.height / rect.height;

		return getDrawingPointWithinBounds(
			[(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY],
			drawingDocument
		);
	};

	const appendPoint = (point: DrawingPoint) => {
		const stroke = drawingDocument.strokes.at(-1);
		if (!stroke) return;

		const lastPoint = stroke.points.at(-1);
		if (lastPoint && Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]) < 2) {
			return;
		}

		stroke.points.push(point);
		renderCurrentDocument();
	};

	$effect(() => {
		const nextBaseline = initialDrawingDocument
			? cloneDrawingDocument(initialDrawingDocument)
			: createEmptyDrawingDocument('artwork');

		baselineDocument = nextBaseline;
		drawingDocument = cloneDrawingDocument(nextBaseline);
		onInitialImageSettled?.();
	});

	onMount(() => {
		renderCurrentDocument();

		window.addEventListener('mouseup', stopDrawing);
		window.addEventListener('blur', stopDrawing);

		return () => {
			window.removeEventListener('mouseup', stopDrawing);
			window.removeEventListener('blur', stopDrawing);
		};
	});

	$effect(() => {
		if (lastAppliedClearVersion === null) {
			lastAppliedClearVersion = clearVersion;
			return;
		}

		if (clearVersion === lastAppliedClearVersion) return;

		lastAppliedClearVersion = clearVersion;
		drawingDocument = cloneDrawingDocument(baselineDocument);
	});

	$effect(() => {
		renderCurrentDocument();
	});

	function startDrawing(e: MouseEvent) {
		if (!interactive) return;
		const point = getPoint(e);
		if (!point) return;

		drawingDocument.strokes.push({
			color: drawingTools.activeColor,
			points: [point],
			size: drawingTools.brushSize
		});
		renderCurrentDocument();
		isDrawing = true;
	}

	function draw(e: MouseEvent) {
		if (!interactive) return;
		if (e.buttons === 0) {
			stopDrawing();
			return;
		}
		if (!canvasRef) return;
		const point = getPoint(e);
		if (!point) return;
		if (!isDrawing) {
			drawingDocument.strokes.push({
				color: drawingTools.activeColor,
				points: [point],
				size: drawingTools.brushSize
			});
			renderCurrentDocument();
			isDrawing = true;
			return;
		}

		appendPoint(point);
	}
</script>

<div class="relative flex h-full w-full items-stretch">
	<canvas
		bind:this={canvasRef}
		width={768}
		height={768}
		class={`aspect-square h-full max-h-full w-auto max-w-full self-center rounded-lg ${interactive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-85'}`}
		style="background: #fdfbf7;"
		aria-disabled={!interactive}
		onmousedown={startDrawing}
		onmouseleave={stopDrawing}
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
