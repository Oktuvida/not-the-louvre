<script lang="ts">
	import { onMount } from 'svelte';
	import {
		clampDrawingPoint,
		cloneDrawingDocumentV2,
		createEmptyDrawingDocumentV2,
		serializeEditableDrawingDocument,
		type DrawingDocumentV2,
		type DrawingPoint,
		type DrawingStroke
	} from '#lib/features/stroke-json/document.js';
	import { appendCommittedStroke } from '#lib/features/stroke-json/responsive-editing.js';
	import {
		attachPointerReleaseSafetyNet,
		getCanvasContentRect,
		getDrawingPointInRect,
		hasLostPrimaryButton
	} from '#lib/features/studio-drawing/pointer-drawing.js';
	import { createInkSurface, type InkSurface } from '#lib/features/studio-drawing/ink-surface.js';
	import { drawingTools } from '#lib/features/studio-drawing/state/drawing.svelte.js';

	let {
		canvasRef = $bindable<HTMLCanvasElement | null>(null),
		drawingDocument = $bindable<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork')),
		clearVersion = 0,
		initialDrawingDocument = null,
		interactive = true,
		onDocumentChange,
		onHistoryChange,
		onStrokeCommitted,
		statusMessage = '',
		statusTone = 'idle'
	}: {
		canvasRef?: HTMLCanvasElement | null;
		drawingDocument?: DrawingDocumentV2;
		clearVersion?: number;
		initialDrawingDocument?: DrawingDocumentV2 | null;
		interactive?: boolean;
		/**
		 * Observation channel only. The studio page reads the document through
		 * `bind:drawingDocument`; this reports each committed document to the
		 * spec and to anything else that only needs to watch.
		 */
		onDocumentChange?: (document: DrawingDocumentV2) => void;
		/** An undo or redo replaced the document (the draft has to follow it). */
		onHistoryChange?: (document: DrawingDocumentV2) => void;
		onStrokeCommitted?: (input: {
			nextDocument: DrawingDocumentV2;
			previousDocument: DrawingDocumentV2;
			stroke: DrawingStroke;
		}) => void | Promise<void>;
		statusMessage?: string;
		statusTone?: 'error' | 'success' | 'idle';
	} = $props();

	let overlayRef = $state<HTMLCanvasElement | null>(null);
	let surface: InkSurface | null = null;
	let baselineDocument = createEmptyDrawingDocumentV2('artwork');
	// Mirrors of what the history functions below report, kept as state so a
	// parent reading them re-renders when they change.
	let baselineStrokeCount = $state(0);
	let redoCount = $state(0);
	let lastAppliedClearVersion: number | null = null;
	let lastHydratedInitialDocumentSeed: string | null | undefined = undefined;
	// The document the dry layer is showing. Anything else arriving through the
	// binding (opening a drawing, clearing) is painted again from scratch.
	let shownDocument: DrawingDocumentV2 | null = null;

	/*
	 * The line under the pen lives outside Svelte: it grows on every sample and
	 * only the canvas needs to see it. The document takes it, once, when the
	 * pen lifts.
	 */
	let wetStroke: DrawingStroke | null = null;
	// Lines taken back, latest last. A new line forgets them.
	let redoStack: DrawingStroke[] = [];
	let activePointerId: number | null = null;
	// Laid out once per stroke: reading the box on every sample forces layout.
	let strokeRect: ReturnType<typeof getCanvasContentRect> | null = null;

	const cloneStroke = (stroke: DrawingStroke): DrawingStroke => ({
		color: stroke.color,
		points: stroke.points.map((point) => [point[0], point[1]] as DrawingPoint),
		size: stroke.size
	});

	const syncHistory = () => {
		baselineStrokeCount = baselineDocument.tail.length;
		redoCount = redoStack.length;
	};

	/** Whether there is a line to take back (never the drawing it opened with). */
	export const canUndo = () => drawingDocument.tail.length > baselineStrokeCount;

	/** Whether there is a taken-back line to put back. */
	export const canRedo = () => redoCount > 0;

	const commitDrawingDocument = (nextDocument: DrawingDocumentV2) => {
		drawingDocument = nextDocument;
		onDocumentChange?.(cloneDrawingDocumentV2(nextDocument));
	};

	/** Commits a document this canvas painted itself, so it is not painted again. */
	const commitShownDocument = (nextDocument: DrawingDocumentV2) => {
		commitDrawingDocument(nextDocument);
		// Read back rather than kept: a bound document comes back as the
		// parent's state proxy, which is never `===` the object assigned.
		shownDocument = drawingDocument;
		syncHistory();
	};

	/*
	 * Undo takes back the latest line this session drew, never the drawing the
	 * canvas was opened with (a fork's parent, a restored draft's start). It
	 * does nothing mid-stroke.
	 */
	export function undo() {
		if (wetStroke || drawingDocument.tail.length <= baselineDocument.tail.length) return false;

		const nextDocument = cloneDrawingDocumentV2(drawingDocument);
		const stroke = nextDocument.tail.pop()!;
		redoStack.push(stroke);
		surface?.rewind(nextDocument);
		commitShownDocument(nextDocument);
		onHistoryChange?.(cloneDrawingDocumentV2(nextDocument));
		return true;
	}

	export function redo() {
		const stroke = wetStroke ? undefined : redoStack.pop();
		if (!stroke) return false;

		const nextDocument = appendCommittedStroke(drawingDocument, stroke);
		surface?.append(nextDocument, stroke);
		commitShownDocument(nextDocument);
		onHistoryChange?.(cloneDrawingDocumentV2(nextDocument));
		return true;
	}

	const toDocumentPoint = (position: { clientX: number; clientY: number }) =>
		strokeRect ? getDrawingPointInRect(strokeRect, position, drawingDocument) : null;

	const toPredictedPoint = (position: { clientX: number; clientY: number }) => {
		if (!strokeRect) return null;
		const point = getDrawingPointInRect(strokeRect, position, {
			height: Number.POSITIVE_INFINITY,
			width: Number.POSITIVE_INFINITY
		});
		return point ? clampDrawingPoint(point, drawingDocument) : null;
	};

	// The eraser lays down paper: the published image is painted the same way.
	const strokeColor = () =>
		drawingTools.tool === 'eraser' ? drawingDocument.background : drawingTools.activeColor;

	const showCursor = (event: PointerEvent) => {
		if (!canvasRef || !interactive) return;
		const point = getDrawingPointInRect(
			strokeRect ?? getCanvasContentRect(canvasRef),
			event,
			drawingDocument
		);
		surface?.cursor(point, strokeColor(), drawingTools.brushSize, drawingTools.tool === 'eraser');
	};

	const hideCursor = () => surface?.cursor(null, '', 0, false);

	function startDrawing(event: PointerEvent) {
		if (!interactive || !canvasRef || !event.isPrimary || activePointerId !== null) return;

		strokeRect = getCanvasContentRect(canvasRef);
		const point = toDocumentPoint(event);
		if (!point) {
			strokeRect = null;
			return;
		}

		event.preventDefault();
		canvasRef.setPointerCapture(event.pointerId);
		activePointerId = event.pointerId;
		wetStroke = { color: strokeColor(), points: [point], size: drawingTools.brushSize };
		surface?.wet(wetStroke);
	}

	function draw(event: PointerEvent) {
		if (!interactive || activePointerId !== event.pointerId || !wetStroke) return;

		event.preventDefault();

		// A mouse released outside the window delivers no pointerup here, so keep
		// what was drawn instead of trailing ink from an unpressed button.
		if (hasLostPrimaryButton(event)) {
			finishDrawing(event);
			return;
		}

		// The browser hands over one move a frame; the samples in between are in
		// the coalesced list, and without them fast curves turn into polygons.
		const coalesced = event.getCoalescedEvents?.() ?? [];
		for (const sample of coalesced.length > 0 ? coalesced : [event]) {
			const point = toDocumentPoint(sample);
			const lastPoint = wetStroke.points.at(-1);
			if (!point || (lastPoint && point[0] === lastPoint[0] && point[1] === lastPoint[1])) {
				continue;
			}
			wetStroke.points.push(point);
		}

		const predicted = (event.getPredictedEvents?.() ?? [])
			.map(toPredictedPoint)
			.filter((point): point is DrawingPoint => point !== null);
		surface?.wet(wetStroke, predicted);
	}

	function finishDrawing(event?: PointerEvent) {
		if (event && activePointerId !== null && event.pointerId !== activePointerId) return;

		if (canvasRef && activePointerId !== null && canvasRef.hasPointerCapture(activePointerId)) {
			canvasRef.releasePointerCapture(activePointerId);
		}

		const stroke = wetStroke;
		wetStroke = null;
		activePointerId = null;
		strokeRect = null;
		surface?.wet(null);
		if (!stroke) return;

		const previousDocument = drawingDocument;
		const nextDocument = appendCommittedStroke(previousDocument, stroke);
		redoStack = [];
		surface?.append(nextDocument, stroke);
		commitShownDocument(nextDocument);
		void onStrokeCommitted?.({
			nextDocument: cloneDrawingDocumentV2(nextDocument),
			previousDocument: cloneDrawingDocumentV2(previousDocument),
			stroke: cloneStroke(stroke)
		});
	}

	function cancelDrawing(event: PointerEvent) {
		event.preventDefault();
		finishDrawing(event);
	}

	$effect(() => {
		const nextSeed = initialDrawingDocument
			? serializeEditableDrawingDocument(initialDrawingDocument)
			: null;

		if (nextSeed === lastHydratedInitialDocumentSeed) return;
		lastHydratedInitialDocumentSeed = nextSeed;

		baselineDocument = initialDrawingDocument
			? cloneDrawingDocumentV2(initialDrawingDocument)
			: createEmptyDrawingDocumentV2('artwork');
		commitDrawingDocument(cloneDrawingDocumentV2(baselineDocument));
	});

	$effect(() => {
		if (lastAppliedClearVersion === null) {
			lastAppliedClearVersion = clearVersion;
			return;
		}

		if (clearVersion === lastAppliedClearVersion) return;

		lastAppliedClearVersion = clearVersion;
		wetStroke = null;
		surface?.wet(null);
		commitDrawingDocument(cloneDrawingDocumentV2(baselineDocument));
	});

	// A document this canvas did not draw itself (opened, cleared, reset after
	// publishing) is painted again whole.
	$effect(() => {
		const next = drawingDocument;
		if (!surface || next === shownDocument) return;

		shownDocument = next;
		redoStack = [];
		surface.showDocument(next);
		syncHistory();
	});

	onMount(() => {
		if (!canvasRef || !overlayRef) return;

		const canvas = canvasRef;
		const inkSurface = createInkSurface(canvas, overlayRef);
		/*
		 * As many pixels as the canvas covers on screen, and never fewer than its
		 * layout. The sketchbook scales the page with transforms (down while it
		 * opens, up once it is open), which move no layout and fire no resize, so
		 * the size is checked again whenever a transition or an animation ends
		 * and whenever a pointer comes onto the canvas. Unchanged, it costs one
		 * box read.
		 */
		const fitToBox = () => {
			const visible = getCanvasContentRect(canvas);
			inkSurface.resize(
				Math.max(canvas.clientWidth, visible.width),
				Math.max(canvas.clientHeight, visible.height),
				window.devicePixelRatio || 1
			);
		};

		fitToBox();
		shownDocument = drawingDocument;
		inkSurface.showDocument(drawingDocument);
		surface = inkSurface;

		const resizeObserver = new ResizeObserver(fitToBox);
		resizeObserver.observe(canvas);
		// A window dragged to a screen of another density keeps its CSS size.
		window.addEventListener('resize', fitToBox);
		document.addEventListener('transitionend', fitToBox);
		document.addEventListener('animationend', fitToBox);
		canvas.addEventListener('pointerenter', fitToBox);
		const detachPointerReleaseSafetyNet = attachPointerReleaseSafetyNet(finishDrawing);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', fitToBox);
			document.removeEventListener('transitionend', fitToBox);
			document.removeEventListener('animationend', fitToBox);
			canvas.removeEventListener('pointerenter', fitToBox);
			detachPointerReleaseSafetyNet();
			inkSurface.destroy();
			surface = null;
		};
	});
