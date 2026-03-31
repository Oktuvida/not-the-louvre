<script lang="ts">
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { gsap } from 'gsap';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import type {
		DrawForkParent,
		DrawPublishActionData,
		DrawPublishedArtwork
	} from '$lib/features/studio-drawing/publish-contract';
	import { exportArtworkFile } from '$lib/features/studio-drawing/canvas-export';
	import DrawingBookStage from '$lib/features/studio-drawing/components/DrawingBookStage.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import AmbientParticleOverlay from '$lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
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
		}
	}: {
		checkTextContent?: TextContentChecker;
		createArtworkFile?: (canvas: HTMLCanvasElement) => Promise<File | null>;
		forkParent?: DrawForkParent | null;
		openingDurationMs?: number;
		publishDrawing?: (
			file: File,
			options: { isNsfw: boolean; parentArtworkId?: string | null; title: string }
		) => Promise<DrawPublishActionData>;
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
	let isExitingToHome = $state(false);
	let showExitFade = $state(false);
	let exitFadeOpacity = $state(0);

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
	const handleBackToHome = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		if (isExitingToHome) return;
		isExitingToHome = true;
		showExitFade = true;

		const fade = { opacity: 0 };
		gsap.to(fade, {
			opacity: 1,
			duration: 0.5,
			ease: 'power2.in',
			onUpdate: () => {
				exitFadeOpacity = fade.opacity;
			},
			onComplete: () => {
				const url = `${resolve('/')}?from=studio`;
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- URL is already resolved above
				void goto(url);
			}
		});
	};
</script>

<div
	class="studio-page relative flex h-dvh flex-col overflow-hidden"
	data-book-state={sceneState}
