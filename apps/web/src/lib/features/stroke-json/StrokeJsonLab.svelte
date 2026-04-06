<script lang="ts">
	import { tick } from 'svelte';
	import { gzipSync } from 'fflate';
	import { renderDrawingDocumentToCanvas } from './canvas';
	import {
		DEFAULT_SAFE_RASTER_GUARD_PRESET_ID,
		resolveSafeRasterGuardPreset,
		SAFE_RASTER_GUARD_PRESETS,
		type SafeRasterGuardPresetId
	} from './compaction';
	import {
		PROD_LIKE_PIPELINE_ITERATION_COUNT,
		type ProdLikePipelineIterationResult
	} from './prod-like-pipeline';
	import {
		ARTWORK_DRAWING_DIMENSIONS,
		AVATAR_DRAWING_DIMENSIONS,
		countDrawingPoints,
		createEmptyDrawingDocumentV2,
		getDrawingPointWithinBounds,
		getRenderableDrawingStrokes,
		parseEditableDrawingDocumentV2,
		parseDrawingDocumentV2,
		serializeCanonicalDrawingDocument,
		type DrawingDocumentV2,
		type DrawingKind,
		type DrawingPoint
	} from './document';
	import {
		runBitmapCloneExperiment,
		runJsonCloneExperiment,
		type CanvasExportMeasurement
	} from './experiments';
	import {
		compactDrawingDocumentLosslesslyWithReport,
		decodeCompressedDrawingDocument,
		runProdLikePipeline
	} from './runtime.browser';

	const palette = ['#2d2420', '#d4956c', '#8b9d91', '#c84f4f', '#6b8e7f', '#f4c430', '#fdfbf7'];
	const brushSizes = [2, 4, 6, 10, 14, 18];
	const cloneIterations = 20;
	const textEncoder = new TextEncoder();

	type ProdLikePipelineIterationSummary = Omit<ProdLikePipelineIterationResult, 'document'> & {
		diffPixels: number | null;
	};

	let canvasRef = $state<HTMLCanvasElement | null>(null);
	let activeColor = $state(palette[0]);
	let brushSize = $state(brushSizes[2]);
	let drawingKind = $state<DrawingKind>('artwork');
	let drawingDocument = $state<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork'));
	let activeTailStrokeIndex = $state<number | null>(null);
	let isDrawing = $state(false);
	let isRunningBitmapClone = $state(false);
	let isRunningJsonClone = $state(false);
	let isRunningRasterOracle = $state(false);
	let isRunningProdLikePipeline = $state(false);
	let jsonRawBytes = $state(0);
	let jsonGzipBytes = $state(0);
	let originalExportBytes = $state(0);
	let originalExportFormat = $state('image/webp');
	let bitmapDiffPixels = $state<number | null>(null);
	let jsonDiffPixels = $state<number | null>(null);
	let bitmapCloneBytes = $state<number | null>(null);
	let bitmapCloneFormat = $state<string | null>(null);
	let jsonCloneBytes = $state<number | null>(null);
	let jsonCloneFormat = $state<string | null>(null);
	let bitmapClonePreviewUrl = $state('');
	let jsonClonePreviewUrl = $state('');
	let originalPreviewUrl = $state('');
	let selectedRasterGuardPresetId = $state<SafeRasterGuardPresetId>(
		DEFAULT_SAFE_RASTER_GUARD_PRESET_ID
	);
	let rasterOraclePreviewUrl = $state('');
	let rasterOracleError = $state<string | null>(null);
	let rasterOracleSelectedPresetLabel = $state<string | null>(null);
	let rasterOracleMaxStrokeArea = $state<number | null>(null);
	let rasterOracleGuardedStrokeCount = $state<number | null>(null);
	let rasterOracleFinalDiffPixels = $state<number | null>(null);
	let rasterOracleFinalRawBytes = $state<number | null>(null);
	let rasterOracleFinalGzipBytes = $state<number | null>(null);
	let rasterOracleFinalStrokeCount = $state<number | null>(null);
	let rasterOracleFinalPointCount = $state<number | null>(null);
	let prodLikePreviewUrl = $state('');
	let prodLikePipelineError = $state<string | null>(null);
	let prodLikeFinalDiffPixels = $state<number | null>(null);
	let prodLikeFinalRawBytes = $state<number | null>(null);
	let prodLikeFinalGzipBytes = $state<number | null>(null);
	let prodLikeTotalDurationMs = $state<number | null>(null);
	let prodLikeFinalDurationMs = $state<number | null>(null);
	let prodLikeFinalStrokeCount = $state<number | null>(null);
	let prodLikeFinalPointCount = $state<number | null>(null);
	let compressedDrawingPayload = $state('');
	let compressedDrawingLoadError = $state<string | null>(null);
	let isLoadingCompressedPayload = $state(false);
	let prodLikePipelineIterations = $state<ProdLikePipelineIterationSummary[]>([]);

	const currentDimensions = $derived(
		drawingKind === 'artwork' ? ARTWORK_DRAWING_DIMENSIONS : AVATAR_DRAWING_DIMENSIONS
	);
	const strokeCount = $derived(getRenderableDrawingStrokes(drawingDocument).length);
	const baseStrokeCount = $derived(drawingDocument.base.length);
	const tailStrokeCount = $derived(drawingDocument.tail.length);
	const totalPointCount = $derived(countDrawingPoints(drawingDocument));
	const rasterGuardPresetOptions = Object.entries(SAFE_RASTER_GUARD_PRESETS).map(
		([id, preset]) => ({
			id: id as SafeRasterGuardPresetId,
			label: preset.label
		})
	);
	const selectedRasterGuardPreset = $derived(
		resolveSafeRasterGuardPreset(selectedRasterGuardPresetId, currentDimensions)
	);
	const prodLikePipelineButtonLabel = `Run ${PROD_LIKE_PIPELINE_ITERATION_COUNT}x prod-like pipeline`;

	const formatRasterGuardMaxArea = (value: number | null) =>
		value === null ? 'Unlimited' : `${value} px`;

	const createWorkingCanvas = (documentState: DrawingDocumentV2) => {
		const canvas = window.document.createElement('canvas');
		canvas.width = documentState.width;
		canvas.height = documentState.height;
		return canvas;
	};

	const renderCurrentDocument = () => {
		if (!canvasRef) return;
		renderDrawingDocumentToCanvas(canvasRef, drawingDocument);
	};

	const buildRenderedCanvas = (documentState: DrawingDocumentV2) => {
		const nextCanvas = window.document.createElement('canvas');
		nextCanvas.width = documentState.width;
		nextCanvas.height = documentState.height;
		renderDrawingDocumentToCanvas(nextCanvas, documentState);
		return nextCanvas;
	};

	const toWebpBlob = (canvas: HTMLCanvasElement) =>
		new Promise<Blob | null>((resolve) => {
			canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.68);
		});

	const toPngBlob = (canvas: HTMLCanvasElement) =>
		new Promise<Blob | null>((resolve) => {
			canvas.toBlob((blob) => resolve(blob), 'image/png');
		});

	const measureCanvasExport = async (
		canvas: HTMLCanvasElement
	): Promise<CanvasExportMeasurement<Blob>> => {
		const webpBlob = await toWebpBlob(canvas);
		if (webpBlob && webpBlob.size > 0) {
			return {
				blob: webpBlob,
				bytes: webpBlob.size,
				format: webpBlob.type || 'image/webp'
			};
		}

		const pngBlob = await toPngBlob(canvas);
		if (pngBlob && pngBlob.size > 0) {
			return {
				blob: pngBlob,
				bytes: pngBlob.size,
				format: pngBlob.type || 'image/png'
			};
		}

		throw new Error('This browser could not export the canvas for measurement');
	};

	const toGzipByteLength = (value: string) => gzipSync(new TextEncoder().encode(value)).byteLength;
	const toRawByteLength = (value: string) => textEncoder.encode(value).byteLength;

	const snapshotCanvas = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/png');

	const loadImageFromBlob = async (blob: Blob) => {
		const imageUrl = URL.createObjectURL(blob);

		try {
			const image = await new Promise<HTMLImageElement>((resolve, reject) => {
				const nextImage = new Image();
				nextImage.onload = () => resolve(nextImage);
				nextImage.onerror = () => reject(new Error('Failed to load bitmap clone image'));
				nextImage.src = imageUrl;
			});

			return image;
		} finally {
			URL.revokeObjectURL(imageUrl);
		}
	};

	const countPixelDiff = (left: HTMLCanvasElement, right: HTMLCanvasElement) => {
		const leftContext = left.getContext('2d');
		const rightContext = right.getContext('2d');
		if (!leftContext || !rightContext) return null;

		const leftPixels = leftContext.getImageData(0, 0, left.width, left.height).data;
		const rightPixels = rightContext.getImageData(0, 0, right.width, right.height).data;
		let diffPixels = 0;

		for (let index = 0; index < leftPixels.length; index += 4) {
			if (
				leftPixels[index] !== rightPixels[index] ||
				leftPixels[index + 1] !== rightPixels[index + 1] ||
				leftPixels[index + 2] !== rightPixels[index + 2] ||
				leftPixels[index + 3] !== rightPixels[index + 3]
			) {
				diffPixels += 1;
			}
		}

		return diffPixels;
	};

	const getScaledPoint = (event: PointerEvent): DrawingPoint | null => {
		if (!canvasRef) return null;

		const rect = canvasRef.getBoundingClientRect();
		const scaleX = canvasRef.width / rect.width;
		const scaleY = canvasRef.height / rect.height;
		return getDrawingPointWithinBounds(
			[(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY],
			drawingDocument
		);
	};

	const startStroke = (point: DrawingPoint) => {
		resetExperimentResults();
		drawingDocument.tail.push({
			color: activeColor,
			points: [point],
			size: brushSize
		});
		activeTailStrokeIndex = drawingDocument.tail.length - 1;
		renderCurrentDocument();
	};

	const appendPointToActiveStroke = (point: DrawingPoint) => {
		if (activeTailStrokeIndex === null) return;
		const stroke = drawingDocument.tail[activeTailStrokeIndex];
		if (!stroke) return;

		const lastPoint = stroke.points.at(-1);
		if (lastPoint && Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]) < 2) {
			return;
		}

		stroke.points.push(point);
		renderCurrentDocument();
	};

	const refreshMetrics = async () => {
		if (!canvasRef) return;
		const baselineCanvas = buildRenderedCanvas(drawingDocument);

		const serialized = serializeCanonicalDrawingDocument(drawingDocument);
		jsonRawBytes = toRawByteLength(serialized);
		jsonGzipBytes = toGzipByteLength(serialized);

		const exportMeasurement = await measureCanvasExport(baselineCanvas);
		originalExportBytes = exportMeasurement.bytes;
		originalExportFormat = exportMeasurement.format;
		originalPreviewUrl = snapshotCanvas(baselineCanvas);
	};

	const resetProdLikePipelineResults = () => {
		prodLikePreviewUrl = '';
		prodLikePipelineError = null;
		prodLikeFinalDiffPixels = null;
		prodLikeFinalRawBytes = null;
		prodLikeFinalGzipBytes = null;
		prodLikeTotalDurationMs = null;
		prodLikeFinalDurationMs = null;
		prodLikeFinalStrokeCount = null;
		prodLikeFinalPointCount = null;
		prodLikePipelineIterations = [];
	};

	const resetRasterOracleResults = () => {
		rasterOraclePreviewUrl = '';
		rasterOracleError = null;
		rasterOracleSelectedPresetLabel = null;
		rasterOracleMaxStrokeArea = null;
		rasterOracleGuardedStrokeCount = null;
		rasterOracleFinalDiffPixels = null;
		rasterOracleFinalRawBytes = null;
		rasterOracleFinalGzipBytes = null;
		rasterOracleFinalStrokeCount = null;
		rasterOracleFinalPointCount = null;
	};

	const resetExperimentResults = () => {
		bitmapClonePreviewUrl = '';
		jsonClonePreviewUrl = '';
		bitmapDiffPixels = null;
		jsonDiffPixels = null;
		bitmapCloneBytes = null;
		bitmapCloneFormat = null;
		jsonCloneBytes = null;
		jsonCloneFormat = null;
		resetRasterOracleResults();
		resetProdLikePipelineResults();
	};

	const loadCompressedDocument = async () => {
		if (isLoadingCompressedPayload) return;

		isLoadingCompressedPayload = true;
		compressedDrawingLoadError = null;

		try {
			const decodedDocument = parseEditableDrawingDocumentV2(
				await decodeCompressedDrawingDocument(compressedDrawingPayload)
			);

			drawingKind = decodedDocument.kind;
			drawingDocument = decodedDocument;
			activeTailStrokeIndex = null;
			isDrawing = false;
			resetExperimentResults();

			await tick();
			renderCurrentDocument();
			await refreshMetrics();
		} catch (error) {
			compressedDrawingLoadError =
				error instanceof Error ? error.message : 'Failed to load the compressed drawing payload';
		} finally {
			isLoadingCompressedPayload = false;
		}
	};

	const resetDocument = async (kind: DrawingKind) => {
		drawingKind = kind;
		drawingDocument = createEmptyDrawingDocumentV2(kind);
		activeTailStrokeIndex = null;
		isDrawing = false;
		resetExperimentResults();
		queueMicrotask(() => {
			renderCurrentDocument();
			void refreshMetrics();
		});
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (!canvasRef) return;
		const point = getScaledPoint(event);
		if (!point) return;

		canvasRef.setPointerCapture(event.pointerId);
		startStroke(point);
		isDrawing = true;
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (!isDrawing) return;
		const point = getScaledPoint(event);
		if (!point) {
			activeTailStrokeIndex = null;
			return;
		}

		if (activeTailStrokeIndex === null) {
			startStroke(point);
			return;
		}

		appendPointToActiveStroke(point);
	};

	const finishStroke = async (pointerId?: number) => {
		if (pointerId !== undefined && canvasRef?.hasPointerCapture(pointerId)) {
			canvasRef.releasePointerCapture(pointerId);
		}

		isDrawing = false;
		activeTailStrokeIndex = null;
		await refreshMetrics();
	};

	const runBitmapClone = async () => {
		if (!canvasRef || isRunningBitmapClone) return;

		isRunningBitmapClone = true;
		try {
			const result = await runBitmapCloneExperiment({
				buildRenderedCanvas,
				cloneIterations,
				countPixelDiff,
				document: drawingDocument,
				loadImageFromBlob,
				measureCanvasExport: async (canvas) => {
					const exportMeasurement = await measureCanvasExport(canvas);
					if (exportMeasurement.format !== 'image/webp') {
						throw new Error('WebP export is unavailable in this browser');
					}

					return exportMeasurement;
				},
				rebuildCanvasFromImage: (documentState, image) => {
					const nextCanvas = createWorkingCanvas(documentState);
					const nextContext = nextCanvas.getContext('2d');
					if (!nextContext) {
						throw new Error('Canvas 2D context is unavailable');
					}

					nextContext.fillStyle = documentState.background;
					nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
					nextContext.drawImage(image, 0, 0, nextCanvas.width, nextCanvas.height);
					return nextCanvas;
				},
				snapshotCanvas
			});

			bitmapClonePreviewUrl = result.previewUrl;
			bitmapDiffPixels = result.diffPixels;
			bitmapCloneBytes = result.bytes;
			bitmapCloneFormat = result.format;
		} finally {
			isRunningBitmapClone = false;
		}
	};

	const runJsonClone = async () => {
		if (isRunningJsonClone) return;

		isRunningJsonClone = true;
		try {
			const result = await runJsonCloneExperiment({
				buildRenderedCanvas,
				cloneIterations,
				countPixelDiff,
				document: drawingDocument,
				measureCanvasExport,
				parseDocument: parseDrawingDocumentV2,
				serializeDocument: serializeCanonicalDrawingDocument,
				snapshotCanvas
			});

			jsonClonePreviewUrl = result.previewUrl;
			jsonDiffPixels = result.diffPixels;
			jsonCloneBytes = result.bytes;
			jsonCloneFormat = result.format;
		} finally {
			isRunningJsonClone = false;
		}
	};

	const runExactRasterOracle = async () => {
		if (isRunningRasterOracle) return;

		isRunningRasterOracle = true;
		resetRasterOracleResults();

		try {
			const baselineCanvas = buildRenderedCanvas(drawingDocument);
			const result = await compactDrawingDocumentLosslesslyWithReport(drawingDocument, {
				maxStrokeCoveragePixels: selectedRasterGuardPreset.maxStrokeCoveragePixels
			});
			const finalCanvas = buildRenderedCanvas(result.document);
			const serialized = serializeCanonicalDrawingDocument(result.document);

			rasterOraclePreviewUrl = snapshotCanvas(finalCanvas);
			rasterOracleSelectedPresetLabel = selectedRasterGuardPreset.label;
			rasterOracleMaxStrokeArea = result.stats.maxStrokeCoveragePixels;
			rasterOracleGuardedStrokeCount = result.stats.skippedPartialCompactionStrokeCount;
			rasterOracleFinalDiffPixels = countPixelDiff(baselineCanvas, finalCanvas);
			rasterOracleFinalRawBytes = toRawByteLength(serialized);
			rasterOracleFinalGzipBytes = toGzipByteLength(serialized);
			rasterOracleFinalStrokeCount = getRenderableDrawingStrokes(result.document).length;
			rasterOracleFinalPointCount = countDrawingPoints(result.document);
		} catch (error) {
			rasterOracleError =
				error instanceof Error ? error.message : 'Failed to run the exact raster oracle';
		} finally {
			isRunningRasterOracle = false;
		}
	};

	const runProdLikePipelineExperiment = async () => {
		if (isRunningProdLikePipeline) return;

		isRunningProdLikePipeline = true;
		resetProdLikePipelineResults();

		try {
			const baselineCanvas = buildRenderedCanvas(drawingDocument);
			const result = await runProdLikePipeline(drawingDocument, {
				phase2MaxStrokeCoveragePixels: selectedRasterGuardPreset.maxStrokeCoveragePixels
			});
			const finalIteration = result.iterations.at(-1);
			const finalCanvas = buildRenderedCanvas(result.finalDocument);

			prodLikePreviewUrl = snapshotCanvas(finalCanvas);
			prodLikeFinalDiffPixels = countPixelDiff(baselineCanvas, finalCanvas);
			prodLikeTotalDurationMs = result.totalDurationMs;
			prodLikeFinalRawBytes = finalIteration?.rawBytes ?? null;
			prodLikeFinalGzipBytes = finalIteration?.gzipBytes ?? null;
			prodLikeFinalDurationMs = finalIteration?.durationMs ?? null;
			prodLikeFinalStrokeCount = finalIteration?.strokeCount ?? null;
			prodLikeFinalPointCount = finalIteration?.pointCount ?? null;

			prodLikePipelineIterations = result.iterations.map((iteration) => ({
				diffPixels: countPixelDiff(baselineCanvas, buildRenderedCanvas(iteration.document)),
				durationMs: iteration.durationMs,
				gzipBytes: iteration.gzipBytes,
				passNumber: iteration.passNumber,
				pointCount: iteration.pointCount,
				rawBytes: iteration.rawBytes,
				strokeCount: iteration.strokeCount
			}));
		} catch (error) {
			prodLikePipelineError =
				error instanceof Error ? error.message : 'Failed to run the prod-like pipeline';
		} finally {
			isRunningProdLikePipeline = false;
		}
	};

	$effect(() => {
		const dimensions = currentDimensions;

		if (!canvasRef) return;
		if (canvasRef.width !== dimensions.width || canvasRef.height !== dimensions.height) {
			canvasRef.width = dimensions.width;
			canvasRef.height = dimensions.height;
		}

		renderCurrentDocument();
		void refreshMetrics();
	});
