<script lang="ts">
	import { deserialize } from '$app/forms';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import type {
		DrawForkParent,
		DrawPageUser,
		DrawPublishActionData,
		DrawPublishedArtwork
	} from '$lib/features/studio-drawing/publish-contract';
	import { exportArtworkFile } from '$lib/features/studio-drawing/canvas-export';
	import DrawingBookStage from '$lib/features/studio-drawing/components/DrawingBookStage.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import DrawingCanvas from '$lib/features/studio-drawing/components/DrawingCanvas.svelte';
	import DrawingToolTray from '$lib/features/studio-drawing/tools/DrawingToolTray.svelte';

	let {
		checkTextContent = defaultCheckTextContent,
		createArtworkFile = exportArtworkFile,
		forkParent = null,
		openingDurationMs = 950,
		publishDrawing = async (
			file: File,
			options: { isNsfw: boolean; parentArtworkId?: string | null; title: string }
		): Promise<DrawPublishActionData> => {
			const formData = new FormData();
			formData.set('isNsfw', String(options.isNsfw));
			formData.set('media', file);
			formData.set('title', options.title);
			if (options.parentArtworkId) {
				formData.set('parentArtworkId', options.parentArtworkId);
			}

			const response = await fetch('?/publish', {
				body: formData,
				headers: {
					'x-sveltekit-action': 'true'
				},
				method: 'POST'
			});
			const result = deserialize(await response.text());

			if ((result.type === 'success' || result.type === 'failure') && result.data) {
				return result.data as DrawPublishActionData;
			}

			return { message: 'Artwork publish failed' };
		},
		user
	}: {
		checkTextContent?: TextContentChecker;
		createArtworkFile?: (canvas: HTMLCanvasElement) => Promise<File | null>;
		forkParent?: DrawForkParent | null;
		openingDurationMs?: number;
		publishDrawing?: (
			file: File,
			options: { isNsfw: boolean; parentArtworkId?: string | null; title: string }
		) => Promise<DrawPublishActionData>;
		user?: DrawPageUser;
	} = $props();

	let canvasRef = $state<HTMLCanvasElement | null>(null);
	let clearVersion = $state(0);
	let forkPreloadSettled = $state(true);
	let isPublishing = $state(false);
	let pendingStudioUnlock = $state(false);
	let publishedArtwork = $state<DrawPublishedArtwork | null>(null);
	let sceneState = $state<'closed' | 'opening' | 'open'>('closed');
	let statusMessage = $state('');
	let statusTone = $state<'error' | 'success' | 'idle'>('idle');
	let artworkTitle = $state('');
	let isArtworkNsfw = $state(false);
	let titleError = $state('');

	let studioUnlocked = $derived(sceneState === 'open');
	let toolsVisible = $derived(sceneState !== 'closed');
	let hasForkParent = $derived(Boolean(forkParent?.mediaUrl));

	$effect(() => {
		forkPreloadSettled = !hasForkParent;
		pendingStudioUnlock = false;

		if (hasForkParent && sceneState === 'closed') {
			sceneState = 'opening';
		}
	});

	const clearCanvas = () => {
		if (!studioUnlocked) return;
		clearVersion += 1;
		publishedArtwork = null;
		statusMessage = '';
		statusTone = 'idle';
	};

	const startOpeningBook = () => {
		if (sceneState !== 'closed') return;
		sceneState = 'opening';
	};

	const completeStudioUnlock = () => {
		sceneState = 'open';
		pendingStudioUnlock = false;
	};

	const markForkPreloadSettled = () => {
		if (forkPreloadSettled) return;
		forkPreloadSettled = true;

		if (pendingStudioUnlock && sceneState === 'opening') {
			completeStudioUnlock();
		}
	};

	const unlockStudio = () => {
		if (sceneState !== 'opening') return;

		if (!forkPreloadSettled) {
			pendingStudioUnlock = true;
			return;
		}

		completeStudioUnlock();
	};

	const publishArtwork = async () => {
		if (!canvasRef || isPublishing || !studioUnlocked) return;

		artworkTitle = artworkTitle.trim();
		if (!artworkTitle) {
			titleError = 'Title is required before publishing';
			statusMessage = '';
			statusTone = 'idle';
			return;
		}

		publishedArtwork = null;
		statusMessage = '';
		statusTone = 'idle';
		titleError = '';
		isPublishing = true;

		try {
			const titleModeration = await checkTextContent(artworkTitle, 'artwork_title');
			if (titleModeration.status !== 'allowed') {
				titleError = titleModeration.message;
				statusMessage = '';
				statusTone = 'idle';
				return;
			}

			const file = await createArtworkFile(canvasRef);
			if (!file) {
				statusMessage = 'This browser could not export your drawing. Please try again.';
				statusTone = 'error';
				return;
			}

			const result = await publishDrawing(file, {
				isNsfw: isArtworkNsfw,
				parentArtworkId: forkParent?.id ?? null,
				title: artworkTitle
			});
			if ('success' in result && result.success) {
				publishedArtwork = result.artwork;
				statusMessage = `Artwork published as ${result.artwork.title}`;
				statusTone = 'success';
				return;
			}

			statusMessage = result.message;
			statusTone = 'error';
		} catch (error) {
			statusMessage = error instanceof Error ? error.message : 'Artwork publish failed';
			statusTone = 'error';
		} finally {
			isPublishing = false;
		}
	};
