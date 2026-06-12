<script lang="ts">
	import { onMount } from 'svelte';
	import {
		buildDrawingDraftKey,
		createDrawingDraftSession,
		type IndexedDbDrawingDraftStore
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
	const LIGHT_DAB_COLORS = new Set([
		'#FFFFFF',
		'#C8C8C8',
		'#FDBCB4',
		'#F5D200',
		'#DCC9A3',
		'#E5DECA'
	]);
	const DEFAULT_AVATAR_COLOR = drawingPalette[3] ?? drawingPalette[0] ?? '#1a1a1a';
	const AVATAR_CANVAS_BACKGROUND = '#ffffff';

	const CANVAS_WIDTH = AVATAR_DRAWING_DIMENSIONS.width;
	const CANVAS_HEIGHT = AVATAR_DRAWING_DIMENSIONS.height;
	const UNSAVED_DRAFT_MESSAGE = 'Latest local changes are not saved on this device yet.';

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
		draftStore,
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
		draftStore?: IndexedDbDrawingDraftStore;
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
	let draftStatusMessage = $state('');
	let saveError = $state('');
	let responsiveDrawing = $derived(shouldUseResponsiveDrawing(drawingDocument));
	let committedCacheCanvas: HTMLCanvasElement | null = null;
	let committedCacheDirty = true;
	let sealCanvasElement = $state<HTMLCanvasElement | null>(null);
	let sealBlobElement = $state<HTMLDivElement | null>(null);

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

	const createDraftSession = (
		resolvedDraftKey: string | null,
		resolvedLegacyDraftKey: string | null
	) =>
		resolvedDraftKey
			? createDrawingDraftSession({
					draftKey: resolvedDraftKey,
					legacyKey: resolvedLegacyDraftKey,
					store: draftStore
				})
			: null;

	const clearUnsavedDraftWarning = () => {
		draftStatusMessage = '';
	};

	const markUnsavedDraftWarning = () => {
		draftStatusMessage = UNSAVED_DRAFT_MESSAGE;
	};

	const resetDraftSession = async (seedDocument: DrawingDocumentV2) => {
		const draftSession = createDraftSession(draftKey, legacyDraftKey);
		if (!draftSession) {
			return;
		}

		try {
			await draftSession.clear();
			await draftSession.hydrate({ seedDocument });
			clearUnsavedDraftWarning();
		} catch {
			markUnsavedDraftWarning();
		}
	};

	const persistCommittedStroke = async (
		previousDocument: DrawingDocumentV2,
		stroke: DrawingStroke
	) => {
		const draftSession = createDraftSession(draftKey, legacyDraftKey);
		if (!draftSession) {
			return;
		}

		try {
			await draftSession.appendCommittedStroke(previousDocument, stroke);
			clearUnsavedDraftWarning();
		} catch {
			markUnsavedDraftWarning();
		}
	};

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

	// Live wax-seal preview: the drawing (sans ghost guides) scaled into the
	// seal well, so artists see exactly what gets pressed into their seal.
	const updateSealPreview = () => {
		const seal = sealCanvasElement;
		const context = seal?.getContext('2d');
		if (!seal || !context) return;

		context.fillStyle = AVATAR_CANVAS_BACKGROUND;
		context.fillRect(0, 0, seal.width, seal.height);
		context.save();
		context.scale(seal.width / CANVAS_WIDTH, seal.height / CANVAS_HEIGHT);
		for (const stroke of getRenderableDrawingStrokes(drawingDocument)) {
			renderDrawingStroke(context, stroke);
		}
		if (activeStroke) {
			renderDrawingStroke(context, activeStroke);
		}
		context.restore();
	};

	const pressSealAnimation = () => {
		const blob = sealBlobElement;
		if (!blob) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		blob.animate([{ scale: '1' }, { scale: '0.88', offset: 0.4 }, { scale: '1' }], {
			duration: 360,
			easing: 'cubic-bezier(0.34, 1.5, 0.6, 1)'
		});
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

		const previousDocument = cloneDrawingDocumentV2(drawingDocument);
		const committedStroke = {
			color: activeStroke.color,
			points: activeStroke.points.map((point) => [point[0], point[1]] as [number, number]),
			size: activeStroke.size
		};

		drawingDocument = appendCommittedStroke(previousDocument, committedStroke);
		void persistCommittedStroke(previousDocument, committedStroke);
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
		} else if (isDrawing) {
			const previousDocument = cloneDrawingDocumentV2(drawingDocument);
			const committedStroke = previousDocument.tail.pop();
			if (committedStroke) {
				void persistCommittedStroke(previousDocument, committedStroke);
			}
		}

		stopDrawing();
		pressSealAnimation();
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

			const draftSession = createDraftSession(draftKey, legacyDraftKey);
			void draftSession?.clear();

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
		const draftSession = createDraftSession(draftKey, legacyDraftKey);

		if (draftSession) {
			void draftSession
				.hydrate({ seedDocument: baselineDocument })
				.then((draft) => {
					if (draftLoadCancelled) return;

					drawingDocument =
						draft?.kind === 'avatar' ? draft : cloneDrawingDocumentV2(baselineDocument);
					committedCacheDirty = true;
					clearUnsavedDraftWarning();
				})
				.catch(() => {
					if (draftLoadCancelled) return;

					drawingDocument = cloneDrawingDocumentV2(baselineDocument);
					committedCacheDirty = true;
					markUnsavedDraftWarning();
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
		renderCurrentDocument();
		updateSealPreview();
	});
</script>

<div class="sketchpad">
	<p class="sketch-subtitle">
		Sketch a quick self-portrait for <span class="sketch-nickname">{nickname}</span>.
	</p>

	{#if saveError}
		<div class="sketch-alert">{saveError}</div>
	{/if}

	{#if draftStatusMessage}
		<div class="sketch-alert">{draftStatusMessage}</div>
	{/if}

	<div class="sketch-bench">
		<div class="sketch-rail">
			<p class="rail-label">Paints</p>
			<div class="paint-grid">
				{#each palette as color, index (color)}
					<button
						type="button"
						class="paint-dab"
						class:is-active={activeColor === color}
						style={`--dab-color:${color};--dab-i:${index};`}
						aria-pressed={activeColor === color}
						onclick={() => {
							activeColor = color;
						}}
						aria-label={`Select color ${color}`}
					>
						<!-- The blob animates while the button box stays still, so clicks
						     always land where the pointer went down. -->
						<span
							class="dab-paint"
							class:dab-paint-light={LIGHT_DAB_COLORS.has(color)}
							aria-hidden="true"
						></span>
					</button>
				{/each}
			</div>

			<div class="brush-block">
				<p class="rail-label">Brush</p>
				<div class="brush-row">
					<input
						bind:value={brushStep}
						type="range"
						min="0"
						max={(BRUSH_SIZES.length - 1).toString()}
						step="1"
						class="brush-slider"
						aria-label="Brush size"
					/>
					<div class="test-scrap-stack">
						<div class="test-scrap">
							<div
								class="flex items-center justify-center"
								data-testid="brush-preview-shell"
								style={`width:${BRUSH_PREVIEW_SIZE}px;height:${BRUSH_PREVIEW_SIZE}px;`}
							>
								<div
									class="test-dot"
									data-testid="brush-preview-dot"
									style={`width:${brushPreviewDiameter}px;height:${brushPreviewDiameter}px;background:${activeColor};`}
								></div>
							</div>
						</div>
						<p class="test-caption">test dab</p>
					</div>
				</div>
			</div>
		</div>

		<div class="sketch-easel">
			<div class="canvas-mat aspect-square" data-testid="avatar-sketchpad-frame">
				<span class="canvas-tape canvas-tape-left" aria-hidden="true"></span>
				<span class="canvas-tape canvas-tape-right" aria-hidden="true"></span>
				<canvas
					bind:this={canvasElement}
					width={CANVAS_WIDTH}
					height={CANVAS_HEIGHT}
					class="sketch-canvas"
					data-responsive-mode={responsiveDrawing ? 'active' : 'inactive'}
					draggable="false"
					ondragstart={preventCanvasDrag}
					onpointerdown={startDrawing}
					onpointermove={draw}
					onpointerup={finishDrawing}
					onpointercancel={cancelDrawing}
				></canvas>
			</div>
			<div class="seal-station" aria-hidden="true">
				<div class="seal-blob" bind:this={sealBlobElement}>
					<div class="seal-well">
						<canvas bind:this={sealCanvasElement} width="124" height="124" class="seal-canvas"
						></canvas>
					</div>
				</div>
				<p class="seal-caption">your wax seal</p>
			</div>
			<p class="easel-note">draw inside the lines… or don't.</p>
		</div>
	</div>

	<div class="sketch-footer">
		<p class="footer-note">you can redraw it whenever you like</p>
		<GameButton
			type="button"
			variant="ghost"
			size="sm"
			onclick={() => {
				saveError = '';
				activeStroke = null;
				drawingDocument = cloneDrawingDocumentV2(clearDocument);
				void resetDraftSession(clearDocument);
				committedCacheDirty = true;
				pressSealAnimation();
			}}
			disabled={isSaving}
		>
			<span>Clear</span>
		</GameButton>
		<GameButton onclick={handleEnterGallery} disabled={isSaving} size="md">
			<span>{isSaving ? 'Saving...' : submitLabel}</span>
		</GameButton>
	</div>
</div>

<style>
	.sketch-subtitle {
		margin: 0;
		font-family: 'Caveat', cursive;
		font-size: 1.45rem;
		font-weight: 600;
		text-align: center;
		color: #6b5a45;
		rotate: -0.4deg;
	}

	.sketch-nickname {
		color: #9c4a3c;
	}

	/* a taped warning strip, not a UI alert */
	.sketch-alert {
		margin-top: 12px;
		padding: 10px 14px;
		background: #faeeea;
		border: 1px solid rgba(162, 77, 73, 0.5);
		box-shadow: 1px 2px 5px rgba(45, 36, 32, 0.12);
		rotate: -0.3deg;
		font-size: 0.85rem;
		font-weight: 600;
		color: #8f3720;
	}

	.sketch-bench {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 26px 30px;
		margin-top: 18px;
		align-items: start;
	}

	@media (min-width: 768px) {
		.sketch-bench {
			grid-template-columns: 232px minmax(0, 1fr);
		}
	}

	.sketch-rail {
		order: 2;
	}

	.sketch-easel {
		position: relative;
		order: 1;
	}

	@media (min-width: 768px) {
		.sketch-rail {
			order: 1;
		}
		.sketch-easel {
			order: 2;
		}
	}

	.rail-label {
		margin: 0 0 10px;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	/* ── paint dabs ── */
	.paint-grid {
		display: grid;
		grid-template-columns: repeat(6, 40px);
		gap: 12px 10px;
		justify-content: start;
	}

	@media (min-width: 768px) {
		.paint-grid {
			grid-template-columns: repeat(4, 44px);
		}
	}

	.paint-dab {
		position: relative;
		width: 40px;
		height: 36px;
		border: 0;
		padding: 0;
		cursor: pointer;
		background: transparent;
	}

	@media (min-width: 768px) {
		.paint-dab {
			width: 44px;
			height: 40px;
		}
	}

	.dab-paint {
		position: absolute;
		inset: 0;
		display: block;
		background: var(--dab-color);
		box-shadow: 1px 2px 3px rgba(45, 36, 32, 0.28);
		transition:
			scale 130ms cubic-bezier(0.34, 1.5, 0.6, 1),
			rotate 130ms ease;
		animation: dab-pop 320ms cubic-bezier(0.3, 1.5, 0.55, 1) both;
		animation-delay: calc(var(--dab-i) * 16ms);
	}

	@keyframes dab-pop {
		from {
			opacity: 0;
			scale: 0.3;
		}
	}

	/* four blob silhouettes, rotated per cell — every dab is hand-squeezed */
	.paint-dab:nth-child(4n + 1) .dab-paint {
		border-radius: 58% 42% 55% 45% / 48% 60% 40% 52%;
		rotate: -4deg;
	}
	.paint-dab:nth-child(4n + 2) .dab-paint {
		border-radius: 45% 55% 48% 52% / 60% 42% 58% 40%;
		rotate: 3deg;
	}
	.paint-dab:nth-child(4n + 3) .dab-paint {
		border-radius: 52% 48% 60% 40% / 45% 55% 45% 55%;
		rotate: -2deg;
	}
	.paint-dab:nth-child(4n + 4) .dab-paint {
		border-radius: 40% 60% 44% 56% / 55% 45% 60% 40%;
		rotate: 5deg;
	}

	/* gloss — fresh paint catches the gallery lights */
	.dab-paint::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(circle at 30% 26%, rgba(255, 255, 255, 0.5), transparent 46%);
	}

	.dab-paint-light {
		border: 1px solid rgba(47, 36, 28, 0.22);
	}

	.paint-dab:hover .dab-paint {
		scale: 1.12;
	}

	.paint-dab:focus-visible {
		outline: 3px solid #4ecdc4;
		outline-offset: 3px;
	}

	/* selection = circled in pencil */
	.paint-dab.is-active .dab-paint {
		scale: 1.1;
	}

	.paint-dab.is-active::after {
		content: '';
		position: absolute;
		inset: -6px -5px -5px -6px;
		border: 2.5px dashed rgba(47, 36, 28, 0.75);
		border-radius: 54% 46% 50% 50% / 48% 52% 46% 54%;
		rotate: -6deg;
	}

	/* ── brush: pencil line + wax knob ── */
	.brush-block {
		margin-top: 26px;
	}

	.brush-row {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.brush-slider {
		flex: 1;
		appearance: none;
		-webkit-appearance: none;
		height: 28px;
		background: transparent;
		cursor: pointer;
		min-width: 0;
	}

	.brush-slider::-webkit-slider-runnable-track {
		height: 3px;
		border-radius: 999px;
		background: rgba(107, 74, 46, 0.4);
	}

	.brush-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		margin-top: -8.5px;
		height: 20px;
		width: 20px;
		border: 2px solid #fdfbf7;
		border-radius: 48% 52% 50% 50% / 52% 48% 54% 46%;
		background: radial-gradient(circle at 32% 28%, #c96a5b, #a8403a 55%, #6e211c);
		box-shadow: 1px 2px 4px rgba(45, 36, 32, 0.35);
	}

	.brush-slider::-moz-range-track {
		height: 3px;
		border: none;
		border-radius: 999px;
		background: rgba(107, 74, 46, 0.4);
	}

	.brush-slider::-moz-range-thumb {
		height: 20px;
		width: 20px;
		border: 2px solid #fdfbf7;
		border-radius: 50%;
		background: radial-gradient(circle at 32% 28%, #c96a5b, #a8403a 55%, #6e211c);
		box-shadow: 1px 2px 4px rgba(45, 36, 32, 0.35);
	}

	.brush-slider:focus-visible {
		outline: 3px solid #4ecdc4;
		outline-offset: 2px;
	}

	/* the test scrap: a chip of paper where the current dab size shows */
	.test-scrap-stack {
		flex-shrink: 0;
	}

	.test-scrap {
		position: relative;
		display: grid;
		place-items: center;
		padding: 5px;
		background: #fdfbf7;
		border: 1px solid #d6cfc5;
		box-shadow: 2px 3px 7px rgba(0, 0, 0, 0.18);
		rotate: 3deg;
	}

	.test-scrap::before {
		content: '';
		position: absolute;
		top: -7px;
		left: 12px;
		width: 30px;
		height: 12px;
		background: rgba(243, 235, 216, 0.9);
		rotate: -4deg;
		box-shadow: 0 1px 2px rgba(45, 36, 32, 0.15);
	}

	.test-dot {
		border-radius: 50%;
		border: 1px solid rgba(47, 36, 28, 0.14);
		transition:
			width 120ms ease,
			height 120ms ease,
			background 120ms ease;
	}

	.test-caption {
		margin: 6px 0 0;
		font-family: 'Caveat', cursive;
		font-size: 1rem;
		font-weight: 600;
		text-align: center;
		color: #8a6c52;
		rotate: 2deg;
	}

	/* ── the easel ── */
	.canvas-mat {
		position: relative;
		aspect-ratio: 1;
		width: 100%;
		max-width: 27rem;
		margin-inline: auto;
		background: #fdfbf7;
		padding: 11px;
		border: 1px solid #d6cfc5;
		box-shadow:
			3px 4px 12px rgba(0, 0, 0, 0.22),
			1px 1px 3px rgba(0, 0, 0, 0.12);
	}

	.canvas-tape {
		position: absolute;
		width: 84px;
		height: 24px;
		background: rgba(243, 235, 216, 0.85);
		box-shadow: 0 1px 3px rgba(45, 36, 32, 0.18);
		z-index: 2;
	}

	.canvas-tape-left {
		top: -11px;
		left: 26px;
		rotate: -6deg;
	}

	.canvas-tape-right {
		top: -9px;
		right: 30px;
		rotate: 5deg;
	}

	.sketch-canvas {
		display: block;
		width: 100%;
		/* Sized by its own ratio, never by the mat's height: Safari cannot
		 * resolve a percentage height against an aspect-ratio-derived box and
		 * falls back to the canvas's intrinsic 340px, overflowing the mat. */
		height: auto;
		aspect-ratio: 1;
		cursor: crosshair;
		touch-action: none;
		background: #ffffff;
		border: 1px solid #e7dfd2;
	}

	.easel-note {
		margin: 10px 4px 0;
		font-family: 'Caveat', cursive;
		font-size: 1.15rem;
		font-weight: 600;
		color: #8a6c52;
		rotate: -1.4deg;
	}

	/* live wax-seal preview, pressed onto the corner of the easel */
	.seal-station {
		position: absolute;
		top: -26px;
		right: -8px;
		z-index: 3;
		display: flex;
		flex-direction: column;
		align-items: center;
		rotate: 6deg;
		pointer-events: none;
	}

	@media (min-width: 768px) {
		.seal-station {
			right: -14px;
		}
	}

	.seal-blob {
		position: relative;
		width: 92px;
		height: 92px;
		border-radius: 53% 47% 50% 50% / 49% 53% 47% 51%;
		background:
			radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.28), transparent 38%),
			radial-gradient(circle at 70% 80%, rgba(0, 0, 0, 0.3), transparent 52%),
			radial-gradient(circle at 50% 45%, #a8403a 0%, #6e211c 78%);
		box-shadow:
			2px 4px 9px rgba(20, 6, 4, 0.45),
			inset 0 -3px 6px rgba(0, 0, 0, 0.25);
		display: grid;
		place-items: center;
	}

	.seal-well {
		width: 62px;
		height: 62px;
		border-radius: 50%;
		overflow: hidden;
		box-shadow:
			inset 0 2px 5px rgba(0, 0, 0, 0.45),
			0 1px 1px rgba(255, 255, 255, 0.22);
		background: #ffffff;
	}

	.seal-canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.seal-caption {
		margin: 6px 0 0;
		font-family: 'Caveat', cursive;
		font-size: 1.05rem;
		font-weight: 700;
		color: #7a5c40;
		rotate: -4deg;
	}

	/* ── footer ── */
	.sketch-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 12px 16px;
		margin-top: 22px;
	}

	.footer-note {
		margin: 0 auto 0 0;
		font-family: 'Caveat', cursive;
		font-size: 1.1rem;
		font-weight: 600;
		color: #8a6c52;
		rotate: -1deg;
	}

	@media (max-width: 540px) {
		.footer-note {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dab-paint {
			animation: none;
		}
	}
</style>
