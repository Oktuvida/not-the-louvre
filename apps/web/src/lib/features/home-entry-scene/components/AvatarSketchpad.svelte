<script lang="ts">
	import { onMount } from 'svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';

	const palette = [
		'#F4EBDD',
		'#DCC9A3',
		'#B78C5A',
		'#6B4A2E',
		'#2B2622',
		'#C79A2B',
		'#A5562A',
		'#C96A4A',
		'#B9322E',
		'#B97A74',
		'#2F4B9A',
		'#2E6F7E',
		'#667A3E',
		'#8FA27A',
		'#2D7A63',
		'#8C7AAE',
		'#5E3A57',
		'#A9862A'
	];
	const BRUSH_SIZES = [1, 2, 4, 6, 8, 10, 12, 14, 18, 24, 32, 42];
	const BRUSH_PREVIEW_SIZE = Math.max(...BRUSH_SIZES) + 6;

	const CANVAS_WIDTH = 340;
	const CANVAS_HEIGHT = 340;
	const EXPORT_SIZE = 256;

	type AvatarSaveResult =
		| { success: true }
		| {
				code?: string;
				message: string;
				success: false;
		  };

	let {
		createAvatarFile = async (sourceCanvas: HTMLCanvasElement) => {
			const exportCanvas = document.createElement('canvas');
			exportCanvas.width = EXPORT_SIZE;
			exportCanvas.height = EXPORT_SIZE;

			const exportContext = exportCanvas.getContext('2d');
			if (!exportContext) {
				throw new Error('Canvas 2D context is unavailable for avatar export.');
			}

			exportContext.fillStyle = '#f5f0e1';
			exportContext.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
			exportContext.drawImage(sourceCanvas, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

			const blob = await new Promise<Blob | null>((resolve) => {
				exportCanvas.toBlob((nextBlob) => resolve(nextBlob), 'image/webp', 0.68);
			});

			if (!blob) {
				throw new Error('Canvas export returned no blob for image/webp output.');
			}

			if (blob.type !== 'image/webp') {
				throw new Error(`Canvas export returned unexpected blob type: ${blob.type || 'unknown'}.`);
			}

			return new File([blob], 'avatar.webp', { type: 'image/webp' });
		},
		nickname,
		onContinue,
		saveAvatar = async () => ({
			message: 'Avatar save is unavailable right now.',
			success: false as const
		})
	}: {
		createAvatarFile?: (sourceCanvas: HTMLCanvasElement) => Promise<File | null>;
		nickname: string;
		onContinue?: () => void;
		saveAvatar?: (file: File) => Promise<AvatarSaveResult>;
	} = $props();

	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let activeColor = $state(palette[0]);
	let brushStep = $state(Math.floor((BRUSH_SIZES.length - 1) / 2));
	let isDrawing = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');

	const brushSize = $derived(BRUSH_SIZES[brushStep] ?? BRUSH_SIZES[BRUSH_SIZES.length - 1]);
	const brushPreviewDiameter = $derived(Math.max(4, brushSize + 2));

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

	const paintBackground = () => {
		if (!canvasElement) return;
		const context = canvasElement.getContext('2d');
		if (!context) return;

		context.fillStyle = '#f5f0e1';
		context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		drawGhostSilhouette(context);
	};

	const getPoint = (event: MouseEvent | TouchEvent) => {
		if (!canvasElement) return null;

		const rect = canvasElement.getBoundingClientRect();
		const scaleX = canvasElement.width / rect.width;
		const scaleY = canvasElement.height / rect.height;

		let clientX: number;
		let clientY: number;

		if ('touches' in event) {
			const touch = event.touches[0] ?? event.changedTouches[0];
			if (!touch) return null;
			clientX = touch.clientX;
			clientY = touch.clientY;
		} else {
			clientX = event.clientX;
			clientY = event.clientY;
		}

		return {
			x: (clientX - rect.left) * scaleX,
			y: (clientY - rect.top) * scaleY
		};
	};

	const startDrawing = (event: MouseEvent | TouchEvent) => {
		const point = getPoint(event);
		if (!point || !canvasElement) return;

		const context = canvasElement.getContext('2d');
		if (!context) return;

		context.beginPath();
		context.moveTo(point.x, point.y);
		isDrawing = true;
	};

	const continueDrawingFromEntry = (event: MouseEvent) => {
		if (!isDrawing || (event.buttons & 1) === 0 || !canvasElement) return;

		const point = getPoint(event);
		if (!point) return;

		const context = canvasElement.getContext('2d');
		if (!context) return;

		context.beginPath();
		context.moveTo(point.x, point.y);
	};

	const draw = (event: MouseEvent | TouchEvent) => {
		if (!isDrawing || !canvasElement) return;

		if (event instanceof MouseEvent && (event.buttons & 1) === 0) {
			stopDrawing();
			return;
		}

		const point = getPoint(event);
		if (!point) return;

		const context = canvasElement.getContext('2d');
		if (!context) return;

		context.lineTo(point.x, point.y);
		context.strokeStyle = activeColor;
		context.lineWidth = brushSize;
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.stroke();
	};

	const stopDrawing = () => {
		isDrawing = false;
	};

	const handleEnterGallery = async () => {
		if (isSaving || !canvasElement) return;

		saveError = '';
		isSaving = true;

		try {
			let avatarFile: File | null;

			try {
				avatarFile = await createAvatarFile(canvasElement);
			} catch (error) {
				console.error('Failed to create avatar file', error);
				saveError = 'This browser could not export your avatar. Please try again.';
				return;
			}

			if (!avatarFile) {
				console.error(
					'Failed to create avatar file',
					new Error('createAvatarFile returned no file')
				);
				saveError = 'This browser could not export your avatar. Please try again.';
				return;
			}

			const result = await saveAvatar(avatarFile);
			if (!result.success) {
				saveError = result.message;
				return;
			}

			onContinue?.();
		} finally {
			isSaving = false;
		}
	};

	const handleTouchStart = (event: TouchEvent) => {
		event.preventDefault();
		startDrawing(event);
	};

	const handleTouchMove = (event: TouchEvent) => {
		event.preventDefault();
		draw(event);
	};

	const handleTouchEnd = (event: TouchEvent) => {
		event.preventDefault();
		stopDrawing();
	};

	onMount(() => {
		const handleWindowMouseUp = () => {
			stopDrawing();
		};

		const handleWindowTouchEnd = () => {
			stopDrawing();
		};

		window.addEventListener('mouseup', handleWindowMouseUp);
		window.addEventListener('touchend', handleWindowTouchEnd);
		paintBackground();

		return () => {
			window.removeEventListener('mouseup', handleWindowMouseUp);
			window.removeEventListener('touchend', handleWindowTouchEnd);
		};
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
					class="flex flex-col items-center justify-between rounded-[1rem] border border-[rgb(107_74_46_/_0.15)] bg-[rgb(255_255_255_/_0.32)] px-2 py-3"
				>
					<p
						class="font-display text-[0.62rem] font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase md:rotate-180 md:[writing-mode:vertical-rl]"
					>
						Brush
					</p>
					<div class="flex flex-1 items-center justify-center py-2">
						<input
							bind:value={brushStep}
							type="range"
							min="0"
							max={(BRUSH_SIZES.length - 1).toString()}
							step="1"
							class="brush-slider h-8 w-24 -rotate-90 cursor-pointer appearance-none md:w-60"
							aria-label="Brush size"
						/>
					</div>
					<div
						class="flex items-center justify-center"
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

				<div class="grid h-full grid-cols-2 content-start gap-2">
					{#each palette as color (color)}
						<button
							type="button"
							class={`h-10 w-10 rounded-xl border-2 ${activeColor === color ? 'border-[var(--color-ink)] shadow-[0_0_0_3px_rgb(47_36_28_/_0.18)]' : 'border-[var(--color-accent)]'}`}
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
				class="mx-auto aspect-square w-full max-w-[27rem] rounded-[1.25rem] border-2 border-[var(--color-ink)] bg-[var(--color-paper)] p-2.5 shadow-[6px_6px_0_rgb(47_36_28_/_0.14)]"
			>
				<div
					class="relative h-full w-full overflow-hidden rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)]"
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
						onmousedown={startDrawing}
						onmouseenter={continueDrawingFromEntry}
						onmousemove={draw}
						onmouseup={stopDrawing}
						ontouchstart={handleTouchStart}
						ontouchmove={handleTouchMove}
						ontouchend={handleTouchEnd}
					></canvas>
				</div>
			</div>

			<div class="flex flex-col gap-3 sm:flex-row">
				<div class="flex gap-3 sm:ml-auto">
					<GameButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full sm:w-auto"
						onclick={() => {
							saveError = '';
							paintBackground();
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
						<span>{isSaving ? 'Saving...' : 'Enter the gallery'}</span>
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