</script>

<div class="relative flex h-dvh flex-col overflow-hidden bg-[#f4ecde]">
	<div class="pointer-events-none absolute inset-0">
		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,248,235,0.95),_transparent_40%),linear-gradient(180deg,_rgba(255,251,244,0.45),_rgba(214,188,149,0.2)_55%,_rgba(116,87,55,0.08))]"
		></div>
		<div
			class="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,_rgba(255,255,255,0.4),_transparent)]"
		></div>
		<div
			class="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,_transparent,_rgba(111,79,48,0.12))]"
		></div>
	</div>

	<header
		class="relative z-30 flex flex-shrink-0 items-start justify-between gap-4 px-4 pt-4 sm:px-6"
	>
		<GameLink href="/" variant="secondary" size="md" className="-rotate-1 shadow-lg">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
			>
			<span>Exit Studio</span>
		</GameLink>

		{#if user}
			<div
				class="rounded-xl border-3 border-[#2d2420] bg-[#fdfbf7]/90 px-3 py-2 text-sm text-[#2d2420] shadow-lg backdrop-blur-sm"
			>
				Signed in as <span class="font-bold">{user.nickname}</span>
			</div>
		{/if}
	</header>

	<main
		class="relative z-10 mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 pt-3 pb-4 sm:px-6"
	>
		<div
			class="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(13rem,15rem)]"
		>
			<div class="order-1 flex min-h-0 flex-col">
				<div class="studio-book-frame">
					<DrawingBookStage
						stageState={sceneState}
						onOpenRequest={startOpeningBook}
						onOpened={unlockStudio}
						{openingDurationMs}
					>
						{#snippet coverBack()}
							<div class="flex h-full flex-col justify-between gap-3 text-[#d4c4ae]">
								<div>
									<p
										class="text-[0.6rem] font-bold tracking-[0.25em] uppercase"
										style="color: rgb(212 196 174 / 0.6);"
									>
										{forkParent ? 'Fork Details' : 'Artwork Details'}
									</p>
									{#if forkParent}
										<p class="mt-1.5 text-xs" style="color: rgb(212 196 174 / 0.7);">
											Forking from <span class="font-semibold text-[#e8d5be]"
												>{forkParent.title}</span
											>
										</p>
									{/if}
								</div>

								<div class="space-y-2.5">
									<label class="block space-y-1">
										<span
											class="text-[0.55rem] font-bold tracking-[0.2em] uppercase"
											style="color: rgb(212 196 174 / 0.5);">Title</span
										>
										<input
											bind:value={artworkTitle}
											type="text"
											maxlength="80"
											placeholder="Give your piece a title"
											disabled={!studioUnlocked}
											class="w-full rounded-lg border border-[#6b4f38] bg-[#4a3020]/60 px-2.5 py-1.5 text-sm text-[#f0e4d4] placeholder-[#8a7460] transition outline-none focus:border-[#c49a6c] disabled:opacity-50"
										/>
									</label>
									<button
										type="button"
										role="checkbox"
										aria-checked={isArtworkNsfw}
										disabled={!studioUnlocked}
										onclick={() => {
											if (studioUnlocked) isArtworkNsfw = !isArtworkNsfw;
										}}
										class="nsfw-toggle group flex w-full items-center gap-2.5 rounded-lg border border-[#6b4f38] bg-[#4a3020]/60 px-2.5 py-1.5 text-left text-xs text-[#d4c4ae] transition disabled:opacity-50"
									>
										<span
											class="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200"
											style={`background: ${isArtworkNsfw ? '#c84f4f' : '#6b4f38'};`}
										>
											<span
												class="inline-block h-4 w-4 translate-y-0.5 rounded-full bg-[#f0e4d4] shadow-sm transition-transform duration-200"
												style={`transform: translateX(${isArtworkNsfw ? '1.1rem' : '0.2rem'}) translateY(0.1rem);`}
											></span>
										</span>
										<span class={isArtworkNsfw ? 'font-semibold text-[#e8805a]' : ''}>NSFW</span>
									</button>
									{#if titleError}
										<p class="text-xs text-[#e8805a]">{titleError}</p>
									{/if}
								</div>

								<div
									class="mt-auto border-t border-[#6b4f38]/40 pt-1.5 text-[0.55rem]"
									style="color: rgb(212 196 174 / 0.35);"
								>
									Inside cover · Not the Louvre
								</div>
							</div>
						{/snippet}
						<DrawingCanvas
							bind:canvasRef
							{clearVersion}
							initialImageUrl={forkParent?.mediaUrl ?? null}
							interactive={studioUnlocked}
							onInitialImageSettled={markForkPreloadSettled}
							{statusMessage}
							{statusTone}
						/>
					</DrawingBookStage>
				</div>

				{#if publishedArtwork}
					<div
						class="mt-2 rounded-2xl border-3 border-[#2d2420]/30 bg-[#fdfbf7]/90 px-4 py-2.5 shadow-lg backdrop-blur-sm"
						style="animation: studioPanelReveal 280ms ease-out both;"
					>
						<p class="text-xs font-semibold tracking-[0.18em] text-[#8b9d91] uppercase">
							Artwork published
						</p>
						<h2 class="mt-0.5 text-base font-black text-[#2d2420]">{publishedArtwork.title}</h2>
						<p class="text-xs text-[#6b625a]">Artwork id: {publishedArtwork.id}</p>
						<div class="mt-1.5 flex flex-wrap gap-2">
							<GameButton type="button" variant="accent" size="sm" onclick={clearCanvas}>
								<span>Draw again</span>
							</GameButton>
							<GameLink href="/gallery" variant="secondary" size="sm">
								<span>Open gallery</span>
							</GameLink>
						</div>
					</div>
				{/if}

				{#if !studioUnlocked}
					<div
						class="mx-auto mt-2 max-w-xl rounded-full border border-[#8c6a50]/30 bg-[#fff9f0]/80 px-4 py-2 text-center text-xs text-[#6f5645] shadow-lg backdrop-blur-sm"
						style="font-family: 'Baloo 2', sans-serif;"
					>
						{sceneState === 'closed'
							? 'Open the sketchbook cover to start drawing.'
							: 'The page is opening...'}
					</div>
				{/if}
			</div>

			<div
				class={`tools-stage order-2 ${toolsVisible ? 'tools-stage-open' : 'tools-stage-hidden'}`}
				aria-hidden={!studioUnlocked}
				inert={!studioUnlocked}
			>
				<DrawingToolTray {isPublishing} onPublish={publishArtwork} onClear={clearCanvas} />
			</div>
		</div>
	</main>
</div>

<style>
	.studio-book-frame {
		height: clamp(29rem, 78vh, 56rem);
		flex: 0 0 auto;
	}

	.tools-stage {
		width: min(100%, 15rem);
		transform-origin: left center;
		will-change: opacity, transform;
	}

	.tools-stage-hidden {
		opacity: 0;
		pointer-events: none;
		transform: translateX(10rem) rotate(10deg) scale(0.94);
	}

	.tools-stage-open {
		opacity: 1;
		animation: toolTrayCrashIn 210ms cubic-bezier(0.2, 0.9, 0.24, 1.12) both;
	}

	@keyframes studioPanelReveal {
		from {
			opacity: 0;
			transform: translateY(14px);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes toolTrayCrashIn {
		0% {
			opacity: 0;
			transform: translateX(10rem) rotate(10deg) scale(0.94);
		}

		68% {
			opacity: 1;
			transform: translateX(-0.85rem) rotate(-2.5deg) scale(1.02);
		}

		100% {
			opacity: 1;
			transform: translateX(0) rotate(0deg) scale(1);
		}
	}

	@media (max-width: 1279px) {
		.studio-book-frame {
			height: clamp(27rem, 74vh, 52rem);
		}

		.tools-stage {
			width: min(100%, 14rem);
		}
	}

	@media (max-width: 700px) {
		.studio-book-frame {
			height: clamp(24rem, 68vh, 48rem);
		}

		.tools-stage-hidden {
			transform: translateY(1.5rem) scale(0.97);
		}

		@keyframes toolTrayCrashIn {
			0% {
				opacity: 0;
				transform: translateY(1.5rem) scale(0.97);
			}

			68% {
				opacity: 1;
				transform: translateY(-0.35rem) scale(1.01);
			}

			100% {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
	}
</style>
