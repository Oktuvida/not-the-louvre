<script lang="ts">
	import { onMount } from 'svelte';
	import {
		buildDrawingDraftKey,
		clearDrawingDraft,
		loadDrawingDraft,
		saveDrawingDraft
	} from '$lib/features/stroke-json/drafts';
	import {
		AVATAR_DRAWING_DIMENSIONS,
		DRAWING_DOCUMENT_VERSION,
		cloneDrawingDocumentV2,
		createEmptyDrawingDocument,
		createEmptyDrawingDocumentV2,
		getDrawingPointWithinBounds,
		getRenderableDrawingStrokes,
		type DrawingDocumentV2,
		type DrawingPoint,
		type DrawingStroke
	} from '$lib/features/stroke-json/document';
	import { prepareDrawingDocumentForPublish } from '$lib/features/stroke-json/runtime.browser';
	import { renderDrawingStroke } from '$lib/features/stroke-json/canvas';
	import {
		appendBufferedStrokePoint,
		appendCommittedStroke,
		createBufferedStroke,
		shouldUseResponsiveDrawing
	} from '$lib/features/stroke-json/responsive-editing';
	import { drawingPalette } from '$lib/features/studio-drawing/state/drawing.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';

	const palette = drawingPalette;
	const BRUSH_SIZES = [1, 2, 4, 6, 8, 10, 12, 14, 18, 24, 32, 42];
	const BRUSH_PREVIEW_SIZE = Math.max(...BRUSH_SIZES) + 6;
	const DEFAULT_AVATAR_COLOR = drawingPalette[4] ?? drawingPalette[0] ?? '#1a1a1a';
	const AVATAR_CANVAS_BACKGROUND = '#ffffff';

	const CANVAS_WIDTH = AVATAR_DRAWING_DIMENSIONS.width;
	const CANVAS_HEIGHT = AVATAR_DRAWING_DIMENSIONS.height;

	type AvatarSaveResult =
		| { success: true }
		| {
				code?: string;
				message: string;
				success: false;
		  };

	let {
		clearMode = 'initial',
		createAvatarPayload = async (documentState: DrawingDocumentV2) => {
			const mode =
				typeof window === 'undefined'
					? 'good'
					: ((
							window as Window & {
								__avatarExportMode?: 'bad' | 'good' | 'unsupported';
							}
						).__avatarExportMode ?? 'good');

			if (mode === 'unsupported') {
				return null;
			}

			if (mode === 'bad') {
				return JSON.stringify(createEmptyDrawingDocument('artwork'));
			}

			return prepareDrawingDocumentForPublish(documentState);
		},
		draftUserKey = null,
		initialDrawingDocument = null,
		nickname,
		onContinue,
		saveAvatar = async () => ({
			message: 'Avatar save is unavailable right now.',
			success: false as const
		}),
		submitLabel = 'Enter the gallery'
	}: {
		clearMode?: 'blank' | 'initial';
		createAvatarPayload?: (documentState: DrawingDocumentV2) => Promise<string | null>;
		draftUserKey?: string | null;
		initialDrawingDocument?: DrawingDocumentV2 | null;
		nickname: string;
		onContinue?: () => void;
		saveAvatar?: (drawingDocument: string) => Promise<AvatarSaveResult>;
		submitLabel?: string;
	} = $props();

	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let activeColor = $state(DEFAULT_AVATAR_COLOR);
	let baselineDocument = $state<DrawingDocumentV2>(createEmptyDrawingDocumentV2('avatar'));
	let brushStep = $state(Math.floor((BRUSH_SIZES.length - 1) / 2));
	let drawingDocument = $state<DrawingDocumentV2>(createEmptyDrawingDocumentV2('avatar'));
	let activeStroke = $state<DrawingStroke | null>(null);
	let activePointerId = $state<number | null>(null);
	let isDrawing = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');
	let responsiveDrawing = $derived(shouldUseResponsiveDrawing(drawingDocument));
	let committedCacheCanvas: HTMLCanvasElement | null = null;
	let committedCacheDirty = true;

	const brushSize = $derived(BRUSH_SIZES[brushStep] ?? BRUSH_SIZES[BRUSH_SIZES.length - 1]);
	const brushPreviewDiameter = $derived(Math.max(4, brushSize + 2));
	const clearDocument = $derived(
		clearMode === 'blank' ? createEmptyDrawingDocumentV2('avatar') : baselineDocument
	);
	const draftKey = $derived(
		draftUserKey
			? buildDrawingDraftKey({
					schemaVersion: drawingDocument.version,
					scope: 'profile',
					surface: 'avatar',
					userKey: draftUserKey
				})
			: null
	);
	const legacyDraftKey = $derived(
		draftUserKey
			? buildDrawingDraftKey({
					schemaVersion: DRAWING_DOCUMENT_VERSION,
					scope: 'profile',
					surface: 'avatar',
					userKey: draftUserKey
				})
			: null
	);

	const drawGhostSilhouette = (ctx: CanvasRenderingContext2D) => {
		ctx.save();
		ctx.globalAlpha = 0.17;
		ctx.strokeStyle = '#2d2a26';
		ctx.lineWidth = 3;
		ctx.setLineDash([8, 6]);

		const centerX = CANVAS_WIDTH / 2;
		const centerY = CANVAS_HEIGHT / 2 - 8;

		ctx.beginPath();
		ctx.arc(centerX, centerY - 44, 74, 0, Math.PI * 2);
		ctx.stroke();

		const shoulderWidth = 226;
		const shoulderHeight = 112;
		const shoulderX = centerX - shoulderWidth / 2;
		const shoulderY = centerY + 52;
		const cornerRadius = 42;

		ctx.beginPath();
		ctx.moveTo(shoulderX + cornerRadius, shoulderY);
		ctx.lineTo(shoulderX + shoulderWidth - cornerRadius, shoulderY);
		ctx.arcTo(
			shoulderX + shoulderWidth,
			shoulderY,
			shoulderX + shoulderWidth,
			shoulderY + cornerRadius,
			cornerRadius
		);
		ctx.lineTo(shoulderX + shoulderWidth, shoulderY + shoulderHeight - 20);
		ctx.arcTo(
			shoulderX + shoulderWidth,
			shoulderY + shoulderHeight,
			shoulderX + shoulderWidth - 24,
			shoulderY + shoulderHeight,
			24
		);
		ctx.lineTo(shoulderX + 24, shoulderY + shoulderHeight);
		ctx.arcTo(
			shoulderX,
			shoulderY + shoulderHeight,
			shoulderX,
			shoulderY + shoulderHeight - 24,
			24
		);
		ctx.lineTo(shoulderX, shoulderY + cornerRadius);
		ctx.arcTo(shoulderX, shoulderY, shoulderX + cornerRadius, shoulderY, cornerRadius);
		ctx.stroke();

		ctx.setLineDash([]);
		ctx.restore();
	};

	const renderCommittedDocument = (
		context: CanvasRenderingContext2D,
		documentState: DrawingDocumentV2
	) => {
		context.fillStyle = AVATAR_CANVAS_BACKGROUND;
		context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		drawGhostSilhouette(context);

		for (const stroke of getRenderableDrawingStrokes(documentState)) {
			renderDrawingStroke(context, stroke);
		}
	};

	const renderCommittedCache = () => {
		committedCacheCanvas ??= window.document.createElement('canvas');
		if (
			committedCacheCanvas.width !== CANVAS_WIDTH ||
			committedCacheCanvas.height !== CANVAS_HEIGHT
		) {
			committedCacheCanvas.width = CANVAS_WIDTH;
			committedCacheCanvas.height = CANVAS_HEIGHT;
		}

		const context = committedCacheCanvas.getContext('2d');
		if (!context) return;

		renderCommittedDocument(context, drawingDocument);
		committedCacheDirty = false;
	};

	const renderCurrentDocument = () => {
		if (!canvasElement) return;
		const context = canvasElement.getContext('2d');
		if (!context) return;

		if (!responsiveDrawing) {
			renderCommittedDocument(context, drawingDocument);
			return;
		}

		if (committedCacheDirty || !committedCacheCanvas) {
			renderCommittedCache();
		}

		context.fillStyle = AVATAR_CANVAS_BACKGROUND;
		context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		if (committedCacheCanvas) {
			context.drawImage(committedCacheCanvas, 0, 0);
		}
		if (activeStroke) {
			renderDrawingStroke(context, activeStroke);
		}
	};

	const getPoint = (event: PointerEvent): DrawingPoint | null => {
		if (!canvasElement) return null;

		const rect = canvasElement.getBoundingClientRect();
		const scaleX = canvasElement.width / rect.width;
		const scaleY = canvasElement.height / rect.height;

		return getDrawingPointWithinBounds(
			[(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY],
			drawingDocument
		);
	};

	const startStroke = (point: DrawingPoint) => {
		if (responsiveDrawing) {
			activeStroke = createBufferedStroke({
				color: activeColor,
				point,
				size: brushSize
			});
			renderCurrentDocument();
			return;
		}

		drawingDocument.tail.push({
			color: activeColor,
			points: [point],
			size: brushSize
		});
		committedCacheDirty = true;
		renderCurrentDocument();
	};

	const appendPoint = (point: DrawingPoint) => {
		if (responsiveDrawing) {
			if (!activeStroke) return;
			if (!appendBufferedStrokePoint(activeStroke, point)) return;
			renderCurrentDocument();
			return;
		}

		const stroke = drawingDocument.tail.at(-1);
		if (!stroke) return;

		const lastPoint = stroke.points.at(-1);
		if (lastPoint && point[0] === lastPoint[0] && point[1] === lastPoint[1]) {
			return;
		}

		stroke.points.push(point);
		committedCacheDirty = true;
		renderCurrentDocument();
	};

	const commitActiveStroke = () => {
		if (!activeStroke) return;

		drawingDocument = appendCommittedStroke(drawingDocument, activeStroke);
		activeStroke = null;
		committedCacheDirty = true;
		renderCurrentDocument();
	};

	const startDrawing = (event: PointerEvent) => {
		if (!canvasElement) return;
		if (!event.isPrimary) return;

		event.preventDefault();

		const point = getPoint(event);
		if (!point) return;

		canvasElement.setPointerCapture(event.pointerId);
		activePointerId = event.pointerId;
		startStroke(point);
		isDrawing = true;
	};

	const draw = (event: PointerEvent) => {
		if (!isDrawing || !canvasElement) return;
		if (!event.isPrimary) return;
		if (activePointerId !== event.pointerId) return;

		event.preventDefault();

		if ((event.buttons & 1) === 0) {
			stopDrawing();
			return;
		}

		const point = getPoint(event);
		if (!point) return;

		appendPoint(point);
	};

	const stopDrawing = () => {
		activeStroke = null;
		isDrawing = false;
		activePointerId = null;
	};

	const finishDrawing = (event?: PointerEvent) => {
		if (
			canvasElement &&
			event &&
			activePointerId === event.pointerId &&
			canvasElement.hasPointerCapture(event.pointerId)
		) {
			canvasElement.releasePointerCapture(event.pointerId);
		}

		if (responsiveDrawing) {
			commitActiveStroke();
		}

		stopDrawing();
	};

	const cancelDrawing = (event: PointerEvent) => {
		event.preventDefault();
		finishDrawing(event);
	};

	const preventCanvasDrag = (event: DragEvent) => {
		event.preventDefault();
	};

	const handleEnterGallery = async () => {
		if (isSaving) return;

		saveError = '';
		isSaving = true;

		try {
			let avatarPayload: string | null;

			try {
				avatarPayload = await createAvatarPayload(drawingDocument);
			} catch (error) {
				console.error('Failed to create avatar payload', error);
				saveError = 'This browser could not prepare your avatar. Please try again.';
				return;
			}

			if (!avatarPayload) {
				console.error(
					'Failed to create avatar payload',
					new Error('createAvatarPayload returned no payload')
				);
				saveError = 'This browser could not prepare your avatar. Please try again.';
				return;
			}

			const result = await saveAvatar(avatarPayload);
			if (!result.success) {
				saveError = result.message;
				return;
			}

			if (draftKey) {
				clearDrawingDraft(draftKey);
			}

			onContinue?.();
		} finally {
			isSaving = false;
		}
	};

	onMount(() => {
		let draftLoadCancelled = false;

		baselineDocument = initialDrawingDocument
			? cloneDrawingDocumentV2(initialDrawingDocument)
			: createEmptyDrawingDocumentV2('avatar');

		if (draftKey) {
			void loadDrawingDraft(draftKey, legacyDraftKey).then((draft) => {
				if (draftLoadCancelled) return;

				drawingDocument =
					draft?.kind === 'avatar' ? draft : cloneDrawingDocumentV2(baselineDocument);
				committedCacheDirty = true;
			});
		} else {
			drawingDocument = cloneDrawingDocumentV2(baselineDocument);
			committedCacheDirty = true;
		}

		const handleWindowPointerRelease = () => {
			finishDrawing();
		};

		window.addEventListener('pointerup', handleWindowPointerRelease);
		window.addEventListener('pointercancel', handleWindowPointerRelease);
		window.addEventListener('blur', handleWindowPointerRelease);

		renderCurrentDocument();

		return () => {
			draftLoadCancelled = true;
			window.removeEventListener('pointerup', handleWindowPointerRelease);
			window.removeEventListener('pointercancel', handleWindowPointerRelease);
			window.removeEventListener('blur', handleWindowPointerRelease);
		};
	});

	$effect(() => {
		if (!draftKey) return;
		saveDrawingDraft(draftKey, drawingDocument);
	});

	$effect(() => {
		renderCurrentDocument();
	});
</script>

<div class="space-y-4">
	<div class="space-y-2 text-center">
		<p class="text-sm text-[var(--color-muted)]">Sketch a quick self-portrait for {nickname}.</p>
	</div>

	{#if saveError}
		<div
			class="rounded-[1rem] border-2 border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] px-4 py-3 text-sm text-[var(--color-danger)]"
		>
			{saveError}
		</div>
	{/if}

	<div class="mx-auto grid max-w-[41rem] gap-4 md:grid-cols-[10.5rem_minmax(0,1fr)] md:items-start">
		<div class="order-2 md:order-1">
			<div class="grid gap-3 md:h-[27rem] md:grid-cols-[3.5rem_minmax(0,1fr)]">
				<div
					class="flex items-center gap-3 rounded-[1rem] border border-[rgb(107_74_46_/_0.15)] bg-[rgb(255_255_255_/_0.32)] px-3 py-3 md:flex-col md:justify-between md:px-2"
				>
					<p
						class="font-display shrink-0 text-[0.62rem] font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase md:rotate-180 md:[writing-mode:vertical-rl]"
					>
						Brush
					</p>
					<div class="flex min-w-0 flex-1 items-center justify-center py-1 md:py-2">
						<input
							bind:value={brushStep}
							type="range"
							min="0"
							max={(BRUSH_SIZES.length - 1).toString()}
							step="1"
							class="brush-slider h-8 w-full min-w-0 cursor-pointer appearance-none md:w-60 md:-rotate-90"
							aria-label="Brush size"
						/>
					</div>
					<div
						class="flex shrink-0 items-center justify-center"
						data-testid="brush-preview-shell"
						style={`width:${BRUSH_PREVIEW_SIZE}px;height:${BRUSH_PREVIEW_SIZE}px;`}
					>
						<div
							class="rounded-full border border-[rgb(47_36_28_/_0.14)]"
							data-testid="brush-preview-dot"
							style={`width:${brushPreviewDiameter}px;height:${brushPreviewDiameter}px;background:${activeColor};`}
						></div>
					</div>
				</div>

				<div class="grid h-full grid-cols-4 content-start gap-2 sm:grid-cols-6 md:grid-cols-2">
					{#each palette as color (color)}
						<button
							type="button"
							class={`h-11 w-11 justify-self-center rounded-xl border-2 md:h-10 md:w-10 ${activeColor === color ? 'border-[var(--color-ink)] shadow-[0_0_0_3px_rgb(47_36_28_/_0.18)]' : 'border-[var(--color-accent)]'}`}
							style={`background:${color};`}
							aria-pressed={activeColor === color}
							onclick={() => {
								activeColor = color;
							}}
							aria-label={`Select color ${color}`}
						></button>
					{/each}
				</div>
			</div>
		</div>

		<div class="order-1 space-y-3 md:order-2">
			<div
				class="mx-auto aspect-square w-full max-w-[27rem] rounded-[1.25rem] border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-2 shadow-[6px_6px_0_rgb(47_36_28_/_0.14)] sm:p-2.5"
				data-testid="avatar-sketchpad-frame"
			>
				<div
					class="relative h-full w-full overflow-hidden rounded-[1rem] border-2 border-[var(--color-accent)] bg-white"
				>
					<div
						class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgb(255_255_255_/_0.55),transparent_48%)]"
					></div>
					<div
						class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,transparent,rgb(47_36_28_/_0.06))]"
					></div>
					<canvas
						bind:this={canvasElement}
						width={CANVAS_WIDTH}
						height={CANVAS_HEIGHT}
						class="relative z-[1] h-full w-full cursor-crosshair touch-none"
						data-responsive-mode={responsiveDrawing ? 'active' : 'inactive'}
						draggable="false"
						ondragstart={preventCanvasDrag}
						onpointerdown={startDrawing}
						onpointermove={draw}
						onpointerup={finishDrawing}
						onpointercancel={cancelDrawing}
					></canvas>
				</div>
			</div>

			<div class="pt-2 md:pt-4 md:pl-4">
				<div class="flex flex-col gap-3 sm:flex-row">
					<GameButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full sm:w-auto"
						onclick={() => {
							saveError = '';
							activeStroke = null;
							drawingDocument = cloneDrawingDocumentV2(clearDocument);
							committedCacheDirty = true;
						}}
						disabled={isSaving}
					>
						<span>Clear</span>
					</GameButton>
					<GameButton
						onclick={handleEnterGallery}
						disabled={isSaving}
						size="md"
						className="w-full sm:w-auto"
					>
						<span>{isSaving ? 'Saving...' : submitLabel}</span>
					</GameButton>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.brush-slider::-webkit-slider-runnable-track {
		height: 2px;
		border-radius: 999px;
		background: rgba(107, 74, 46, 0.35);
	}

	.brush-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		margin-top: -7px;
		height: 16px;
		width: 16px;
		border: 2px solid #2b2622;
		border-radius: 999px;
		background: #fdfbf7;
		box-shadow: 0 1px 4px rgba(43, 38, 34, 0.18);
	}

	.brush-slider::-moz-range-track {
		height: 2px;
		border: none;
		border-radius: 999px;
		background: rgba(107, 74, 46, 0.35);
	}

	.brush-slider::-moz-range-thumb {
		height: 16px;
		width: 16px;
		border: 2px solid #2b2622;
		border-radius: 999px;
		background: #fdfbf7;
		box-shadow: 0 1px 4px rgba(43, 38, 34, 0.18);
	}
</style>