</script>

<svelte:head>
	<title>Stroke JSON Lab</title>
</svelte:head>

<section class="stroke-lab-shell">
	<div class="hero">
		<p class="eyebrow">Research demo</p>
		<h1>Stroke JSON Lab</h1>
		<p class="lede">
			Compare bitmap cloning, canonical V2 replay, the exact raster oracle, and the chained
			prod-like pipeline on the same drawing surface before wiring the new format into product
			flows.
		</p>
	</div>

	<div class="lab-grid">
		<div class="canvas-panel">
			<div class="panel-header">
				<div>
					<p class="label">Surface preset</p>
					<div class="segmented" role="tablist" aria-label="Drawing preset">
						<button
							type="button"
							class:drawing-active={drawingKind === 'artwork'}
							onclick={() => void resetDocument('artwork')}
						>
							Artwork
						</button>
						<button
							type="button"
							class:drawing-active={drawingKind === 'avatar'}
							onclick={() => void resetDocument('avatar')}
						>
							Avatar
						</button>
					</div>
				</div>

				<div class="header-actions">
					<label>
						<span class="label">Brush</span>
						<select bind:value={brushSize}>
							{#each brushSizes as size (size)}
								<option value={size}>{size}px</option>
							{/each}
						</select>
					</label>
					<button
						type="button"
						class="clear-button"
						onclick={() => void resetDocument(drawingKind)}
					>
						Clear
					</button>
				</div>
			</div>

			<div class="palette" aria-label="Color palette">
				{#each palette as color (color)}
					<button
						type="button"
						class:color-active={activeColor === color}
						style={`--swatch:${color};`}
						onclick={() => {
							activeColor = color;
						}}
						aria-label={`Select ${color}`}
					></button>
				{/each}
			</div>

			<div class="canvas-frame">
				<canvas
					bind:this={canvasRef}
					width={currentDimensions.width}
					height={currentDimensions.height}
					onpointerdown={handlePointerDown}
					onpointermove={handlePointerMove}
					onpointerup={(event) => void finishStroke(event.pointerId)}
					onpointerleave={() => {
						if (isDrawing) {
							void refreshMetrics();
						}
					}}
				></canvas>
			</div>

			<div class="experiment-actions">
				<button type="button" onclick={() => void runBitmapClone()} disabled={isRunningBitmapClone}>
					{isRunningBitmapClone ? 'Running bitmap clone...' : 'Run 20x bitmap clone'}
				</button>
				<button type="button" onclick={() => void runJsonClone()} disabled={isRunningJsonClone}>
					{isRunningJsonClone ? 'Running JSON clone...' : 'Run 20x JSON clone'}
				</button>
				<button
					type="button"
					onclick={() => void runExactRasterOracle()}
					disabled={isRunningRasterOracle}
				>
					{isRunningRasterOracle ? 'Running exact raster oracle...' : 'Run exact raster oracle'}
				</button>
				<button
					type="button"
					onclick={() => void runProdLikePipelineExperiment()}
					disabled={isRunningProdLikePipeline}
				>
					{isRunningProdLikePipeline
						? 'Running prod-like pipeline...'
						: prodLikePipelineButtonLabel}
				</button>
			</div>

			<div class="comparison-controls">
				<label>
					<span class="label">Raster guard preset</span>
					<select aria-label="Raster guard preset" bind:value={selectedRasterGuardPresetId}>
						{#each rasterGuardPresetOptions as option (option.id)}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
				<p class="comparison-note">
					Safe presets only. Current max stroke area: {formatRasterGuardMaxArea(
						selectedRasterGuardPreset.maxStrokeCoveragePixels
					)}.
				</p>
			</div>

			<div class="comparison-controls">
				<label class="payload-field">
					<span class="label">Compressed drawing payload</span>
					<textarea
						bind:value={compressedDrawingPayload}
						rows="5"
						spellcheck="false"
						placeholder="Paste a base64 gzip payload from drawingDocument or avatarDocument"
					></textarea>
				</label>
				<button
					type="button"
					onclick={() => void loadCompressedDocument()}
					disabled={isLoadingCompressedPayload}
				>
					{isLoadingCompressedPayload ? 'Loading compressed payload...' : 'Load compressed payload'}
				</button>
				{#if compressedDrawingLoadError}
					<p class="load-error" role="alert">{compressedDrawingLoadError}</p>
				{/if}
			</div>
		</div>

		<div class="metrics-panel">
			<div class="metrics-card">
				<p class="label">Working V2 document</p>
				<dl>
					<div>
						<dt>Document version:</dt>
						<dd data-testid="document-version">{drawingDocument.version}</dd>
					</div>
					<div>
						<dt>Base strokes:</dt>
						<dd data-testid="base-stroke-count">{baseStrokeCount}</dd>
					</div>
					<div>
						<dt>Tail strokes:</dt>
						<dd data-testid="tail-stroke-count">{tailStrokeCount}</dd>
					</div>
					<div>
						<dt>Stroke count:</dt>
						<dd data-testid="stroke-count">{strokeCount}</dd>
					</div>
					<div>
						<dt>Total points:</dt>
						<dd data-testid="total-points">{totalPointCount}</dd>
					</div>
					<div>
						<dt>JSON raw bytes:</dt>
						<dd data-testid="json-raw-bytes">{jsonRawBytes}</dd>
					</div>
					<div>
						<dt>JSON gzip bytes:</dt>
						<dd data-testid="json-gzip-bytes">{jsonGzipBytes}</dd>
					</div>
					<div>
						<dt>Original export bytes:</dt>
						<dd data-testid="original-export-bytes">{originalExportBytes}</dd>
					</div>
					<div>
						<dt>Original export format:</dt>
						<dd data-testid="original-export-format">{originalExportFormat}</dd>
					</div>
				</dl>
			</div>

			<div class="metrics-card">
				<p class="label">Experiment results</p>
				<dl>
					<div>
						<dt>Bitmap diff pixels:</dt>
						<dd data-testid="bitmap-diff-pixels">{bitmapDiffPixels ?? 'Pending'}</dd>
					</div>
					<div>
						<dt>Bitmap clone bytes:</dt>
						<dd data-testid="bitmap-clone-bytes">{bitmapCloneBytes ?? 'Pending'}</dd>
					</div>
					<div>
						<dt>Bitmap clone format:</dt>
						<dd data-testid="bitmap-clone-format">{bitmapCloneFormat ?? 'Pending'}</dd>
					</div>
					<div>
						<dt>JSON diff pixels:</dt>
						<dd data-testid="json-diff-pixels">{jsonDiffPixels ?? 'Pending'}</dd>
					</div>
					<div>
						<dt>JSON clone bytes:</dt>
						<dd data-testid="json-clone-bytes">{jsonCloneBytes ?? 'Pending'}</dd>
					</div>
					<div>
						<dt>JSON clone format:</dt>
						<dd data-testid="json-clone-format">{jsonCloneFormat ?? 'Pending'}</dd>
					</div>
				</dl>
			</div>

			<div class="metrics-card">
				<p class="label">Exact raster oracle</p>
				<p class="comparison-note">
					Runs the exact lossless compactor with a safe raster-area preset. Large strokes can skip
					partial compaction without changing the oracle itself; fully hidden strokes can still be
					dropped.
				</p>
				{#if rasterOracleError}
					<p class="load-error" role="alert">{rasterOracleError}</p>
				{/if}
				<dl>
					<div>
						<dt>Selected preset:</dt>
						<dd data-testid="raster-oracle-selected-preset">
							{rasterOracleSelectedPresetLabel ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Max stroke area (px):</dt>
						<dd data-testid="raster-oracle-max-stroke-area">
							{rasterOracleMaxStrokeArea === null && rasterOracleSelectedPresetLabel
								? 'Unlimited'
								: (rasterOracleMaxStrokeArea ?? 'Pending')}
						</dd>
					</div>
					<div>
						<dt>Guarded strokes:</dt>
						<dd data-testid="raster-oracle-guarded-stroke-count">
							{rasterOracleGuardedStrokeCount ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final diff pixels:</dt>
						<dd data-testid="raster-oracle-final-diff-pixels">
							{rasterOracleFinalDiffPixels ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final raw bytes:</dt>
						<dd data-testid="raster-oracle-final-raw-bytes">
							{rasterOracleFinalRawBytes ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final gzip bytes:</dt>
						<dd data-testid="raster-oracle-final-gzip-bytes">
							{rasterOracleFinalGzipBytes ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final strokes:</dt>
						<dd data-testid="raster-oracle-final-stroke-count">
							{rasterOracleFinalStrokeCount ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final points:</dt>
						<dd data-testid="raster-oracle-final-point-count">
							{rasterOracleFinalPointCount ?? 'Pending'}
						</dd>
					</div>
				</dl>
			</div>

			<div class="metrics-card">
				<p class="label">Prod-like pipeline</p>
				<p class="comparison-note">
					Runs the Rust/WASM prod-like pipeline for {PROD_LIKE_PIPELINE_ITERATION_COUNT} chained passes.
					Each pass is compared back to the original baseline drawing, and the raster guard settings match
					the exact oracle controls above.
				</p>
				{#if prodLikePipelineError}
					<p class="load-error" role="alert">{prodLikePipelineError}</p>
				{/if}
				<dl>
					<div>
						<dt>Phase 2 max stroke area (px):</dt>
						<dd data-testid="prod-like-phase2-max-stroke-area">
							{selectedRasterGuardPreset.maxStrokeCoveragePixels === null
								? 'Unlimited'
								: selectedRasterGuardPreset.maxStrokeCoveragePixels}
						</dd>
					</div>
					<div>
						<dt>Final diff pixels:</dt>
						<dd data-testid="prod-like-final-diff-pixels">
							{prodLikeFinalDiffPixels ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final raw bytes:</dt>
						<dd data-testid="prod-like-final-raw-bytes">
							{prodLikeFinalRawBytes ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final gzip bytes:</dt>
						<dd data-testid="prod-like-final-gzip-bytes">
							{prodLikeFinalGzipBytes ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Total runtime (ms):</dt>
						<dd data-testid="prod-like-total-duration-ms">
							{prodLikeTotalDurationMs ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final-pass runtime (ms):</dt>
						<dd data-testid="prod-like-final-duration-ms">
							{prodLikeFinalDurationMs ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final strokes:</dt>
						<dd data-testid="prod-like-final-stroke-count">
							{prodLikeFinalStrokeCount ?? 'Pending'}
						</dd>
					</div>
					<div>
						<dt>Final points:</dt>
						<dd data-testid="prod-like-final-point-count">
							{prodLikeFinalPointCount ?? 'Pending'}
						</dd>
					</div>
				</dl>
				{#if prodLikePipelineIterations.length > 0}
					<div class="comparison-scroll">
						<table class="comparison-table">
							<thead>
								<tr>
									<th scope="col">Pass</th>
									<th scope="col">Time (ms)</th>
									<th scope="col">Strokes</th>
									<th scope="col">Points</th>
									<th scope="col">Raw bytes</th>
									<th scope="col">Gzip bytes</th>
									<th scope="col">Diff pixels</th>
								</tr>
							</thead>
							<tbody>
								{#each prodLikePipelineIterations as iteration (iteration.passNumber)}
									<tr data-testid="prod-like-iteration-row">
										<th scope="row">{iteration.passNumber}</th>
										<td>{iteration.durationMs}</td>
										<td>{iteration.strokeCount}</td>
										<td>{iteration.pointCount}</td>
										<td>{iteration.rawBytes}</td>
										<td>{iteration.gzipBytes}</td>
										<td>{iteration.diffPixels ?? 'Pending'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="metrics-placeholder">
						Run the prod-like pipeline to inspect all chained passes.
					</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="preview-grid">
		<article>
			<h2>Original drawing preview</h2>
			{#if originalPreviewUrl}
				<img src={originalPreviewUrl} alt="Original drawing preview" />
			{:else}
				<p class="placeholder">Draw to capture a baseline preview.</p>
			{/if}
		</article>

		<article>
			<h2>Final bitmap clone preview</h2>
			{#if bitmapClonePreviewUrl}
				<img src={bitmapClonePreviewUrl} alt="Final bitmap clone preview" />
			{:else}
				<p class="placeholder">Run the bitmap clone experiment.</p>
			{/if}
		</article>

		<article>
			<h2>Final JSON clone preview</h2>
			{#if jsonClonePreviewUrl}
				<img src={jsonClonePreviewUrl} alt="Final JSON clone preview" />
			{:else}
				<p class="placeholder">Run the JSON clone experiment.</p>
			{/if}
		</article>

		<article>
			<h2>Raster oracle preview</h2>
			{#if rasterOraclePreviewUrl}
				<img src={rasterOraclePreviewUrl} alt="Raster oracle preview" />
			{:else}
				<p class="placeholder">Run the exact raster oracle.</p>
			{/if}
		</article>

		<article>
			<h2>Prod-like pipeline preview</h2>
			{#if prodLikePreviewUrl}
				<img src={prodLikePreviewUrl} alt="Prod-like pipeline preview" />
			{:else}
				<p class="placeholder">Run the prod-like pipeline analysis.</p>
			{/if}
		</article>
	</div>
</section>

<style>
	:global(body) {
		background:
			radial-gradient(circle at top, rgb(244 219 182 / 0.55), transparent 34%),
			linear-gradient(180deg, #f7f1e2 0%, #e8dcc2 100%);
	}

	.stroke-lab-shell {
		--ink: #241a14;
		--panel: rgb(255 251 242 / 0.84);
		--panel-border: rgb(71 44 27 / 0.16);
		--accent: #8b5e3c;
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 1.2rem 3rem;
		color: var(--ink);
	}

	.hero {
		max-width: 48rem;
		margin-bottom: 1.8rem;
	}

	.eyebrow,
	.label {
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgb(36 26 20 / 0.62);
	}

	h1,
	h2 {
		font-family: 'Iowan Old Style', 'Palatino Linotype', serif;
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	h1 {
		font-size: clamp(2.6rem, 7vw, 4.8rem);
		line-height: 0.94;
		margin: 0.2rem 0 0.6rem;
	}

	.lede {
		max-width: 44rem;
		font-size: 1rem;
		line-height: 1.6;
		color: rgb(36 26 20 / 0.74);
	}

	.lab-grid {
		display: grid;
		gap: 1.25rem;
		grid-template-columns: minmax(0, 1.45fr) minmax(19rem, 0.7fr);
	}

	.canvas-panel,
	.metrics-card {
		background: var(--panel);
		border: 1px solid var(--panel-border);
		border-radius: 1.4rem;
		box-shadow: 0 20px 45px rgb(78 52 31 / 0.08);
		backdrop-filter: blur(18px);
	}

	.canvas-panel {
		padding: 1rem;
	}

	.panel-header,
	.header-actions,
	.experiment-actions,
	.comparison-controls,
	.palette {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
	}

	.segmented {
		display: inline-flex;
		padding: 0.25rem;
		border-radius: 999px;
		background: rgb(36 26 20 / 0.08);
	}

	.segmented button,
	.experiment-actions button,
	.comparison-controls button,
	.clear-button,
	select {
		border: 0;
		border-radius: 999px;
		padding: 0.7rem 1rem;
		font: inherit;
		color: var(--ink);
	}

	.segmented button,
	.clear-button,
	select {
		background: rgb(255 255 255 / 0.72);
	}

	.segmented button.drawing-active {
		background: #241a14;
		color: #fff7ea;
	}

	.palette {
		justify-content: flex-start;
		margin: 1rem 0;
	}

	.palette button {
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		border: 2px solid rgb(36 26 20 / 0.15);
		background: var(--swatch);
		padding: 0;
	}

	.palette button.color-active {
		box-shadow: 0 0 0 3px rgb(36 26 20 / 0.16);
		transform: scale(1.06);
	}

	.canvas-frame {
		border-radius: 1.2rem;
		padding: 0.8rem;
		background:
			linear-gradient(160deg, rgb(255 255 255 / 0.76), rgb(235 224 205 / 0.72)),
			repeating-linear-gradient(
				135deg,
				rgb(97 63 38 / 0.03) 0,
				rgb(97 63 38 / 0.03) 10px,
				transparent 10px,
				transparent 20px
			);
	}

	canvas {
		display: block;
		width: min(100%, 44rem);
		aspect-ratio: 1;
		margin: 0 auto;
		border-radius: 1rem;
		border: 1px solid rgb(36 26 20 / 0.18);
		background: #fffdf8;
		cursor: crosshair;
	}

	.experiment-actions {
		justify-content: flex-start;
		margin-top: 1rem;
	}

	.comparison-controls {
		justify-content: flex-start;
		margin-top: 0.9rem;
	}

	.payload-field {
		width: min(100%, 34rem);
	}

	.payload-field textarea {
		width: 100%;
		min-height: 8rem;
		padding: 0.9rem 1rem;
		border: 1px solid rgb(36 26 20 / 0.14);
		border-radius: 1rem;
		background: rgb(255 255 255 / 0.78);
		font: inherit;
		line-height: 1.45;
		color: var(--ink);
		resize: vertical;
	}

	.load-error {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 1rem;
		background: rgb(200 79 79 / 0.12);
		color: #7b2424;
		font-size: 0.94rem;
		line-height: 1.45;
	}

	.experiment-actions button {
		background: linear-gradient(180deg, #6f492f, #4f3424);
		color: #fff7eb;
		box-shadow: 0 12px 20px rgb(79 52 36 / 0.14);
	}

	.comparison-controls button {
		background: linear-gradient(180deg, #8b5e3c, #6f492f);
		color: #fff7eb;
		box-shadow: 0 12px 20px rgb(79 52 36 / 0.12);
	}

	.comparison-controls label {
		display: grid;
		gap: 0.35rem;
	}

	.experiment-actions button:disabled,
	.clear-button:disabled {
		opacity: 0.6;
	}

	.metrics-panel {
		display: grid;
		gap: 1rem;
	}

	.metrics-card {
		padding: 1rem 1.1rem;
	}

	.comparison-note {
		margin: 0.55rem 0 0;
		font-size: 0.92rem;
		line-height: 1.5;
		color: rgb(36 26 20 / 0.68);
	}

	dl {
		margin: 0.8rem 0 0;
		display: grid;
		gap: 0.75rem;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.96rem;
	}

	dt {
		color: rgb(36 26 20 / 0.62);
	}

	dd {
		margin: 0;
		font-weight: 700;
	}

	.comparison-scroll {
		margin-top: 0.85rem;
		overflow-x: auto;
	}

	.comparison-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}

	.comparison-table th,
	.comparison-table td {
		padding: 0.7rem 0.5rem;
		border-bottom: 1px solid rgb(36 26 20 / 0.08);
		text-align: left;
		white-space: nowrap;
	}

	.comparison-table thead th {
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgb(36 26 20 / 0.56);
	}

	.metrics-placeholder {
		margin: 0.8rem 0 0;
		padding: 0.9rem 1rem;
		border: 1px solid rgb(36 26 20 / 0.08);
		border-radius: 0.9rem;
		background: rgb(255 255 255 / 0.5);
		color: rgb(36 26 20 / 0.58);
	}

	.preview-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		margin-top: 1.4rem;
	}

	.preview-grid article {
		background: var(--panel);
		border: 1px solid var(--panel-border);
		border-radius: 1.2rem;
		padding: 1rem;
		min-height: 18rem;
	}

	.preview-grid img,
	.placeholder {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 0.9rem;
		border: 1px solid rgb(36 26 20 / 0.12);
		background: rgb(255 255 255 / 0.62);
	}

	.preview-grid img {
		object-fit: contain;
	}

	.placeholder {
		display: grid;
		place-items: center;
		padding: 1rem;
		text-align: center;
		color: rgb(36 26 20 / 0.58);
	}

	@media (max-width: 980px) {
		.lab-grid,
		.preview-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
