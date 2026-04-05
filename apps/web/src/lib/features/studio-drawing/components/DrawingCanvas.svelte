<script lang="ts">
	import { onMount } from 'svelte';
	import {
		cloneDrawingDocumentV2,
		createEmptyDrawingDocumentV2,
		getDrawingPointWithinBounds,
		serializeEditableDrawingDocument,
		type DrawingDocumentV2,
		type DrawingPoint,
		type DrawingStroke
	} from '$lib/features/stroke-json/document';
	import {
		renderDrawingDocumentToCanvas,
		renderDrawingStroke
	} from '$lib/features/stroke-json/canvas';
	import {
		appendBufferedStrokePoint,
		appendCommittedStroke,
		createBufferedStroke,
		shouldUseResponsiveDrawing
	} from '$lib/features/stroke-json/responsive-editing';
	import { drawingTools } from '$lib/features/studio-drawing/state/drawing.svelte';

	let {
		canvasRef = $bindable<HTMLCanvasElement | null>(null),
		drawingDocument = $bindable<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork')),
		clearVersion = 0,
		initialDrawingDocument = null,
		interactive = true,
		onDocumentChange,
		onInitialImageSettled,
		statusMessage = '',
		statusTone = 'idle'
	}: {
		canvasRef?: HTMLCanvasElement | null;
		drawingDocument?: DrawingDocumentV2;
		clearVersion?: number;
		initialDrawingDocument?: DrawingDocumentV2 | null;
		interactive?: boolean;
		onDocumentChange?: (document: DrawingDocumentV2) => void;
		onInitialImageSettled?: () => void;
		statusMessage?: string;
		statusTone?: 'error' | 'success' | 'idle';
	} = $props();

	let baselineDocument = $state<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork'));
	let activeStroke = $state<DrawingStroke | null>(null);
	let activePointerId = $state<number | null>(null);
	let isDrawing = $state(false);
	let lastAppliedClearVersion = $state<number | null>(null);
	let lastHydratedInitialDocumentSeed = $state<string | null | undefined>(undefined);
	let responsiveDrawing = $derived(shouldUseResponsiveDrawing(drawingDocument));
	let committedCacheCanvas: HTMLCanvasElement | null = null;
	let committedCacheDirty = true;

	const commitDrawingDocument = (nextDocument: DrawingDocumentV2) => {
		drawingDocument = nextDocument;
		committedCacheDirty = true;
		onDocumentChange?.(cloneDrawingDocumentV2(nextDocument));
	};

	const renderCommittedCache = () => {
		if (!canvasRef) return;

		committedCacheCanvas ??= window.document.createElement('canvas');
		if (
			committedCacheCanvas.width !== canvasRef.width ||
			committedCacheCanvas.height !== canvasRef.height
		) {
			committedCacheCanvas.width = canvasRef.width;
			committedCacheCanvas.height = canvasRef.height;
		}

		renderDrawingDocumentToCanvas(committedCacheCanvas, drawingDocument);
		committedCacheDirty = false;
	};

	const renderCurrentDocument = () => {
		if (!canvasRef) return;

		if (!responsiveDrawing) {
			renderDrawingDocumentToCanvas(canvasRef, drawingDocument);
			return;
		}

		if (committedCacheDirty || !committedCacheCanvas) {
			renderCommittedCache();
		}

		const context = canvasRef.getContext('2d');
		if (!context) return;

		context.fillStyle = drawingDocument.background;
		context.fillRect(0, 0, canvasRef.width, canvasRef.height);
		if (committedCacheCanvas) {
			context.drawImage(committedCacheCanvas, 0, 0);
		}
		if (activeStroke) {
			renderDrawingStroke(context, activeStroke);
		}
	};

	const stopDrawing = () => {
		activeStroke = null;
		isDrawing = false;
		activePointerId = null;
	};

	const preventCanvasDrag = (event: DragEvent) => {
		event.preventDefault();
	};

	const getPoint = (event: PointerEvent): DrawingPoint | null => {
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
		const nextDocument = cloneDrawingDocumentV2(drawingDocument);
		const stroke = nextDocument.tail.at(-1);
		if (!stroke) return;

		const lastPoint = stroke.points.at(-1);
		if (lastPoint && point[0] === lastPoint[0] && point[1] === lastPoint[1]) {
			return;
		}

		stroke.points.push(point);
		commitDrawingDocument(nextDocument);
		renderCurrentDocument();
	};

	const appendPointToActiveStroke = (point: DrawingPoint) => {
		if (!activeStroke) return;
		if (!appendBufferedStrokePoint(activeStroke, point)) return;
		renderCurrentDocument();
	};

	const commitActiveStroke = () => {
		if (!activeStroke) return;

		const nextDocument = appendCommittedStroke(drawingDocument, activeStroke);
		activeStroke = null;
		commitDrawingDocument(nextDocument);
		renderCurrentDocument();
	};

	$effect(() => {
		const nextSeed = initialDrawingDocument
			? serializeEditableDrawingDocument(initialDrawingDocument)
			: null;

		if (nextSeed === lastHydratedInitialDocumentSeed) {
			return;
		}

		lastHydratedInitialDocumentSeed = nextSeed;

		const nextBaseline = initialDrawingDocument
			? cloneDrawingDocumentV2(initialDrawingDocument)
			: createEmptyDrawingDocumentV2('artwork');

		baselineDocument = nextBaseline;
		commitDrawingDocument(cloneDrawingDocumentV2(nextBaseline));
	});

	$effect(() => {
		onInitialImageSettled?.();
	});

	onMount(() => {
		renderCurrentDocument();

		const handleWindowPointerUp = (event: PointerEvent) => {
			finishDrawing(event);
		};
		const handleWindowPointerCancel = (event: PointerEvent) => {
			finishDrawing(event);
		};
		const handleWindowBlur = () => {
			finishDrawing();
		};

		window.addEventListener('pointerup', handleWindowPointerUp);
		window.addEventListener('pointercancel', handleWindowPointerCancel);
		window.addEventListener('blur', handleWindowBlur);

		return () => {
			window.removeEventListener('pointerup', handleWindowPointerUp);
			window.removeEventListener('pointercancel', handleWindowPointerCancel);
			window.removeEventListener('blur', handleWindowBlur);
		};
	});

	$effect(() => {
		if (lastAppliedClearVersion === null) {
			lastAppliedClearVersion = clearVersion;
			return;
		}

		if (clearVersion === lastAppliedClearVersion) return;

		lastAppliedClearVersion = clearVersion;
		activeStroke = null;
		commitDrawingDocument(cloneDrawingDocumentV2(baselineDocument));
	});

	$effect(() => {
		renderCurrentDocument();
	});

	function startDrawing(event: PointerEvent) {
		if (!interactive) return;
		if (!canvasRef) return;
		if (!event.isPrimary) return;

		event.preventDefault();

		const point = getPoint(event);
		if (!point) return;

		canvasRef.setPointerCapture(event.pointerId);
		activePointerId = event.pointerId;
		isDrawing = true;

		if (responsiveDrawing) {
			activeStroke = createBufferedStroke({
				color: drawingTools.activeColor,
				point,
				size: drawingTools.brushSize
			});
			renderCurrentDocument();
			return;
		}

		const nextDocument = cloneDrawingDocumentV2(drawingDocument);
		nextDocument.tail.push({
			color: drawingTools.activeColor,
			points: [point],
			size: drawingTools.brushSize
		});
		commitDrawingDocument(nextDocument);
		renderCurrentDocument();
	}

	function draw(event: PointerEvent) {
		if (!interactive) return;
		if (!event.isPrimary) return;
		if (activePointerId !== event.pointerId) return;

		event.preventDefault();

		if (!isDrawing) {
			return;
		}

		if (!canvasRef) return;
		const point = getPoint(event);
		if (!point) return;

		if (responsiveDrawing) {
			appendPointToActiveStroke(point);
			return;
		}

		appendPoint(point);
	}

	function finishDrawing(event?: PointerEvent) {
		if (
			canvasRef &&
			event &&
			activePointerId === event.pointerId &&
			canvasRef.hasPointerCapture(event.pointerId)
		) {
			canvasRef.releasePointerCapture(event.pointerId);
		}

		if (responsiveDrawing) {
			commitActiveStroke();
		}

		stopDrawing();
	}

	function cancelDrawing(event: PointerEvent) {
		event.preventDefault();
		finishDrawing(event);
	}
</script>

<div class="relative flex h-full w-full items-center justify-center">
	<canvas
		bind:this={canvasRef}
		width={768}
		height={768}
		class={`block h-full w-full rounded-lg border ${interactive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-85'}`}
		style="background: #fdfbf7; touch-action: none;"
		aria-disabled={!interactive}
		data-responsive-mode={responsiveDrawing ? 'active' : 'inactive'}
		draggable="false"
		ondragstart={preventCanvasDrag}
		onpointerdown={startDrawing}
		onpointermove={draw}
		onpointerup={finishDrawing}
		onpointercancel={cancelDrawing}
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
