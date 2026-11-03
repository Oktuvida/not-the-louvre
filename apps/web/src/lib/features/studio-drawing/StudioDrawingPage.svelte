<script lang="ts">
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '#lib/client/content-filter/index.js';
	import {
		buildDrawingDraftKey,
		createDrawingDraftSession,
		type DrawingDraftSession,
		type IndexedDbDrawingDraftStore
	} from '#lib/features/stroke-json/drafts.js';
	import {
		DRAWING_DOCUMENT_VERSION,
		cloneDrawingDocumentV2,
		createEmptyDrawingDocumentV2,
		type DrawingDocumentV2,
		type DrawingStroke
	} from '#lib/features/stroke-json/document.js';
	import type {
		DrawForkParent,
		DrawPageUser,
		DrawPublishActionData,
		DrawPublishedArtwork
	} from '#lib/features/studio-drawing/publish-contract.js';
	import DrawingBookStage from '#lib/features/studio-drawing/components/DrawingBookStage.svelte';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '#lib/features/shared-ui/components/GameLink.svelte';
	import AmbientParticleOverlay from '#lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import PageFadeOverlay from '#lib/features/shared-ui/components/PageFadeOverlay.svelte';
	import DrawingCanvas from '#lib/features/studio-drawing/components/DrawingCanvas.svelte';
	import { encodeDrawingV3 } from '#lib/stroke/v3.js';
	import { toInkDocument } from '#lib/features/stroke-json/ink-document.js';
	import DrawingToolTray from '#lib/features/studio-drawing/tools/DrawingToolTray.svelte';
	import StudioActions from '#lib/features/studio-drawing/tools/StudioActions.svelte';
	// Every screen's layout of the studio lives in this one sheet.
	import './studio-layout.css';
	import { measureInk, type InkLimits } from '#lib/features/stroke-json/ink.js';
	import { STUDIO_DESK_IMAGE } from '#lib/features/shared-ui/studio-background-warmup.js';
	import {
		HANDOFF_CSS_VARIABLES,
		takeHandedOverBook
	} from '#lib/features/shared-ui/studio-handoff.js';
	import { layBookOnSpot, liftBookOffSpot } from '#lib/features/studio-drawing/book-on-spot.js';
	// The bookplate's printed heading and its typed line.
	import '@fontsource/playfair-display/latin-700.css';
	import '@fontsource/special-elite/latin-400.css';

	const UNSAVED_DRAFT_MESSAGE = 'Latest local changes are not saved on this device yet.';

	const FORK_CONTEXT_STORAGE_PREFIX = 'studio-fork-context';

	type PersistedForkContext = Pick<DrawForkParent, 'id' | 'isNsfw' | 'mediaUrl' | 'title'>;

	const getForkContextStorageKey = (user?: DrawPageUser) => {
		if (!user) return null;
		return `${FORK_CONTEXT_STORAGE_PREFIX}:${user.id ?? user.nickname}`;
	};

	const loadPersistedForkParent = (storageKey: string): DrawForkParent | null => {
		const rawValue = window.localStorage.getItem(storageKey);
		if (!rawValue) return null;

		try {
			const parsed = JSON.parse(rawValue) as Partial<PersistedForkContext>;
			if (
				typeof parsed.id !== 'string' ||
				typeof parsed.mediaUrl !== 'string' ||
				typeof parsed.title !== 'string'
			) {
				window.localStorage.removeItem(storageKey);
				return null;
			}

			return {
				drawingDocument: null,
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

		const persistedForkContext: PersistedForkContext = {
			id: forkParent.id,
			isNsfw: forkParent.isNsfw,
			mediaUrl: forkParent.mediaUrl,
			title: forkParent.title
		};

		window.localStorage.setItem(storageKey, JSON.stringify(persistedForkContext));
	};

	let {
		checkTextContent = defaultCheckTextContent,
		createArtworkPayload = async (documentState: DrawingDocumentV2) =>
			JSON.stringify(encodeDrawingV3(toInkDocument(documentState))),
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
			goto(resolve('draw'), { shallow: true, replace: true, state: window.history.state });
		},
		draftStore,
		inkLimits = {},
		user
	}: {
		checkTextContent?: TextContentChecker;
		createArtworkPayload?: (documentState: DrawingDocumentV2) => Promise<string | null>;
		draftStore?: IndexedDbDrawingDraftStore;
		/** The server's drawing limits; specs pass a small budget. */
		inkLimits?: InkLimits;
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
	let canvasHistory = $state<{
		canRedo(): boolean;
		canUndo(): boolean;
		redo(): boolean;
		undo(): boolean;
	}>();
	const canRedo = $derived(canvasHistory?.canRedo() ?? false);
	const canUndo = $derived(canvasHistory?.canUndo() ?? false);
	let clearVersion = $state(0);
	let currentForkParent = $state<DrawForkParent | null>(null);
	let draftHydrated = $state(false);
	let drawingDocument = $state<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork'));
	let initialDrawingDocument = $state<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork'));
	let artworkBaselineDocument = $state<DrawingDocumentV2>(createEmptyDrawingDocumentV2('artwork'));
	let isPublishing = $state(false);
	// Whether this screen's layout shows the sketchbook's cover; without one
	// (a tablet held upright, a phone) the page is open from the start. The
	// stage reads it from the CSS, which alone decides each screen's layout.
	let coverShown = $state(true);
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
	let forkContextHydrated = $state(false);
	const forkContextStorageKey = $derived(getForkContextStorageKey(user));
	const resolveDraftKeys = (scope: string | null) => {
		if (!user) {
			return { draftKey: null, legacyDraftKey: null };
		}

		return {
			draftKey: buildDrawingDraftKey({
				schemaVersion: drawingDocument.version,
				scope: scope ?? 'new',
				surface: 'artwork',
				userKey: user.id ?? user.nickname
			}),
			legacyDraftKey: buildDrawingDraftKey({
				schemaVersion: DRAWING_DOCUMENT_VERSION,
				scope: scope ?? 'new',
				surface: 'artwork',
				userKey: user.id ?? user.nickname
			})
		};
	};
	const draftKey = $derived(resolveDraftKeys(currentForkParent?.id ?? null).draftKey);
	const legacyDraftKey = $derived(resolveDraftKeys(currentForkParent?.id ?? null).legacyDraftKey);

	/*
	 * Closed, the book lies on the hand-off spot, where the home room's camera
	 * left the side table's book (book-on-spot.ts). Coming from that room it is
	 * there from the first frame; otherwise it glides there from the layout.
	 */
	let bookElement = $state<HTMLElement | null>(null);
	let coverElement = $state<HTMLElement | null>(null);
	let bookArrivesFromRoom = takeHandedOverBook();
	/** The room's last frame has no header nor cover lettering; they join after the cut. */
	const arrivedFromRoom = bookArrivesFromRoom;

	$effect(() => {
		const book = bookElement;
		const cover = coverElement;
		if (!book || !cover) return;

		if (!coverShown || (sceneState !== 'closed' && sceneState !== 'closing')) {
			liftBookOffSpot(book);
			return;
		}

		layBookOnSpot(book, cover, !bookArrivesFromRoom);
		bookArrivesFromRoom = false;
		const relay = () => layBookOnSpot(book, cover, false);
		window.addEventListener('resize', relay);
		return () => window.removeEventListener('resize', relay);
	});

	let studioUnlocked = $derived(draftHydrated && (!coverShown || sceneState === 'open'));
	let toolsVisible = $derived(
		draftHydrated && (!coverShown || (sceneState !== 'closed' && sceneState !== 'closing'))
	);
	let hasForkParent = $derived(Boolean(currentForkParent?.mediaUrl));

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
		if (statusMessage === UNSAVED_DRAFT_MESSAGE && statusTone === 'error') {
			statusMessage = '';
			statusTone = 'idle';
		}
	};

	const markUnsavedDraftWarning = () => {
		statusMessage = UNSAVED_DRAFT_MESSAGE;
		statusTone = 'error';
	};

	const resetDraftSession = async (
		seedDocument: DrawingDocumentV2,
		draftKeys = { draftKey, legacyDraftKey }
	) => {
		const draftSession = createDraftSession(draftKeys.draftKey, draftKeys.legacyDraftKey);
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

	$effect(() => {
		if (seededForkParent) return;
		currentForkParent = forkParent;
		seededForkParent = true;
	});

	$effect(() => {
		if (isExitingToHome) return;

		if (!coverShown) {
			if (untrack(() => sceneState) !== 'open') {
				sceneState = 'open';
			}
			return;
		}

		if (!hasForkParent || untrack(() => sceneState) !== 'closed') return;

		// Arriving by Fork must still play the book-open transition. The cover flip
		// and the frame zoom are CSS transitions, so they need the closed pose to be
		// computed first: flipping the state inside the mount flush leaves them with
		// no start value and the book snaps open. One frame later it animates.
		const openFrame = requestAnimationFrame(() => {
			if (isExitingToHome || sceneState !== 'closed') return;
			sceneState = 'opening';
		});

		return () => {
			cancelAnimationFrame(openFrame);
		};
	});

	onMount(() => {
		let draftLoadCancelled = false;
		draftHydrated = false;

		const persistedForkParent =
			!forkParent && forkContextStorageKey ? loadPersistedForkParent(forkContextStorageKey) : null;
		const resolvedForkParent = forkParent ?? persistedForkParent ?? null;

		if (resolvedForkParent) {
			currentForkParent = resolvedForkParent;
		}

		forkContextHydrated = true;

		const { draftKey: resolvedDraftKey, legacyDraftKey: resolvedLegacyDraftKey } = resolveDraftKeys(
			resolvedForkParent?.id ?? null
		);

		if (!resolvedDraftKey) {
			drawingDocument = resolvedForkParent?.drawingDocument
				? cloneDrawingDocumentV2(resolvedForkParent.drawingDocument)
				: createEmptyDrawingDocumentV2('artwork');
			initialDrawingDocument = cloneDrawingDocumentV2(drawingDocument);
			artworkBaselineDocument = cloneDrawingDocumentV2(drawingDocument);
			draftHydrated = true;
			return () => {
				draftLoadCancelled = true;
			};
		}

		const draftSession = createDraftSession(resolvedDraftKey, resolvedLegacyDraftKey);
		const seedDocument = resolvedForkParent?.drawingDocument
			? cloneDrawingDocumentV2(resolvedForkParent.drawingDocument)
			: createEmptyDrawingDocumentV2('artwork');

		void draftSession!
			.hydrate({ seedDocument })
			.then(async (draft) => {
				if (draftLoadCancelled) return;

				const persistedBaseline = await draftSession!.loadBaseline().catch(() => null);
				if (draftLoadCancelled) return;

				drawingDocument = draft?.kind === 'artwork' ? draft : seedDocument;
				initialDrawingDocument = cloneDrawingDocumentV2(drawingDocument);
				artworkBaselineDocument = cloneDrawingDocumentV2(
					persistedBaseline?.kind === 'artwork' ? persistedBaseline : seedDocument
				);
				draftHydrated = true;
				clearUnsavedDraftWarning();
			})
			.catch(() => {
				if (draftLoadCancelled) return;

				drawingDocument = cloneDrawingDocumentV2(seedDocument);
				initialDrawingDocument = cloneDrawingDocumentV2(seedDocument);
				artworkBaselineDocument = cloneDrawingDocumentV2(seedDocument);
				draftHydrated = true;
				markUnsavedDraftWarning();
			});

		return () => {
			draftLoadCancelled = true;
		};
	});

	$effect(() => {
		if (!forkContextHydrated || !forkContextStorageKey) return;
		savePersistedForkParent(forkContextStorageKey, currentForkParent);
	});

	const clearCanvas = () => {
		if (!studioUnlocked) return;
		drawingDocument = cloneDrawingDocumentV2(artworkBaselineDocument);
		initialDrawingDocument = cloneDrawingDocumentV2(artworkBaselineDocument);
		void resetDraftSession(artworkBaselineDocument);
		clearVersion += 1;
		publishedArtwork = null;
		statusMessage = '';
		statusTone = 'idle';
	};

	const returnToEmptyArtworkMode = (options?: {
		preservePublishedArtwork?: boolean;
		preserveStatusMessage?: boolean;
	}) => {
		const previousForkParentId = currentForkParent?.id ?? null;
		const previousDraftKeys = resolveDraftKeys(previousForkParentId);
		const nextDraftKeys = resolveDraftKeys(null);
		const emptyDocument = createEmptyDrawingDocumentV2('artwork');

		void createDraftSession(previousDraftKeys.draftKey, previousDraftKeys.legacyDraftKey)?.clear();
		currentForkParent = null;
		initialDrawingDocument = cloneDrawingDocumentV2(emptyDocument);
		artworkBaselineDocument = cloneDrawingDocumentV2(emptyDocument);
		drawingDocument = cloneDrawingDocumentV2(emptyDocument);
		clearVersion += 1;
		artworkTitle = '';
		isArtworkNsfw = false;
		titleError = '';
		if (!options?.preservePublishedArtwork) {
			publishedArtwork = null;
		}
		if (!options?.preserveStatusMessage) {
			statusMessage = '';
			statusTone = 'idle';
		}
		if (forkContextStorageKey) {
			savePersistedForkParent(forkContextStorageKey, null);
		}
		replaceStudioUrl();
		void resetDraftSession(emptyDocument, nextDraftKeys);
	};

	const cancelFork = () => {
		if (!studioUnlocked || !currentForkParent) return;

		returnToEmptyArtworkMode();
	};

	const startOpeningBook = () => {
		if (sceneState !== 'closed') return;
		sceneState = 'opening';
	};

	const unlockStudio = () => {
		if (sceneState !== 'opening') return;
		sceneState = 'open';
	};

	const handleBookClosed = () => {
		if (sceneState !== 'closing') return;
		sceneState = 'closed';
		fadeAndExitHome();
	};

	/*
	 * Draft writes go out one at a time. A stroke's journal entry still being
	 * written when an undo rewrites the snapshot would land after it, and the
	 * undone line would come back on the next reload.
	 */
	let draftWrites = Promise.resolve();

	const writeDraft = (write: (session: DrawingDraftSession) => Promise<unknown>) => {
		const draftSession = createDraftSession(draftKey, legacyDraftKey);
		if (!draftSession) return;

		draftWrites = draftWrites.then(async () => {
			try {
				await write(draftSession);
				clearUnsavedDraftWarning();
			} catch {
				markUnsavedDraftWarning();
			}
		});
	};

	const handleStrokeCommitted = (input: {
		nextDocument: DrawingDocumentV2;
		previousDocument: DrawingDocumentV2;
		stroke: DrawingStroke;
	}) => {
		writeDraft((session) => session.appendCommittedStroke(input.previousDocument, input.stroke));
	};

	const ink = $derived(measureInk(drawingDocument, inkLimits));

	const handleOutOfInk = () => {
		statusMessage = 'Out of ink. Undo a line to free some up, or publish.';
		statusTone = 'error';
	};

	const handleHistoryChange = (document: DrawingDocumentV2) => {
		writeDraft((session) => session.compact(document));
	};

	const undo = () => {
		if (studioUnlocked) canvasHistory?.undo();
	};

	const redo = () => {
		if (studioUnlocked) canvasHistory?.redo();
	};

	// Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y), except while typing: the
	// title field keeps its own undo.
	const handleHistoryShortcut = (event: KeyboardEvent) => {
		if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			undo();
		} else if ((key === 'z' && event.shiftKey) || key === 'y') {
			event.preventDefault();
			redo();
		}
	};

	/** Drops the shared page veil; PageFadeOverlay calls back when it is down. */
	const fadeAndExitHome = () => {
		showExitFade = true;
	};

	// The veil owns the "and now navigate" moment, including dropping it when the
	// studio is unmounted mid-fade — a stale callback would still pull a visitor
	// who has already gone somewhere else back to the home page.
	const completeExitToHome = () => {
		void goto(resolve('?from=studio'));
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
				publishedArtwork = result.artwork;
				statusMessage = `Artwork published as ${result.artwork.title}`;
				statusTone = 'success';

				if (currentForkParent) {
					returnToEmptyArtworkMode({
						preservePublishedArtwork: true,
						preserveStatusMessage: true
					});
				} else {
					const draftSession = createDraftSession(draftKey, legacyDraftKey);
					void draftSession?.clear();
					drawingDocument = cloneDrawingDocumentV2(artworkBaselineDocument);
					initialDrawingDocument = cloneDrawingDocumentV2(artworkBaselineDocument);
					clearVersion += 1;
					artworkTitle = '';
					isArtworkNsfw = false;
					titleError = '';
				}
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

		if (coverShown && sceneState === 'open') {
			sceneState = 'closing';
			return;
		}

		fadeAndExitHome();
	};
</script>

<svelte:window onkeydown={handleHistoryShortcut} />

<svelte:head>
	<!-- No title element here on purpose: the route contributes `meta.title`
	from its load and the root layout renders the document's only one. -->
	<link
		rel="preload"
		as="image"
		type="image/avif"
		imagesrcset={STUDIO_DESK_IMAGE.avif}
		imagesizes={STUDIO_DESK_IMAGE.sizes}
		fetchpriority="high"
	/>
</svelte:head>

<div
	class="studio-page"
	data-arrival={arrivedFromRoom ? 'room' : undefined}
	data-book-state={sceneState}
	style={HANDOFF_CSS_VARIABLES}
>
	<!-- The home room's side table, photographed from where the Studio move
	     ends (scripts/render-studio-desk.ts), laid so the book's place is the
	     closed book's spot. -->
	<picture class="studio-desk">
		<source type="image/avif" srcset={STUDIO_DESK_IMAGE.avif} sizes={STUDIO_DESK_IMAGE.sizes} />
		<source type="image/webp" srcset={STUDIO_DESK_IMAGE.webp} sizes={STUDIO_DESK_IMAGE.sizes} />
		<img
			src={STUDIO_DESK_IMAGE.fallback}
			alt=""
			width="1920"
			height="1080"
			class="studio-desk-image"
			loading="eager"
			decoding="async"
		/>
	</picture>

	<AmbientParticleOverlay className="z-5 opacity-90" />

	<header class="studio-header">
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
					stroke-linejoin="round"
				>
					<path d="m12 19-7-7 7-7"></path>
					<path d="M19 12H5"></path>
				</svg>

				<span>Exit Studio</span>
			</GameLink>
		</div>
	</header>

	<!-- One page for every screen: studio-layout.css places these four pieces
	     (the book, its notes, the supplies, the buttons) for each shape of window. -->
	<main class="studio-layout">
		<div class="studio-book" bind:this={bookElement}>
			<DrawingBookStage
				arriving={arrivedFromRoom}
				bind:coverElement
				bind:coverShown
				stageState={sceneState}
				onClosed={handleBookClosed}
				onOpenRequest={startOpeningBook}
				onOpened={unlockStudio}
				{openingDurationMs}
			>
				<DrawingCanvas
					sheet
					backdrop={currentForkParent?.mediaUrl ?? null}
					bind:this={canvasHistory}
					bind:canvasRef
					bind:drawingDocument
					{clearVersion}
					{initialDrawingDocument}
					interactive={studioUnlocked}
					{inkLimits}
					onHistoryChange={handleHistoryChange}
					onOutOfInk={handleOutOfInk}
					onStrokeCommitted={handleStrokeCommitted}
					{statusMessage}
					{statusTone}
				/>
			</DrawingBookStage>
		</div>

		<section
			class={`studio-notes ${toolsVisible ? 'studio-notes-open' : 'studio-notes-hidden'}`}
			aria-label="About this drawing"
			aria-hidden={!toolsVisible}
			inert={!toolsVisible}
		>
			{#if user}
				<!-- Where the notes lie on the open cover, its inside is the artist's
				     own: a bookplate, signed. -->
				<aside class="studio-bookplate" aria-label="Ex libris">
					<p class="bookplate-heading">Ex libris</p>
					<svg class="bookplate-mark" viewBox="0 0 60 44" aria-hidden="true">
						<path d="M30 3 L56 41 H4 Z" stroke-width="2.6" stroke-linejoin="round"></path>
						<path d="M30 3 L22 41 M30 3 L38 41 M12 29 H48 M18 22 H42" stroke-width="1.2"></path>
					</svg>
					<p class="bookplate-owner">
						this sketchbook belongs to
						<span class="bookplate-name">{user.nickname}</span>
					</p>
				</aside>
			{/if}

			<div class="cover-postit cover-postit-title sticky-note">
				<label class="postit-label" for="studio-artwork-title">Title your masterpiece</label>
				<input
					id="studio-artwork-title"
					bind:value={artworkTitle}
					type="text"
					maxlength="80"
					placeholder="Untitled genius"
					disabled={!studioUnlocked}
					class="postit-input"
				/>
				<span class="postit-rule" aria-hidden="true"></span>
				{#if titleError}
					<p class="postit-error">{titleError}</p>
				{/if}
			</div>

			<div class="cover-postit cover-postit-nsfw sticky-note sticky-note-curl-left">
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
					<!-- A box drawn on the note, ticked in red when it is checked. -->
					<svg class="nsfw-box" viewBox="0 0 26 26" aria-hidden="true">
						<path
							class="nsfw-box-frame"
							d="M4 5 C 10 3.5, 17 4.5, 22 4 C 22.5 10, 21.5 16, 22 22 C 15 22.5, 9 21.5, 4 22 C 3.5 16, 4.5 10, 4 5 Z"
						></path>
						{#if isArtworkNsfw}
							<path class="nsfw-box-tick" d="M7 13.5 L11.5 18.5 L22 5"></path>
						{/if}
					</svg>
					<span class={isArtworkNsfw ? 'font-semibold text-danger-bright' : ''}
						>Not safe for the Louvre</span
					>
				</button>
			</div>

			{#if currentForkParent}
				<div class="cover-postit cover-postit-cancel sticky-note">
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
		</section>

		<div
			class={`studio-tools tools-stage ${toolsVisible ? 'tools-stage-open' : 'tools-stage-hidden'}`}
			aria-hidden={!studioUnlocked}
			inert={!studioUnlocked}
		>
			<DrawingToolTray {canRedo} {canUndo} inkUsed={ink.used} onRedo={redo} onUndo={undo} />
		</div>

		<div
			class={`studio-actions tools-stage ${toolsVisible ? 'tools-stage-open' : 'tools-stage-hidden'}`}
			aria-hidden={!studioUnlocked}
			inert={!studioUnlocked}
		>
			<StudioActions {isPublishing} onPublish={publishArtwork} onClear={clearCanvas} />

			{#if publishedArtwork}
				<div class="publish-postit sticky-note">
					<span class="postit-tape tape tape-dots" aria-hidden="true"></span>
					<p class="postit-label">Hung on the wall!</p>
					<h2 class="publish-postit-title">{publishedArtwork.title}</h2>
					<div class="publish-postit-actions">
						<GameButton type="button" variant="accent" size="sm" onclick={clearCanvas}>
							<span>Draw again</span>
						</GameButton>
						<GameLink href="/gallery/your-studio" variant="secondary" size="sm">
							<span>See it on the wall</span>
						</GameLink>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>

<PageFadeOverlay direction="in" onComplete={completeExitToHome} visible={showExitFade} />

<style>
	/*
	 * The compositor hint belongs to the state that is ABOUT to move, not to the
	 * tray forever: `.tools-stage` used to carry `will-change: opacity,
	 * transform` for the whole life of /draw to serve one 210ms entrance. Here
	 * it warms the layer while the tray waits off-stage; once the class flips to
	 * `-open` the running transform/opacity animation keeps the element
	 * promoted on its own, and when it settles the layer is released.
	 */
	.tools-stage-hidden {
		opacity: 0;
		pointer-events: none;
		transform: translateX(10rem) rotate(10deg) scale(0.94);
		will-change: opacity, transform;
	}

	.tools-stage-open {
		opacity: 1;
		animation: toolTrayCrashIn 210ms cubic-bezier(0.2, 0.9, 0.24, 1.12) both;
	}

	/* The notes lie on the opened cover, so they arrive once it has opened. */
	.studio-notes-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.studio-notes-open {
		animation: studioPanelReveal 280ms ease-out both;
	}

	/* --- Post-it notes --- */

	.cover-postit {
		padding: 0.875rem 0.875rem 0.625rem;
	}

	.cover-postit-title {
		--note-paper: linear-gradient(172deg, #fff3a8 0%, #fbe57e 60%, #f2d65e 100%);
		transform: rotate(-1.5deg);
	}

	.cover-postit-nsfw {
		--note-paper: linear-gradient(172deg, #ffd6de 0%, #f8b9c7 55%, #f0a5b6 100%);
		transform: rotate(2deg);
	}

	.cover-postit-cancel {
		--note-paper: linear-gradient(172deg, #d6ecff 0%, #b9dbfb 60%, #a3cdf5 100%);
		transform: rotate(1deg);
	}

	.postit-tape {
		position: absolute;
		top: -9px;
		left: 50%;
		transform: translateX(-50%) rotate(-2deg);
		width: 60px;
		height: 18px;
		pointer-events: none;
		z-index: 3;
	}

	.postit-label {
		display: block;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		/* 0.5 alpha read 2.9:1 on the yellow; this is the darkest that still looks pencilled */
		color: rgb(61 53 48 / 0.78);
		margin-bottom: 3px;
	}

	.postit-fork-note {
		font-family: var(--font-hand);
		font-size: 1rem;
		color: var(--color-note-ink);
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
		font-family: var(--font-hand);
		font-size: 1.25rem;
		color: var(--color-note-ink);
		outline: none;
	}

	.postit-input::placeholder {
		color: rgb(61 53 48 / 0.55);
		font-style: italic;
	}

	/* A second ruled line, so the note is the square pad it is cut from. Only
	 * where the notes lie on the open cover, with the bookplate, is there room
	 * for it; in a column it would push Publish off a short screen. */
	.postit-rule {
		display: var(--studio-bookplate-display, none);
		height: 1.5px;
		margin-top: 1.9rem;
		background: rgb(61 53 48 / 0.2);
	}

	.postit-input:focus {
		border-bottom-color: var(--color-primary);
	}

	.postit-input:disabled {
		opacity: 0.5;
	}

	.postit-error {
		font-family: var(--font-hand);
		font-size: 1rem;
		color: var(--color-danger-bright);
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
		font-family: var(--font-hand);
		font-size: 1.2rem;
		color: var(--color-note-ink);
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.postit-nsfw-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.nsfw-box {
		width: 1.6rem;
		height: 1.6rem;
		flex-shrink: 0;
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.nsfw-box-frame {
		stroke: rgb(74 47 54 / 0.85);
		stroke-width: 2;
	}

	.nsfw-box-tick {
		stroke: var(--color-danger-bright);
		stroke-width: 2.8;
	}

	/* The bookplate glued inside the cover: printed heading and border, the
	 * owner's name in ink. Shown only where the notes lie on the open cover
	 * (studio-layout.css sets --studio-bookplate-display). */
	.studio-bookplate {
		display: var(--studio-bookplate-display, none);
		position: relative;
		align-self: center;
		width: 13rem;
		margin-bottom: 0.75rem;
		padding: 0.85rem 0.9rem 0.8rem;
		rotate: -1.2deg;
		background: #fbf6ea;
		box-shadow: 0 1px 1px rgb(40 25 10 / 0.2);
		text-align: center;
		color: #4a3524;
	}

	.studio-bookplate::before {
		content: '';
		position: absolute;
		inset: 0.3rem;
		border: 1.5px solid #8c6a46;
		outline: 1px solid #8c6a46;
		outline-offset: -0.3rem;
		pointer-events: none;
	}

	.bookplate-heading {
		margin: 0.3rem 0 0.15rem;
		font-family: 'Playfair Display', serif;
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}

	.bookplate-mark {
		display: block;
		width: 2.4rem;
		height: auto;
		margin: 0.2rem auto;
		fill: none;
		stroke: #6b4a30;
	}

	.bookplate-owner {
		margin: 0;
		font-family: 'Special Elite', 'Courier New', monospace;
		font-size: 0.75rem;
		line-height: 1.3;
	}

	.bookplate-name {
		display: block;
		margin-top: 0.1rem;
		font-family: var(--font-hand);
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.1;
		color: #2c4a7a;
		overflow-wrap: anywhere;
	}

	/* --- Publish notification post-it --- */

	.publish-postit {
		position: relative;
		margin-top: 1.5rem;
		padding: 14px 12px 12px;
		--note-paper: linear-gradient(172deg, #dcf2d4 0%, #c3e6bb 60%, #a9d6a0 100%);
		transform: rotate(-2deg);
		/* The reveal has to be declared in this stylesheet: Svelte renames scoped
		 * keyframes and only rewrites `animation` references inside the same block,
		 * so the inline `style="animation: studioPanelReveal …"` this replaces never
		 * resolved and both post-its appeared with no entrance. */
		animation: studioPanelReveal 280ms ease-out both;
	}

	.publish-postit-title {
		font-family: var(--font-hand);
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--color-note-ink);
		margin-top: 2px;
		line-height: 2;
	}

	.publish-postit-id {
		font-family: var(--font-hand);
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

	/* --- Animations --- */

	.studio-page[data-arrival='room'] .studio-header {
		animation: studioArrival 500ms 250ms ease-out both;
	}

	@keyframes studioArrival {
		from {
			opacity: 0;
		}
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
</style>