>
	<picture class="pointer-events-none absolute inset-0 z-0">
		<source type="image/avif" srcset="/table.avif" />
		<img
			src="/table.webp"
			alt=""
			class="h-full w-full scale-[1.4] object-cover object-[center_115%]"
			loading="eager"
			decoding="async"
		/>
	</picture>

	<AmbientParticleOverlay className="z-[5] opacity-90" />

	<header
		class="relative z-30 flex flex-shrink-0 items-start justify-between gap-4 px-4 pt-4 sm:px-6"
	>
		<div onclickcapture={handleBackToHome}>
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
		</div>
	</header>

	<main
		class="relative z-10 mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 pt-3 pb-4 sm:px-6"
	>
		<div
			class="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)]"
		>
			<div class="order-1 flex min-h-0 flex-col">
				<div class="studio-book-frame">
				<DrawingBookStage
					stageState={sceneState}
					onOpenRequest={startOpeningBook}
					onOpened={unlockStudio}
					{openingDurationMs}
				>
					{#snippet coverFields()}
						<div class="cover-postit cover-postit-title">
							<div class="postit-tape" aria-hidden="true"></div>
							<p class="postit-label">Title your masterpiece</p>
							{#if forkParent}
								<p class="postit-fork-note">
									Forking <span class="postit-fork-name">{forkParent.title}</span>
								</p>
							{/if}
							<input
								bind:value={artworkTitle}
								type="text"
								maxlength="80"
								placeholder="Untitled genius"
								disabled={!studioUnlocked}
								class="postit-input"
							/>
							{#if titleError}
								<p class="postit-error">{titleError}</p>
							{/if}
						</div>

						<div class="cover-postit cover-postit-nsfw">
							<div class="postit-tape" aria-hidden="true"></div>
							<button
								type="button"
								role="checkbox"
								aria-checked={isArtworkNsfw}
								disabled={!studioUnlocked}
								onclick={() => {
									if (studioUnlocked) isArtworkNsfw = !isArtworkNsfw;
								}}
								class="postit-nsfw-btn"
							>
								<span
									class="nsfw-track"
									style={`background: ${isArtworkNsfw ? '#c84f4f' : 'rgb(60 50 40 / 0.15)'};`}
								>
								<span
									class="nsfw-dot"
									style={`transform: translateX(${isArtworkNsfw ? '13px' : '2px'}) translateY(2px);`}
								></span>
								</span>
								<span class={isArtworkNsfw ? 'font-semibold text-[#c84f4f]' : ''}
									>Not safe for the Louvre</span
								>
							</button>
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
			</div>

			<div
				class={`tools-stage order-2 ${toolsVisible ? 'tools-stage-open' : 'tools-stage-hidden'}`}
				aria-hidden={!studioUnlocked}
				inert={!studioUnlocked}
			>
				<DrawingToolTray {isPublishing} onPublish={publishArtwork} onClear={clearCanvas} />

				{#if publishedArtwork}
					<div class="publish-postit" style="animation: studioPanelReveal 280ms ease-out both;">
						<div class="postit-tape" aria-hidden="true"></div>
						<p class="postit-label">Hung on the wall!</p>
						<h2 class="publish-postit-title">{publishedArtwork.title}</h2>
						<!-- <p class="publish-postit-id">id: {publishedArtwork.id}</p> -->
						<div class="publish-postit-actions">
							<GameButton type="button" variant="accent" size="sm" onclick={clearCanvas}>
								<span>Draw again</span>
							</GameButton>
							<GameLink href="/gallery" variant="secondary" size="sm">
								<span>Open gallery</span>
							</GameLink>
						</div>
						<div class="postit-curl" aria-hidden="true"></div>
					</div>
				{/if}
			</div>
		</div>
	</main>
</div>

{#if showExitFade}
	<div
		class="pointer-events-none fixed inset-0 z-[9999]"
		style={`background-color: #6e6e6e; opacity: ${exitFadeOpacity};`}
	></div>
{/if}

<style>
	.studio-book-frame {
		height: clamp(29rem, 78vh, 56rem);
		flex: 0 0 auto;
		justify-self: center;
		--book-offset-x: 22rem;
		--book-offset-y: 3rem;
		--book-scale: 0.82;
		--book-rotation: -6deg;
		transform: translate(var(--book-offset-x), var(--book-offset-y)) scale(var(--book-scale)) rotate(var(--book-rotation));
		transform-origin: center center;
		transition:
			transform 800ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	/* Book approaches viewer when opening/open */
	.studio-page[data-book-state='opening'] .studio-book-frame,
	.studio-page[data-book-state='open'] .studio-book-frame {
		--book-offset-x: 36rem;
		--book-offset-y: 2rem;
		--book-scale: 1.3;
		--book-rotation: 0deg;
	}

	.tools-stage {
		width: min(100%, 18rem);
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

	/* --- Post-it notes (inside cover fields) --- */

	.cover-postit {
		position: relative;
		padding: 16px 16px 6px;
		box-shadow: 2px 3px 8px rgb(0 0 0 / 0.18);
		max-width: 240px;
	}

	.cover-postit-title {
		background: linear-gradient(160deg, #fef49c 0%, #f7e67a 100%);
		transform: rotate(-1.5deg);
	}

	.cover-postit-nsfw {
		background: linear-gradient(160deg, #ffcdd2 0%, #f7929e 100%);
		transform: rotate(2deg);
	}

	.postit-tape {
		position: absolute;
		top: -7px;
		left: 50%;
		transform: translateX(-50%) rotate(-2deg);
		width: 42px;
		height: 14px;
		background: rgb(255 255 240 / 0.55);
		border: 1px solid rgb(200 190 170 / 0.3);
		pointer-events: none;
		z-index: 3;
	}

	.postit-label {
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(61 53 48 / 0.5);
		margin-bottom: 3px;
	}

	.postit-fork-note {
		font-family: 'Caveat', cursive;
		font-size: 0.75rem;
		color: #3d3530;
		margin-bottom: 2px;
	}

	.postit-fork-name {
		font-weight: 700;
	}

	.postit-input {
		width: 100%;
		background: rgb(255 255 255 / 0.5);
		border: none;
		border-bottom: 1.5px solid rgb(61 53 48 / 0.2);
		padding: 3px 2px;
		font-family: 'Caveat', cursive;
		font-size: 1rem;
		color: #3d3530;
		outline: none;
	}

	.postit-input::placeholder {
		color: rgb(61 53 48 / 0.3);
		font-style: italic;
	}

	.postit-input:focus {
		border-bottom-color: var(--color-primary, #d4834a);
	}

	.postit-input:disabled {
		opacity: 0.5;
	}

	.postit-error {
		font-family: 'Caveat', cursive;
		font-size: 0.75rem;
		color: #c84f4f;
		margin-top: 2px;
	}

	.postit-nsfw-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: 'Caveat', cursive;
		font-size: 1rem;
		color: #3d3530;
	}

	.postit-nsfw-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.nsfw-track {
		position: relative;
		display: inline-flex;
		width: 28px;
		height: 16px;
		border-radius: 8px;
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.nsfw-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #fbf7f0;
		border: 1.5px solid rgb(47 36 28 / 0.25);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
		transition: transform 0.2s;
	}

	/* --- Publish notification post-it --- */

	.publish-postit {
		position: relative;
		margin-top: 4rem;
		padding: 14px 12px 12px;
		background: linear-gradient(160deg, #c8e6c9 0%, #a5d6a7 100%);
		box-shadow: 2px 3px 8px rgb(0 0 0 / 0.18);
		transform: rotate(-2deg);
	}

	.publish-postit-title {
		font-family: 'Caveat', cursive;
		font-size: 1.15rem;
		font-weight: 700;
		color: #3d3530;
		margin-top: 2px;
		line-height: 2;
	}

	.publish-postit-id {
		font-family: 'Caveat', cursive;
		font-size: 0.85rem;
		color: rgb(61 53 48 / 0.45);
		margin-top: 1px;
	}

	.publish-postit-actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 8px;
	}

	.postit-curl {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 22px;
		height: 22px;
		background: linear-gradient(225deg, #b8956e 0%, #b8956e 45%, transparent 46%);
	}

	.postit-curl::after {
		content: '';
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 24px;
		height: 24px;
		background: linear-gradient(225deg, transparent 42%, rgb(0 0 0 / 0.08) 44%, #8cc98f 45%);
	}

	/* --- Animations --- */

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
			--book-offset-x: 1.5rem;
		}

		.tools-stage {
			width: min(100%, 14rem);
		}
	}

	@media (max-width: 700px) {
		.studio-book-frame {
			height: clamp(24rem, 68vh, 48rem);
			--book-offset-x: 0.5rem;
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
