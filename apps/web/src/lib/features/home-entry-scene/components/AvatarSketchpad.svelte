<script lang="ts">
	import { onMount } from 'svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';

	const palette = ['#ff6b6b', '#4ecdc4', '#d4af37', '#7c6fbd', '#2d2a26', '#ffffff'];
	const brushSizes = [4, 8, 14];

	const CANVAS_WIDTH = 520;
	const CANVAS_HEIGHT = 320;
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
	let brushSize = $state(brushSizes[1]);
	let isDrawing = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');

	const drawGhostSilhouette = (ctx: CanvasRenderingContext2D) => {
		ctx.save();
		ctx.globalAlpha = 0.15;
		ctx.strokeStyle = '#2d2a26';
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);

		const centerX = CANVAS_WIDTH / 2;
		const centerY = CANVAS_HEIGHT / 2 - 16;

		ctx.beginPath();
		ctx.arc(centerX, centerY - 20, 40, 0, Math.PI * 2);
		ctx.stroke();

		const shoulderWidth = 112;
		const shoulderHeight = 48;
		const shoulderX = centerX - shoulderWidth / 2;
		const shoulderY = centerY + 28;
		const cornerRadius = 24;

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
		ctx.lineTo(shoulderX + shoulderWidth, shoulderY + shoulderHeight - 14);
		ctx.arcTo(
			shoulderX + shoulderWidth,
			shoulderY + shoulderHeight,
			shoulderX + shoulderWidth - 14,
			shoulderY + shoulderHeight,
			14
		);
		ctx.lineTo(shoulderX + 14, shoulderY + shoulderHeight);
		ctx.arcTo(
			shoulderX,
			shoulderY + shoulderHeight,
			shoulderX,
			shoulderY + shoulderHeight - 14,
			14
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

	const draw = (event: MouseEvent | TouchEvent) => {
		if (!isDrawing || !canvasElement) return;

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
		paintBackground();
	});
</script>

<div class="space-y-5">
	<div class="space-y-2 text-center">
		<p class="text-xs font-semibold tracking-[0.22em] text-[#8d6c52] uppercase">Step 2 of 2</p>
		<p class="text-sm text-[#5a554d]">Your first piece in the gallery is a quick self-portrait.</p>
	</div>

	{#if saveError}
		<div
			class="rounded-[1rem] border-2 border-[#9c432b] bg-[#f7e1d7] px-4 py-3 text-sm text-[#6f2413]"
		>
			{saveError}
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-[auto_1fr]">
		<div class="order-2 flex gap-3 md:order-1 md:flex-col">
			{#each palette as color (color)}
				<button
					type="button"
					class={`h-10 w-10 rounded-xl border-2 ${activeColor === color ? 'border-[#2d2a26] shadow-[0_0_0_3px_rgba(45,42,38,0.18)]' : 'border-[#bdaa93]'}`}
					style={`background:${color};`}
					onclick={() => {
						activeColor = color;
					}}
					aria-label={`Select color ${color}`}
				></button>
			{/each}

			<div class="hidden h-px bg-[#d8c9b5] md:block"></div>

			<div class="flex gap-2 md:flex-col">
				{#each brushSizes as size (size)}
					<button
						type="button"
						class={`flex h-10 w-10 items-center justify-center rounded-xl border-2 ${brushSize === size ? 'border-[#2d2a26] bg-[#2d2a26] text-[#f5f0e1]' : 'border-[#bdaa93] bg-white text-[#5a554d]'}`}
						onclick={() => {
							brushSize = size;
						}}
						aria-label={`Select brush size ${size}`}
					>
						<div
							class="rounded-full bg-current"
							style={`width:${size}px;height:${size}px;`}
							aria-hidden="true"
						></div>
					</button>
				{/each}
			</div>
		</div>

		<div class="order-1 space-y-4 md:order-2">
			<div
				class="rounded-[1.4rem] border-2 border-[#2d2a26] bg-[#fffdf8] p-3 shadow-[6px_6px_0_rgba(45,42,38,0.14)]"
			>
				<div class="relative overflow-hidden rounded-[1rem] border-2 border-[#c9b89f] bg-[#f5f0e1]">
					<div
						class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_48%)]"
					></div>
					<div
						class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,transparent,rgba(45,42,38,0.06))]"
					></div>
					<canvas
						bind:this={canvasElement}
						width={CANVAS_WIDTH}
						height={CANVAS_HEIGHT}
						class="relative z-[1] h-[320px] w-full cursor-crosshair touch-none"
						onmousedown={startDrawing}
						onmousemove={draw}
						onmouseup={stopDrawing}
						onmouseleave={stopDrawing}
						ontouchstart={handleTouchStart}
						ontouchmove={handleTouchMove}
						ontouchend={handleTouchEnd}
					></canvas>
				</div>
			</div>

			<div class="flex flex-col gap-3 md:flex-row md:items-end">
				<label class="block flex-1 space-y-2">
					<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
						>Nickname</span
					>
					<input
						type="text"
						value={nickname}
						readonly
						class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-white/90 px-4 py-3 text-base text-[#2d2a26]"
					/>
				</label>

				<div class="flex gap-3">
					<button
						type="button"
						class="rounded-[1rem] border-2 border-[#c8af95] bg-white px-4 py-3 text-sm font-semibold text-[#5a554d]"
						onclick={() => {
							saveError = '';
							paintBackground();
						}}
						disabled={isSaving}
					>
						Clear
					</button>
					<GameButton
						onclick={handleEnterGallery}
						disabled={isSaving}
						className="gap-3 px-6 py-3 text-sm font-black"
					>
						<span>{isSaving ? 'Saving...' : 'Enter the gallery'}</span>
					</GameButton>
				</div>
			</div>
		</div>
	</div>
</div>