</script>

<!-- Sized inline as well as by class: a canvas sized from its own pixel count
     would grow with every resize to the screen's density. -->
<div class="relative h-full w-full items-center justify-center" style="width: 100%; height: 100%;">
	<canvas
		bind:this={canvasRef}
		class={`block h-full w-full rounded-lg border ${interactive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-85'}`}
		style="width: 100%; height: 100%; background: var(--color-paper-bright); touch-action: none;"
		aria-label="Drawing canvas"
		aria-disabled={!interactive}
		draggable="false"
		ondragstart={(event) => event.preventDefault()}
		onpointerdown={startDrawing}
		onpointermove={(event) => {
			// Ink first: the brush cursor is cosmetic and must never hold up drawing.
			draw(event);
			showCursor(event);
		}}
		onpointerup={(event) => {
			finishDrawing(event);
			hideCursor();
		}}
		onpointercancel={cancelDrawing}
		onpointerleave={hideCursor}
	></canvas>

	<canvas
		bind:this={overlayRef}
		class="pointer-events-none block h-full w-full rounded-lg"
		style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
	></canvas>

	{#if statusMessage}
		<div
			class={`absolute -bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 text-sm italic ${statusTone === 'error' ? 'text-rust' : 'text-ink-faint'}`}
			style="font-family: var(--font-body);"
		>
			<div
				class={`h-2 w-2 rounded-full ${statusTone === 'error' ? 'bg-danger-bright' : 'bg-sage'}`}
			></div>
			{statusMessage}
		</div>
	{/if}
</div>
