<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { on } from 'svelte/events';
	import {
		DEFAULT_DRAWING_DOCUMENT_LIMITS,
		appendCommittedStroke,
		clampDrawingPoint,
		cloneDrawingDocumentV2,
		cloneDrawingStroke,
		createEmptyDrawingDocumentV2,
		serializeEditableDrawingDocument,
		type DrawingDocumentV2,
		type DrawingPoint,
		type DrawingStroke
	} from '#lib/features/stroke-json/document.js';
	import type { PointerKind } from '#lib/stroke/v3.js';
	import { measureInk, type InkLimits } from '#lib/features/stroke-json/ink.js';
	import {
		attachPointerReleaseSafetyNet,
		getCanvasContentRect,
		getDrawingPointInRect,
		hasLostPrimaryButton
	} from '#lib/features/studio-drawing/pointer-drawing.js';
	import {
		createInkSurface,
		type InkSurface,
		type InkSurfaceOptions
	} from '#lib/features/studio-drawing/ink-surface.js';
	import { drawingTools } from '#lib/features/studio-drawing/state/drawing.svelte.js';
	import {
		SECOND_FINGER_WINDOW_MS,
		createTouchGestureTracker
	} from '#lib/features/studio-drawing/touch-gestures.js';
	import {
		FIT_VIEW,
		clampView,
		pinchView,
		settleView,
		startPinch,
		zoomAround,
		type CanvasView,
		type PinchStart
	} from '#lib/features/studio-drawing/canvas-view.js';

	let {
		backdrop = null,
		canvasRef = $bindable<HTMLCanvasElement | null>(null),
		drawingDocument = $bindable<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork')),
		clearVersion = 0,
		decorate,
		initialDrawingDocument = null,
		inkLimits = {},
		interactive = true,
		label = 'Drawing canvas',
		onDocumentChange,
		onHistoryChange,
		onOutOfInk,
		onStrokeCommitted,
		paper,
		sheet = false,
		statusMessage = '',
		statusTone = 'idle',
		strokeColor,
		strokeSize
	}: {
		/** The image a fork is drawn over: its parent's, by URL. */
		backdrop?: string | null;
		canvasRef?: HTMLCanvasElement | null;
		drawingDocument?: DrawingDocumentV2;
		clearVersion?: number;
		decorate?: InkSurfaceOptions['decorate'];
		initialDrawingDocument?: DrawingDocumentV2 | null;
		/** The server's limits; the defaults unless a spec wants a small budget. */
		inkLimits?: InkLimits;
		interactive?: boolean;
		/** The canvas's accessible name. */
		label?: string;
		/**
		 * Observation channel only. The studio page reads the document through
		 * `bind:drawingDocument`; this reports each committed document to the
		 * spec and to anything else that only needs to watch.
		 */
		onDocumentChange?: (document: DrawingDocumentV2) => void;
		/** An undo or redo replaced the document (the draft has to follow it). */
		onHistoryChange?: (document: DrawingDocumentV2) => void;
		/** A line was refused or cut short because the drawing ran out of ink. */
		onOutOfInk?: () => void;
		onStrokeCommitted?: (input: {
			nextDocument: DrawingDocumentV2;
			previousDocument: DrawingDocumentV2;
			stroke: DrawingStroke;
		}) => void | Promise<void>;
		/** The paper on screen, when it is not the document's background (the avatar pad). */
		paper?: string;
		/**
		 * Lay the canvas on a sheet of watercolour paper taped down at its
		 * corners, its deckled edge just past the drawing (the studio's page).
		 */
		sheet?: boolean;
		statusMessage?: string;
		statusTone?: 'error' | 'success' | 'idle';
		/** A brush of the host's own; the studio's shared tools otherwise. */
		strokeColor?: string;
		strokeSize?: number;
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
	let wetStroke: WetStroke | null = null;
	// When the previous stroke began, for the next one's `start` (the gap a
	// timelapse replays); none yet in this session means it starts at once.
	let lastStrokeStartedAt: number | null = null;
	// Lines taken back, latest last. A new line forgets them.
	let redoStack: DrawingStroke[] = [];
	let activePointerId: number | null = null;
	let strokePointerType = '';
	let strokeStartedAt = 0;
	// What the line under the pen may still spend: points across the drawing,
	// and new lines for carrying one past the most a single line may hold.
	let pointsLeft = 0;
	let strokesLeft = 0;

	/*
	 * Pen mode, as tldraw and Excalidraw do it: the first time a pen touches the
	 * canvas, fingers stop drawing and only make gestures, so the palm resting
	 * on the glass leaves nothing behind. The visitor can switch it off, and a
	 * pen does not switch it back on behind their back.
	 */
	let penSeen = $state(false);
	let penOnly = $state(false);
	let penOnlyDismissed = false;
	const fingers = createTouchGestureTracker();

	let frameRef = $state<HTMLDivElement | null>(null);
	let view = $state<CanvasView>(FIT_VIEW);
	let pinch: PinchStart | null = null;
	// Repaints at the zoomed size once the zoom stops (set in onMount).
	let refitSoon = () => {};

	const frameBox = () => {
		const rect = frameRef?.getBoundingClientRect();
		return rect
			? { height: rect.height, left: rect.left, top: rect.top, width: rect.width }
			: { height: 1, left: 0, top: 0, width: 1 };
	};

	/** Finger positions in frame coordinates. */
	const fingersInFrame = () => {
		const box = frameBox();
		return fingers.positions().map(({ x, y }) => ({ x: x - box.left, y: y - box.top }));
	};

	const fitCanvas = () => {
		view = FIT_VIEW;
		refitSoon();
	};
	// Laid out once per stroke: reading the box on every sample forces layout.
	let strokeRect: ReturnType<typeof getCanvasContentRect> | null = null;

	/** The line under the pen, with the time and pressure of every point. */
	type WetStroke = DrawingStroke & { pressures: number[]; times: number[] };

	// Pressure is kept in the ten bits the v3 document stores.
	const toTenBits = (pressure: number) =>
		Math.round(Math.min(1, Math.max(0, pressure)) * 1023) / 1023;
	const PLACEHOLDER_PRESSURES = [0, toTenBits(0.5), 1];

	const pointerKind = (type: string): PointerKind =>
		type === 'pen' || type === 'touch' ? type : 'mouse';

	/*
	 * Real pressure only from a pen that varies it: iOS reports 0 for fingers,
	 * mice report 0.5 while a button is down, and a pen that never changes its
	 * reading is reporting nothing either (tldraw's rule).
	 */
	const finishedStroke = ({ pressures, ...stroke }: WetStroke): DrawingStroke => {
		const first = pressures[0] ?? 0;
		const isPlaceholder =
			pressures.every((pressure) => pressure === first) && PLACEHOLDER_PRESSURES.includes(first);
		if (stroke.pointer === 'pen' && !isPlaceholder) return { ...stroke, pressures };
		return stroke.brush === 'ink@1' ? { ...stroke, brush: 'round@1' } : stroke;
	};

	const startStroke = (point: DrawingPoint, at: number, pointer: PointerKind, pressure: number) => {
		const stroke: WetStroke = {
			// A pen draws with the pressure brush from its first point; if its
			// pressure turns out to be a placeholder the line is kept as a round one.
			brush:
				!strokeColor && drawingTools.tool === 'eraser'
					? 'eraser@1'
					: pointer === 'pen'
						? 'ink@1'
						: 'round@1',
			color: inkColor(),
			pointer,
			points: [point],
			pressures: [pressure],
			size: inkSize(),
			start: lastStrokeStartedAt === null ? 0 : Math.max(0, Math.round(at - lastStrokeStartedAt)),
			times: [0]
		};
		lastStrokeStartedAt = at;
		strokeStartedAt = at;
		return stroke;
	};

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
	const inkColor = () =>
		strokeColor ??
		(drawingTools.tool === 'eraser' ? drawingDocument.background : drawingTools.activeColor);
	const inkSize = () => strokeSize ?? drawingTools.brushSize;

	const showCursor = (event: PointerEvent) => {
		if (!canvasRef || !interactive) return;
		const point = getDrawingPointInRect(
			strokeRect ?? getCanvasContentRect(canvasRef),
			event,
			drawingDocument
		);
		surface?.cursor(point, inkColor(), inkSize(), !strokeColor && drawingTools.tool === 'eraser');
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

		const ink = measureInk(drawingDocument, inkLimits);
		if (ink.remainingStrokes === 0 || ink.remainingPoints === 0) {
			strokeRect = null;
			onOutOfInk?.();
			return;
		}
		pointsLeft = ink.remainingPoints - 1;
		strokesLeft = ink.remainingStrokes - 1;

		event.preventDefault();
		canvasRef.setPointerCapture(event.pointerId);
		activePointerId = event.pointerId;
		strokePointerType = event.pointerType;
		wetStroke = startStroke(
			point,
			event.timeStamp,
			pointerKind(event.pointerType),
			toTenBits(event.pressure)
		);
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

			// Past the most one line may hold, the line goes on as a new one from
			// the same spot, so the visitor never sees the seam.
			if (wetStroke.points.length >= maxPointsPerStroke() && strokesLeft > 0 && pointsLeft > 1) {
				const carried: DrawingPoint = wetStroke.points.at(-1)!;
				const carriedAt = strokeStartedAt + wetStroke.times.at(-1)!;
				const carriedPressure = wetStroke.pressures.at(-1)!;
				const pointer = wetStroke.pointer ?? 'mouse';
				keepStroke(finishedStroke(wetStroke));
				wetStroke = startStroke(carried, carriedAt, pointer, carriedPressure);
				strokesLeft -= 1;
				pointsLeft -= 1;
			}

			if (pointsLeft === 0 || wetStroke.points.length >= maxPointsPerStroke()) {
				// Out of ink: keep what was drawn, take nothing more from this press.
				finishDrawing();
				onOutOfInk?.();
				return;
			}

			wetStroke.points.push(point);
			// Coalesced samples carry their own time; never let it run backwards.
			wetStroke.times.push(
				Math.max(wetStroke.times.at(-1)!, Math.round(sample.timeStamp - strokeStartedAt))
			);
			wetStroke.pressures.push(toTenBits(sample.pressure));
			pointsLeft -= 1;
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
		if (stroke) keepStroke(finishedStroke(stroke));
	}

	const maxPointsPerStroke = () =>
		inkLimits.maxPointsPerStroke ?? DEFAULT_DRAWING_DOCUMENT_LIMITS.maxPointsPerStroke;

	/** Adds a finished line to the document, the dry layer and the draft. */
	function keepStroke(stroke: DrawingStroke) {
		const previousDocument = drawingDocument;
		const nextDocument = appendCommittedStroke(previousDocument, stroke);
		redoStack = [];
		surface?.append(nextDocument, stroke);
		commitShownDocument(nextDocument);
		void onStrokeCommitted?.({
			nextDocument: cloneDrawingDocumentV2(nextDocument),
			previousDocument: cloneDrawingDocumentV2(previousDocument),
			stroke: cloneDrawingStroke(stroke)
		});
	}

	function cancelDrawing(event: PointerEvent) {
		event.preventDefault();
		if (event.pointerType === 'touch') fingers.cancel(event.pointerId);
		finishDrawing(event);
	}

	/** Drops the line under the pen without keeping any of it. */
	function discardStroke() {
		if (canvasRef && activePointerId !== null && canvasRef.hasPointerCapture(activePointerId)) {
			canvasRef.releasePointerCapture(activePointerId);
		}
		wetStroke = null;
		activePointerId = null;
		strokeRect = null;
		surface?.wet(null);
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.pointerType === 'pen' && !penSeen) {
			penSeen = true;
			penOnly = !penOnlyDismissed;
		}

		if (event.pointerType === 'touch') {
			const count = fingers.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
			if (count > 1) {
				// Two fingers landing together are a gesture, not a line and a stray.
				if (
					wetStroke &&
					strokePointerType === 'touch' &&
					event.timeStamp - strokeStartedAt <= SECOND_FINGER_WINDOW_MS
				) {
					discardStroke();
				}
				// Two fingers and no line under way: pinch to zoom, drag to pan.
				if (count === 2 && !wetStroke) pinch = startPinch(fingersInFrame(), view);
				return;
			}
			if (penOnly) return;
		}

		startDrawing(event);
	}

	function handlePointerUp(event: PointerEvent) {
		finishDrawing(event);
		hideCursor();
		if (event.pointerType !== 'touch') return;

		const gesture = fingers.up(event.pointerId, event.timeStamp);
		if (pinch && fingers.positions().length < 2) {
			pinch = null;
			view = settleView(view);
			refitSoon();
		}
		if (gesture === 'undo') undo();
		if (gesture === 'redo') redo();
	}

	/*
	 * A trackpad pinch arrives as a wheel with Ctrl held (also on macOS); it
	 * zooms around the pointer. Scrolling pans a zoomed-in canvas and is left to
	 * the page otherwise.
	 */
	function handleWheel(event: WheelEvent) {
		const box = frameBox();
		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			const anchor = { x: event.clientX - box.left, y: event.clientY - box.top };
			view = settleView(zoomAround(view, anchor, view.scale * Math.exp(-event.deltaY * 0.01), box));
			refitSoon();
			return;
		}
		if (view.scale === 1) return;

		event.preventDefault();
		view = clampView({ ...view, x: view.x - event.deltaX, y: view.y - event.deltaY }, box);
	}

	const togglePenOnly = () => {
		penOnly = !penOnly;
		penOnlyDismissed = !penOnly;
	};

	$effect(() => {
		const nextSeed = initialDrawingDocument
			? serializeEditableDrawingDocument(initialDrawingDocument)
			: null;

		if (nextSeed === lastHydratedInitialDocumentSeed) return;
		lastHydratedInitialDocumentSeed = nextSeed;

		baselineDocument = initialDrawingDocument
			? cloneDrawingDocumentV2(initialDrawingDocument)
			: createEmptyDrawingDocumentV2(untrack(() => drawingDocument.kind));
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

	// The parent's image under a fork's strokes, painted once it has loaded.
	let backdropImage = $state<HTMLImageElement | null>(null);
	let mounted = $state(false);
	$effect(() => {
		const source = backdrop;
		if (!source) {
			backdropImage = null;
			return;
		}

		let current = true;
		const image = new Image();
		image.decoding = 'async';
		image.src = source;
		void image.decode().then(
			() => {
				if (current) backdropImage = image;
			},
			() => {}
		);
		return () => {
			current = false;
		};
	});
	$effect(() => {
		const image = backdropImage;
		if (mounted) surface?.setBackdrop(image);
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
		const inkSurface = createInkSurface(canvas, overlayRef, { decorate, paper });
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
		let refitTimer: ReturnType<typeof setTimeout> | undefined;
		refitSoon = () => {
			clearTimeout(refitTimer);
			refitTimer = setTimeout(fitToBox, 120);
		};
		shownDocument = drawingDocument;
		inkSurface.showDocument(drawingDocument);
		surface = inkSurface;
		mounted = true;

		const resizeObserver = new ResizeObserver(fitToBox);
		resizeObserver.observe(canvas);
		// A window dragged to a screen of another density keeps its CSS size.
		window.addEventListener('resize', fitToBox);
		document.addEventListener('transitionend', fitToBox);
		document.addEventListener('animationend', fitToBox);
		canvas.addEventListener('pointerenter', fitToBox);
		const detachPointerReleaseSafetyNet = attachPointerReleaseSafetyNet(finishDrawing);
		// iPad keeps its magnifier, long-press menu and Scribble running through a
		// cancelled pointer; only a non-passive touchstart that is prevented stops
		// them, and Svelte registers `ontouchstart` as passive.
		const detachTouchStart = on(canvas, 'touchstart', (event) => event.preventDefault(), {
			passive: false
		});
		const detachGestureStart = on(canvas, 'gesturestart', (event) => event.preventDefault());

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', fitToBox);
			document.removeEventListener('transitionend', fitToBox);
			document.removeEventListener('animationend', fitToBox);
			canvas.removeEventListener('pointerenter', fitToBox);
			detachPointerReleaseSafetyNet();
			detachTouchStart();
			detachGestureStart();
			clearTimeout(refitTimer);
			inkSurface.destroy();
			surface = null;
			mounted = false;
		};
	});
</script>

<!-- Sized inline as well as by class: a canvas sized from its own pixel count
     would grow with every resize to the screen's density. The ratio is the
     fallback for a parent whose height comes from an aspect-ratio of its own,
     which Safari cannot resolve a percentage height against. -->
<div
	class="relative h-full w-full items-center justify-center"
	style:isolation="isolate"
	style:position="relative"
	style:width="100%"
	style:height="100%"
	style:aspect-ratio={`${drawingDocument.width} / ${drawingDocument.height}`}
>
	{#if sheet}
		<!-- The sheet the drawing is on: its deckled edge a little past the
		     drawing, and tape over its corners. Decoration only. -->
		<span class="canvas-sheet canvas-sheet-shadow deckled-sheet-shadow" aria-hidden="true"></span>
		<span
			class="canvas-sheet deckled-sheet"
			style:--sheet-paper={paper ?? 'var(--color-paper-bright)'}
			aria-hidden="true"
		></span>
		{#each ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as corner (corner)}
			<span class={`canvas-sheet-tape canvas-sheet-tape-${corner} tape`} aria-hidden="true"></span>
		{/each}
	{/if}

	<!-- The frame stays put and clips; the view inside it zooms and pans. -->
	<div
		bind:this={frameRef}
		data-canvas-frame
		class="canvas-frame"
		class:canvas-frame-sheet={sheet}
		onwheel={handleWheel}
	>
		<div
			class="canvas-view"
			style:transform={`translate(${view.x}px, ${view.y}px) scale(${view.scale})`}
		>
			<canvas
				bind:this={canvasRef}
				class={`block h-full w-full ${sheet ? '' : 'rounded-lg border'} ${interactive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-85'}`}
				style="width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;"
				style:background={paper ?? 'var(--color-paper-bright)'}
				aria-label={label}
				aria-disabled={!interactive}
				draggable="false"
				ondragstart={(event) => event.preventDefault()}
				onpointerdown={handlePointerDown}
				onpointermove={(event) => {
					if (event.pointerType === 'touch') {
						fingers.move(event.pointerId, event.clientX, event.clientY);
						const positions = fingersInFrame();
						if (pinch && positions.length >= 2) view = pinchView(pinch, positions, frameBox());
					}
					// Ink first: the brush cursor is cosmetic and must never hold up drawing.
					draw(event);
					showCursor(event);
				}}
				onpointerup={handlePointerUp}
				onpointercancel={cancelDrawing}
				onpointerleave={hideCursor}
			></canvas>

			<canvas
				bind:this={overlayRef}
				class={`pointer-events-none block h-full w-full ${sheet ? '' : 'rounded-lg'}`}
				style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
			></canvas>
		</div>
	</div>

	{#if view.scale !== 1}
		<button type="button" class="canvas-chip canvas-fit focus-ring" onclick={fitCanvas}>
			Fit canvas
		</button>
	{/if}

	{#if penSeen}
		<button
			type="button"
			class="canvas-chip pen-only-toggle focus-ring"
			class:canvas-chip-on={penOnly}
			aria-pressed={penOnly}
			onclick={togglePenOnly}
		>
			Pen only
		</button>
	{/if}

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

<style>
	.canvas-frame {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: 0.5rem;
	}

	/* On a sheet the drawing's corners are the paper's: square. */
	.canvas-frame-sheet {
		border-radius: 0;
	}

	.canvas-sheet {
		position: absolute;
		inset: -0.6rem;
		z-index: -1;
		pointer-events: none;
	}

	.canvas-sheet-shadow {
		inset: -0.45rem;
	}

	/* Masking tape across each corner, mostly on the sheet's margin. */
	.canvas-sheet-tape {
		position: absolute;
		z-index: 3;
		width: 4.2rem;
		height: 1.25rem;
		pointer-events: none;
	}

	.canvas-sheet-tape-top-left {
		top: -0.85rem;
		left: -1.65rem;
		rotate: -40deg;
	}

	.canvas-sheet-tape-top-right {
		top: -0.85rem;
		right: -1.65rem;
		rotate: 40deg;
	}

	.canvas-sheet-tape-bottom-left {
		bottom: -0.85rem;
		left: -1.65rem;
		rotate: 40deg;
	}

	.canvas-sheet-tape-bottom-right {
		bottom: -0.85rem;
		right: -1.65rem;
		rotate: -40deg;
	}

	.canvas-view {
		position: relative;
		width: 100%;
		height: 100%;
		transform-origin: 0 0;
	}

	.canvas-fit {
		right: 8px;
	}

	.pen-only-toggle {
		left: 8px;
	}

	.canvas-chip {
		position: absolute;
		top: 8px;
		min-height: 36px;
		padding: 0 12px;
		border: 2px solid rgba(45, 36, 32, 0.35);
		border-radius: 999px;
		background: rgba(253, 251, 247, 0.92);
		color: #2d2420;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}

	.canvas-chip-on {
		border-color: #2d2420;
		background: #2d2420;
		color: #fdfbf7;
	}
</style>
