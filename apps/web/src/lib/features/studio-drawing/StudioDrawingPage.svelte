<script lang="ts">
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { gsap } from '$lib/client/gsap';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import {
		buildDrawingDraftKey,
		clearDrawingDraft,
		loadDrawingDraft,
		saveDrawingDraft
	} from '$lib/features/stroke-json/drafts';
	import {
		cloneDrawingDocument,
		createEmptyDrawingDocument,
		serializeDrawingDocument,
		type DrawingDocumentV1
	} from '$lib/features/stroke-json/document';
	import type {
		DrawForkParent,
		DrawPageUser,
		DrawPublishActionData,
		DrawPublishedArtwork
	} from '$lib/features/studio-drawing/publish-contract';
	import DrawingBookStage from '$lib/features/studio-drawing/components/DrawingBookStage.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import AmbientParticleOverlay from '$lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import DrawingCanvas from '$lib/features/studio-drawing/components/DrawingCanvas.svelte';
	import DrawingToolTray from '$lib/features/studio-drawing/tools/DrawingToolTray.svelte';

	const FORK_CONTEXT_STORAGE_PREFIX = 'studio-fork-context';

	const getForkContextStorageKey = (user?: DrawPageUser) => {
		if (!user) return null;
		return `${FORK_CONTEXT_STORAGE_PREFIX}:${user.id ?? user.nickname}`;
	};

	const loadPersistedForkParent = (storageKey: string): DrawForkParent | null => {
		const rawValue = window.localStorage.getItem(storageKey);
		if (!rawValue) return null;

		try {
			const parsed = JSON.parse(rawValue) as Partial<DrawForkParent>;
			if (
				typeof parsed.id !== 'string' ||
				typeof parsed.mediaUrl !== 'string' ||
				typeof parsed.title !== 'string'
			) {
				window.localStorage.removeItem(storageKey);
				return null;
			}

			return {
				drawingDocument: parsed.drawingDocument ?? null,
				id: parsed.id,
				isNsfw: parsed.isNsfw,
				mediaUrl: parsed.mediaUrl,
				title: parsed.title
			};
		} catch {
			window.localStorage.removeItem(storageKey);
			return null;
		}
	};

	const savePersistedForkParent = (storageKey: string, forkParent: DrawForkParent | null) => {
		if (!forkParent) {
			window.localStorage.removeItem(storageKey);
			return;
		}

		window.localStorage.setItem(storageKey, JSON.stringify(forkParent));
	};

	let {
		checkTextContent = defaultCheckTextContent,
		createArtworkPayload = async (documentState: DrawingDocumentV1) => {
			const mode =
				typeof window === 'undefined'
					? 'good'
					: ((
							window as Window & {
								__drawingExportMode?: 'bad' | 'unsupported' | 'webp';
							}
						).__drawingExportMode ?? 'good');

			if (mode === 'unsupported') {
				return null;
			}

			if (mode === 'bad') {
				return serializeDrawingDocument(createEmptyDrawingDocument('avatar'));
			}

			if (mode === 'webp' && documentState.strokes.length === 0) {
				return serializeDrawingDocument({
					...createEmptyDrawingDocument('artwork'),
					strokes: [
						{
							color: '#2d2420',
							points: [
								[128, 128] as [number, number],
								[384, 384] as [number, number],
								[640, 640] as [number, number]
							],
							size: 48
						}
					]
				});
			}

			return serializeDrawingDocument(documentState);
		},
		forkParent = null,
		openingDurationMs = 950,
		publishDrawing = async (
			drawingDocument: string,
			options: { isNsfw: boolean; parentArtworkId?: string | null; title: string }
		): Promise<DrawPublishActionData> => {
			const formData = new FormData();
			formData.set('drawingDocument', drawingDocument);
			formData.set('isNsfw', String(options.isNsfw));
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
		replaceStudioUrl = () => {
			replaceState(resolve('/draw'), window.history.state);
		},
		user
	}: {
		checkTextContent?: TextContentChecker;
		createArtworkPayload?: (documentState: DrawingDocumentV1) => Promise<string | null>;
		forkParent?: DrawForkParent | null;
		openingDurationMs?: number;
		publishDrawing?: (
			drawingDocument: string,
			options: { isNsfw: boolean; parentArtworkId?: string | null; title: string }
		) => Promise<DrawPublishActionData>;
		replaceStudioUrl?: () => void;
		user?: DrawPageUser;
	} = $props();

	let canvasRef = $state<HTMLCanvasElement | null>(null);
	let clearVersion = $state(0);
	let currentForkParent = $state<DrawForkParent | null>(null);
	let drawingDocument = $state<DrawingDocumentV1>(createEmptyDrawingDocument('artwork'));
	let forkPreloadSettled = $state(true);
	let isPublishing = $state(false);
	let pendingStudioUnlock = $state(false);
	let publishedArtwork = $state<DrawPublishedArtwork | null>(null);
	let sceneState = $state<'closed' | 'opening' | 'open' | 'closing'>('closed');
	let seededForkParent = $state(false);
	let statusMessage = $state('');
	let statusTone = $state<'error' | 'success' | 'idle'>('idle');
	let artworkTitle = $state('');
	let isArtworkNsfw = $state(false);
	let titleError = $state('');
	let isExitingToHome = $state(false);
	let showExitFade = $state(false);
	let exitFadeOpacity = $state(0);
	let forkContextHydrated = $state(false);
	const EXIT_FADE_DURATION_S = 0.5;
	const initialDrawingDocument = $derived(
		currentForkParent?.drawingDocument
			? cloneDrawingDocument(currentForkParent.drawingDocument)
			: createEmptyDrawingDocument('artwork')
	);
	const forkContextStorageKey = $derived(getForkContextStorageKey(user));
	const draftKey = $derived(
		user
			? buildDrawingDraftKey({
					schemaVersion: drawingDocument.version,
					scope: currentForkParent?.id ?? 'new',
					surface: 'artwork',
					userKey: user.id ?? user.nickname
				})
			: null
	);

	let studioUnlocked = $derived(sceneState === 'open');
	let toolsVisible = $derived(sceneState !== 'closed' && sceneState !== 'closing');
	let hasForkParent = $derived(Boolean(currentForkParent?.mediaUrl));

	$effect(() => {
		if (seededForkParent) return;
		currentForkParent = forkParent;
		seededForkParent = true;
	});

	$effect(() => {
		if (isExitingToHome) {
			pendingStudioUnlock = false;
			return;
		}

		forkPreloadSettled = !hasForkParent;
		pendingStudioUnlock = false;

		if (hasForkParent && sceneState === 'closed') {
			sceneState = 'opening';
		}
	});

	onMount(() => {
		const persistedForkParent =
			!forkParent && forkContextStorageKey ? loadPersistedForkParent(forkContextStorageKey) : null;
		const resolvedForkParent = forkParent ?? persistedForkParent ?? null;

		if (resolvedForkParent) {
			currentForkParent = resolvedForkParent;
		}

		forkContextHydrated = true;

		const resolvedDraftKey = user
			? buildDrawingDraftKey({
					schemaVersion: drawingDocument.version,
					scope: resolvedForkParent?.id ?? 'new',
					surface: 'artwork',
					userKey: user.id ?? user.nickname
				})
			: null;

		if (!resolvedDraftKey) {
			drawingDocument = resolvedForkParent?.drawingDocument
				? cloneDrawingDocument(resolvedForkParent.drawingDocument)
				: createEmptyDrawingDocument('artwork');
			return;
		}

		const draft = loadDrawingDraft(resolvedDraftKey);
		drawingDocument =
			draft?.kind === 'artwork'
				? draft
				: resolvedForkParent?.drawingDocument
					? cloneDrawingDocument(resolvedForkParent.drawingDocument)
					: createEmptyDrawingDocument('artwork');
	});

	$effect(() => {
		if (!draftKey) return;
		saveDrawingDraft(draftKey, drawingDocument);
	});

	$effect(() => {
		if (!forkContextHydrated || !forkContextStorageKey) return;
		savePersistedForkParent(forkContextStorageKey, currentForkParent);
	});

	const clearCanvas = () => {
		if (!studioUnlocked) return;
		drawingDocument = cloneDrawingDocument(initialDrawingDocument);
		clearVersion += 1;
		publishedArtwork = null;
		statusMessage = '';
		statusTone = 'idle';
	};

	const cancelFork = () => {
		if (!studioUnlocked || !currentForkParent) return;

		const forkDraftKey = draftKey;
		if (forkDraftKey) {
			clearDrawingDraft(forkDraftKey);
		}
		if (forkContextStorageKey) {
			savePersistedForkParent(forkContextStorageKey, null);
		}

		currentForkParent = null;
		drawingDocument = createEmptyDrawingDocument('artwork');
		clearVersion += 1;
		artworkTitle = '';
		isArtworkNsfw = false;
		titleError = '';
		publishedArtwork = null;
		statusMessage = '';
		statusTone = 'idle';

		replaceStudioUrl();
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

	const handleBookClosed = () => {
		if (sceneState !== 'closing') return;
		sceneState = 'closed';
		fadeAndExitHome();
	};

	const fadeAndExitHome = () => {
		showExitFade = true;

		const fade = { opacity: 0 };
		gsap.to(fade, {
			opacity: 1,
			duration: EXIT_FADE_DURATION_S,
			ease: 'power2.in',
			onUpdate: () => {
				exitFadeOpacity = fade.opacity;
			},
			onComplete: () => {
				void goto(resolve('/?from=studio'));
			}
		});
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

			const payload = await createArtworkPayload(drawingDocument);
			if (!payload) {
				statusMessage = 'This browser could not prepare your drawing. Please try again.';
				statusTone = 'error';
				return;
			}

			const result = await publishDrawing(payload, {
				isNsfw: isArtworkNsfw,
				parentArtworkId: currentForkParent?.id ?? null,
				title: artworkTitle
			});
			if ('success' in result && result.success) {
				if (draftKey) {
					clearDrawingDraft(draftKey);
				}
				if (forkContextStorageKey) {
					savePersistedForkParent(forkContextStorageKey, null);
				}
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

		if (sceneState === 'open') {
			sceneState = 'closing';
			return;
		}

		fadeAndExitHome();
	};
</script>

<div class="studio-page relative flex h-dvh flex-col overflow-hidden" data-book-state={sceneState}>
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
		<div class="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-8">
			<div class="order-1 flex min-h-0 flex-col">
				<div class="studio-book-frame">
					<DrawingBookStage
						stageState={sceneState}
						onClosed={handleBookClosed}
						onOpenRequest={startOpeningBook}
						onOpened={unlockStudio}
						{openingDurationMs}
					>
						{#snippet coverFields()}
							<div class="cover-postit cover-postit-title">
								<div class="postit-tape" aria-hidden="true"></div>
								<p class="postit-label">Title your masterpiece</p>
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

							{#if currentForkParent}
								<div class="cover-postit cover-postit-cancel">
									<div class="postit-tape" aria-hidden="true"></div>
									<p class="postit-label">Change of plan</p>
									<p class="postit-fork-note postit-fork-note-compact">
										Forking <span class="postit-fork-name">{currentForkParent.title}</span>
									</p>
									<GameButton
										type="button"
										variant="ghost"
										size="sm"
										disabled={!studioUnlocked}
										onclick={cancelFork}
										className="postit-cancel-btn"
									>
										<span>Cancel fork</span>
									</GameButton>
								</div>
							{/if}

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
							bind:drawingDocument
							{clearVersion}
							initialDrawingDocument={currentForkParent?.drawingDocument ?? null}
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
		--book-closed-offset-x: 20rem;
		--book-closed-offset-y: 7rem;
		--book-closed-scale: 0.8;
		--book-closed-rotation: -4deg;
		--book-open-offset-x: 30rem;
		--book-open-offset-y: 2rem;
		--book-open-scale: 1.3;
		--book-open-rotation: 0deg;
		--book-offset-x: var(--book-closed-offset-x);
		--book-offset-y: var(--book-closed-offset-y);
		--book-scale: var(--book-closed-scale);
		--book-rotation: var(--book-closed-rotation);
		transform: translate(var(--book-offset-x), var(--book-offset-y)) scale(var(--book-scale))
			rotate(var(--book-rotation));
		transform-origin: center center;
		transition: transform 800ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	/* Book approaches viewer when opening/open */
	.studio-page[data-book-state='opening'] .studio-book-frame,
	.studio-page[data-book-state='open'] .studio-book-frame {
		--book-offset-x: var(--book-open-offset-x);
		--book-offset-y: var(--book-open-offset-y);
		--book-scale: var(--book-open-scale);
		--book-rotation: var(--book-open-rotation);
	}

	.tools-stage {
		width: min(100%, 15rem);
		margin-left: clamp(1.5rem, 3vw, 3rem);
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
		padding: 12px 12px 8px;
		box-shadow: 2px 3px 8px rgb(0 0 0 / 0.18);
		max-width: 214px;
	}

	.cover-postit-title {
		background: linear-gradient(160deg, #fef49c 0%, #f7e67a 100%);
		transform: rotate(-1.5deg);
	}

	.cover-postit-nsfw {
		background: linear-gradient(160deg, #ffcdd2 0%, #f7929e 100%);
		transform: rotate(2deg);
	}

	.cover-postit-cancel {
		background: linear-gradient(160deg, #d5ecff 0%, #a9d4ff 100%);
		transform: rotate(1deg);
		align-self: flex-end;
		max-width: 188px;
		margin-right: 0.35rem;
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
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(61 53 48 / 0.5);
		margin-bottom: 3px;
	}

	.postit-fork-note {
		font-family: 'Caveat', cursive;
		font-size: 0.7rem;
		color: #3d3530;
		margin-bottom: 2px;
	}

	.postit-fork-note-compact {
		margin-bottom: 0.35rem;
		line-height: 1.05;
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
		font-size: 0.92rem;
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

	:global(.postit-cancel-btn) {
		width: 100%;
		justify-content: center;
		border-color: rgb(44 75 112 / 0.28);
		background: rgb(255 255 255 / 0.32);
		color: #244b70;
		box-shadow: none;
	}

	:global(.postit-cancel-btn:hover:not(:disabled)) {
		background: rgb(255 255 255 / 0.5);
	}

	.postit-nsfw-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: 'Caveat', cursive;
		font-size: 0.82rem;
		color: #3d3530;
		flex-wrap: wrap;
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
			--book-closed-offset-x: 0rem;
			--book-closed-offset-y: 0.8rem;
			--book-closed-scale: 0.9;
			--book-open-offset-x: 7rem;
			--book-open-offset-y: 1rem;
			--book-open-scale: 1.48;
		}

		.tools-stage {
			width: min(100%, 14rem);
			margin-left: 0;
		}
	}

	@media (max-width: 700px) {
		.studio-book-frame {
			height: clamp(24rem, 68vh, 48rem);
			--book-closed-offset-x: 0rem;
			--book-closed-offset-y: 0.65rem;
			--book-closed-scale: 0.88;
			--book-open-offset-x: 4.5rem;
			--book-open-offset-y: 0.8rem;
			--book-open-scale: 1.02;
		}

		.cover-postit-cancel {
			margin-right: 0.2rem;
			max-width: 170px;
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
