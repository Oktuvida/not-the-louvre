<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidateAll, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { get } from 'svelte/store';
	import { apiErrorMessage, requestJson } from '$lib/client/api';
	import { setAdultContentEnabled } from '$lib/client/avatar-upload';
	import { getBrowserRealtimeClient } from '$lib/features/realtime/browser-client';
	import { getGalleryLayoutContext } from '$lib/features/gallery-exploration/gallery-layout-context';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import {
		toGalleryArtwork,
		toGalleryArtworkDetail
	} from '$lib/features/gallery-exploration/gallery-adapter';
	import { createDetailPrefetcher } from '$lib/features/gallery-exploration/detail-prefetch';
	import type {
		GalleryDiscovery,
		GalleryDiscoveryRequest,
		GalleryRoomContent
	} from '$lib/features/gallery-exploration/model/discovery';
	import { suppressNextRoomFeedSnapshot } from '$lib/features/gallery-exploration/model/feed-cache';
	import {
		type GalleryRoomConfig,
		type GalleryRoomId
	} from '$lib/features/gallery-exploration/model/rooms';
	import { createRealtimeSubscription } from '$lib/features/gallery-exploration/use-realtime-subscription.svelte';
	import type { Viewer } from '$lib/shared/viewer';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import PageFadeOverlay from '$lib/features/shared-ui/components/PageFadeOverlay.svelte';
	import GalleryStatusRegion from '$lib/features/gallery-exploration/components/GalleryStatusRegion.svelte';
	import RoomLoadingSkeleton from '$lib/features/gallery-exploration/components/RoomLoadingSkeleton.svelte';
	import HallOfFameRoom from '$lib/features/gallery-exploration/rooms/HallOfFameRoom.svelte';
	import HotWallRoom from '$lib/features/gallery-exploration/rooms/HotWallRoom.svelte';
	import MysteryRoom from '$lib/features/gallery-exploration/rooms/MysteryRoom.svelte';
	import YourStudioRoom from '$lib/features/gallery-exploration/rooms/YourStudioRoom.svelte';

	type GalleryDetailHistoryState = NonNullable<App.PageState['galleryDetail']>;

	const LOCAL_GALLERY_DETAIL_SOURCE = 'local-room-selection' as const;

	const ROOM_LOAD_ERROR_MESSAGE = 'The gallery could not load right now — refresh to try again.';

	/*
	 * The house copy for a failed API call. `apiErrorMessage` prefers the
	 * server's own `{ code, message }` when the answer really was this API
	 * explaining itself to a visitor (a rate limit, a rejected cursor) and keeps
	 * these strings for a 500, a proxy's HTML page or a dropped connection.
	 */
	const GALLERY_DISCOVERY_ERROR_MESSAGE = 'Gallery discovery could not be loaded';
	const ARTWORK_DETAIL_ERROR_MESSAGE = 'Artwork details could not be loaded';

	const isGalleryDetailHistoryState = (
		value: App.PageState['galleryDetail'] | null | undefined
	): value is GalleryDetailHistoryState => {
		return Boolean(
			value &&
			typeof value.artworkId === 'string' &&
			typeof value.roomId === 'string' &&
			(value.source === 'external' || value.source === LOCAL_GALLERY_DETAIL_SOURCE)
		);
	};

	const readGalleryDetailHistoryState = (
		state: App.PageState | null | undefined
	): GalleryDetailHistoryState | null => {
		if (!state) return null;

		return isGalleryDetailHistoryState(state.galleryDetail) ? state.galleryDetail : null;
	};

	const clearGalleryDetailHistoryState = (
		state: App.PageState | null | undefined
	): App.PageState => {
		if (!state) return {};

		const nextState = { ...state };
		delete nextState.galleryDetail;
		return nextState;
	};

	let {
		adultContentEnabled = false,
		artworks: routeArtworks = [],
		discovery: routeDiscovery = { pageInfo: { hasMore: false, nextCursor: null }, request: null },
		emptyStateMessage = null,
		isRoomLoading = false,
		loadError = null,
		roomContent = null,
		loadMoreArtworks = async (request: GalleryDiscoveryRequest & { cursor: string }) => {
			const query = [
				`cursor=${encodeURIComponent(request.cursor)}`,
				`limit=${encodeURIComponent(String(request.limit))}`,
				`sort=${encodeURIComponent(request.sort)}`
			];

			if (request.authorId) {
				query.push(`authorId=${encodeURIComponent(request.authorId)}`);
			}

			if (request.window) {
				query.push(`window=${encodeURIComponent(request.window)}`);
			}

			try {
				const payload = await requestJson<{
					items: Parameters<typeof toGalleryArtwork>[0][];
					pageInfo: { hasMore: boolean; nextCursor: string | null };
				}>(`/api/artworks?${query.join('&')}`);

				return {
					artworks: payload.items.map((item) => toGalleryArtwork(item)),
					pageInfo: payload.pageInfo
				};
			} catch (error) {
				throw new Error(apiErrorMessage(error, GALLERY_DISCOVERY_ERROR_MESSAGE), {
					cause: error
				});
			}
		},
		loadArtworkDetail = async (artworkId: string) => {
			// The comments call is best-effort: a detail without its thread is
			// still worth showing, so only the detail's failure propagates.
			const [payload, commentsPayload] = await Promise.all([
				requestJson<{ artwork: Parameters<typeof toGalleryArtworkDetail>[0] }>(
					`/api/artworks/${artworkId}`
				).catch((error: unknown) => {
					throw new Error(apiErrorMessage(error, ARTWORK_DETAIL_ERROR_MESSAGE), { cause: error });
				}),
				requestJson<{
					comments: Array<{
						author: { nickname: string };
						body: string;
						createdAt: Date | string;
						id: string;
					}>;
				}>(`/api/artworks/${artworkId}/comments`).catch(() => null)
			]);

			const detail = toGalleryArtworkDetail(payload.artwork);

			if (!commentsPayload) {
				return detail;
			}

			return {
				...detail,
				comments: commentsPayload.comments.map((comment) => ({
					author: comment.author.nickname,
					id: comment.id,
					text: comment.body,
					timestamp:
						comment.createdAt instanceof Date
							? comment.createdAt.getTime()
							: new Date(comment.createdAt).getTime()
				}))
			};
		},
		fetchRandomArtwork = async () => {
			try {
				const payload = await requestJson<{ artwork: Parameters<typeof toGalleryArtwork>[0] }>(
					'/api/artworks/random'
				);

				return toGalleryArtwork(payload.artwork);
			} catch (error) {
				throw new Error(apiErrorMessage(error, 'Could not fetch a random artwork'), {
					cause: error
				});
			}
		},
		room,
		roomId,
		realtimeConfig = { anonKey: null, url: null },
		viewer = null
	}: {
		adultContentEnabled?: boolean;
		artworks?: Artwork[];
		discovery?: GalleryDiscovery;
		emptyStateMessage?: string | null;
		isRoomLoading?: boolean;
		/** Set only by the route's failure path; never reuses the empty-state slot. */
		loadError?: string | null;
		/**
		 * The streamed room payload. Owning the await here — instead of branching
		 * three `<GalleryExplorationPage>` instances around it in the route — is
		 * what keeps one instance alive across the skeleton→room hand-off, so the
		 * entry fade, the layout bindings and the detail state survive it.
		 */
		roomContent?: Promise<GalleryRoomContent> | null;
		fetchRandomArtwork?: () => Promise<Artwork>;
		loadMoreArtworks?: (request: GalleryDiscoveryRequest & { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		loadArtworkDetail?: (artworkId: string) => Promise<Artwork>;
		realtimeConfig?: { anonKey: string | null; url: string | null };
		room: GalleryRoomConfig;
		roomId: GalleryRoomId;
		viewer?: Viewer | null;
	} = $props();

	const galleryLayout = getGalleryLayoutContext();
	const revealedArtworkIds = galleryLayout?.revealedArtworkIds ?? writable(new Set<string>());

	// Values deliberately frozen at construction (the realtime channel is opened
	// once for the viewer that mounted the page); the IIFE keeps them out of the
	// reactive graph without tripping `state_referenced_locally`.
	const { initialArtworks, initialRealtimeConfig, initialRoomContent, initialViewer } = (() => ({
		initialArtworks: $state.snapshot(routeArtworks),
		initialRealtimeConfig: $state.snapshot(realtimeConfig),
		initialRoomContent: roomContent,
		initialViewer: $state.snapshot(viewer)
	}))();

	// --- Streamed room content ---------------------------------------------
	// The template awaits the same promise so SvelteKit still streams the room
	// HTML; this seeder is what feeds the script-level state (notes, panel
	// bindings, the seed each room reconciles against). The rejection handler is
	// attached at init, not in onMount: without the route's `{:catch}` a streamed
	// failure would otherwise surface as an unhandled rejection.
	let streamedContent = $state<GalleryRoomContent | null>(null);
	let streamFailed = $state(false);

	const seedFromStream = (pending: Promise<GalleryRoomContent>) => {
		let isCurrent = true;

		void pending.then(
			(content) => {
				if (!isCurrent) return;
				streamedContent = content;
				streamFailed = false;
			},
			() => {
				if (!isCurrent) return;
				streamFailed = true;
			}
		);

		return () => {
			isCurrent = false;
		};
	};

	// The first promise is claimed at construction so a rejection is handled
	// before anything can report it as unhandled; the room can still be torn
	// down before it settles, so the seeder is released on destroy.
	const disposeInitialSeed = initialRoomContent ? seedFromStream(initialRoomContent) : null;
	$effect(() => () => disposeInitialSeed?.());

	// A refresh hands over a new promise; the room goes back to its skeleton
	// while it settles, exactly as the template's await block does.
	$effect.pre(() => {
		const pending = roomContent;
		if (!pending || pending === initialRoomContent) return;

		streamedContent = null;
		streamFailed = false;

		return seedFromStream(pending);
	});

	const seedArtworks = $derived(roomContent ? (streamedContent?.artworks ?? []) : routeArtworks);
	const seedDiscovery = $derived<GalleryDiscovery>(
		roomContent
			? (streamedContent?.discovery ?? {
					pageInfo: { hasMore: false, nextCursor: null },
					request: null
				})
			: routeDiscovery
	);
	const roomEmptyStateMessage = $derived(
		roomContent ? (streamedContent?.emptyStateMessage ?? null) : emptyStateMessage
	);
	const isRoomBusy = $derived(
		roomContent ? streamedContent === null && !streamFailed : isRoomLoading
	);

	let artworks = $state<Artwork[]>(initialRoomContent ? [] : initialArtworks);

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	let isSavingAdultContentPreference = $state(false);
	let selectedArtwork = $state<Artwork | null>(null);
	let isHydratingDetail = $state(false);
	let detailErrorMessage = $state<string | null>(null);
	const enteredFromHome = browser ? $page.url?.searchParams?.get('from') === 'home' : false;
	let showEntryFade = $state(enteredFromHome);
	let showExitFade = $state(false);
	let isExitingToHome = $state(false);
	let isRefreshingGallery = $state(false);
	let detailOrigin = $state<GalleryDetailHistoryState['source'] | null>(null);
	let didCreateLocalDetailHistoryEntry = $state(false);
	let detailLoadSequence = 0;

	const selectedArtworkId = $derived(selectedArtwork?.id ?? null);
	const adultContentAllowed = $derived(
		adultContentPreferenceOverride ??
			(roomContent ? (streamedContent?.adultContentEnabled ?? false) : adultContentEnabled)
	);
	const hasSensitiveArtwork = $derived(
		artworks.some((artwork) => artwork.isNsfw) || Boolean(selectedArtwork?.isNsfw)
	);
	const showSensitiveArtworkNote = $derived(hasSensitiveArtwork && roomId !== 'your-studio');
	const currentGalleryUrl = $derived(
		roomId === 'hall-of-fame' ? resolve('/gallery') : resolve('/gallery/[room]', { room: roomId })
	);
	const historyDetailState = $derived(readGalleryDetailHistoryState($page.state));

	// --- Reseed artworks from route data on navigation ---
	$effect(() => {
		artworks = seedArtworks;
	});

	// --- Room-scoped loadMoreArtworks that binds discovery request context ---
	const roomLoadMoreArtworks = $derived.by(() => {
		const request = seedDiscovery.request;
		if (!request) return undefined;
		return async (params: { cursor: string }) => {
			return loadMoreArtworks({ ...request, cursor: params.cursor });
		};
	});

	// --- Detail panel ---
	const detailPrefetcher = createDetailPrefetcher((artworkId: string) =>
		loadArtworkDetail(artworkId)
	);

	/** Fired from a card's pointerdown/keydown, ~100ms ahead of its click. */
	const prefetchArtworkDetail = (artworkId: string) => {
		detailPrefetcher.prefetch(artworkId);
	};

	const loadArtworkFromHistoryState = async (historyState: GalleryDetailHistoryState) => {
		const requestSequence = ++detailLoadSequence;
		detailErrorMessage = null;

		// Open the panel instantly with the room copy of the artwork; the full
		// detail (fresh votes, comments) hydrates in place once fetched.
		const roomArtwork = artworks.find((candidate) => candidate.id === historyState.artworkId);

		if (selectedArtwork?.id !== historyState.artworkId) {
			if (roomArtwork) {
				selectedArtwork = roomArtwork;
				detailOrigin = historyState.source;
			}
		}
		isHydratingDetail = true;

		try {
			const nextArtwork = await detailPrefetcher.load(historyState.artworkId);
			if (requestSequence !== detailLoadSequence) return;

			// `rank` is a room position computed by the room loader, not a property
			// of the artwork, so the detail endpoint does not return it. Without
			// this the Hall of Fame medal appears with the room copy and then
			// vanishes the moment the detail lands.
			selectedArtwork = roomArtwork?.rank
				? { ...nextArtwork, rank: roomArtwork.rank }
				: nextArtwork;
			detailOrigin = historyState.source;
		} catch (error) {
			if (requestSequence !== detailLoadSequence) return;

			selectedArtwork = null;
			detailOrigin = null;
			detailErrorMessage = error instanceof Error ? error.message : ARTWORK_DETAIL_ERROR_MESSAGE;

			const currentHistoryState = readGalleryDetailHistoryState($page.state);
			if (
				browser &&
				currentHistoryState?.artworkId === historyState.artworkId &&
				currentHistoryState.roomId === historyState.roomId
			) {
				didCreateLocalDetailHistoryEntry = false;
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- path is already resolved in currentGalleryUrl
				replaceState(currentGalleryUrl, clearGalleryDetailHistoryState($page.state));
			}
		} finally {
			if (requestSequence === detailLoadSequence) {
				isHydratingDetail = false;
			}
		}
	};

	const openArtwork = (artwork: Artwork) => {
		detailErrorMessage = null;
		didCreateLocalDetailHistoryEntry = true;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- path is already resolved in currentGalleryUrl
		pushState(currentGalleryUrl, {
			...$page.state,
			galleryDetail: {
				artworkId: artwork.id,
				roomId,
				source: LOCAL_GALLERY_DETAIL_SOURCE
			}
		});
	};

	const closeArtworkDetail = () => {
		detailErrorMessage = null;
		detailLoadSequence += 1;
		isHydratingDetail = false;

		const currentHistoryState = readGalleryDetailHistoryState($page.state);

		if (
			browser &&
			currentHistoryState?.roomId === roomId &&
			currentHistoryState.source === LOCAL_GALLERY_DETAIL_SOURCE &&
			didCreateLocalDetailHistoryEntry
		) {
			didCreateLocalDetailHistoryEntry = false;
			window.history.back();
			return;
		}

		if (browser && currentHistoryState) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- path is already resolved in currentGalleryUrl
			replaceState(currentGalleryUrl, clearGalleryDetailHistoryState($page.state));
		}

		selectedArtwork = null;
		detailOrigin = null;
	};

	/*
	 * The detail panel used to render its own failure notice twice — once per
	 * postcard face — so a message written on the front vanished the moment the
	 * card flipped. It now hands every transient outcome up here instead, and it
	 * lands in the same single status region the room's own failures use.
	 */
	const notifyFromPanel = (message: string) => {
		detailErrorMessage = message;
	};

	const syncArtwork = (nextArtwork: Artwork) => {
		selectedArtwork = nextArtwork;
		const index = artworks.findIndex((candidate) => candidate.id === nextArtwork.id);
		if (index === -1) return;

		artworks = artworks.map((candidate, candidateIndex) =>
			candidateIndex === index
				? {
						...candidate,
						commentCount: nextArtwork.commentCount,
						comments: nextArtwork.comments,
						downvotes: nextArtwork.downvotes,
						forkCount: nextArtwork.forkCount,
						score: nextArtwork.score,
						upvotes: nextArtwork.upvotes,
						viewerVote: nextArtwork.viewerVote
					}
				: candidate
		);
	};

	const patchArtwork = (
		artworkId: string,
		patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
	) => {
		if (selectedArtwork?.id === artworkId) {
			selectedArtwork = { ...selectedArtwork, ...patch };
		}

		artworks = artworks.map((candidate) =>
			candidate.id === artworkId ? { ...candidate, ...patch } : candidate
		);
	};

	const updateAdultContentPreference = async (enabled: boolean) => {
		if (!viewer || isSavingAdultContentPreference) {
			detailErrorMessage = 'Sign in to manage 18+ artwork visibility.';
			return;
		}

		isSavingAdultContentPreference = true;
		detailErrorMessage = null;

		try {
			await setAdultContentEnabled(enabled);
			adultContentPreferenceOverride = enabled;
		} catch (error) {
			detailErrorMessage =
				error instanceof Error ? error.message : '18+ artwork preference could not be updated.';
		} finally {
			isSavingAdultContentPreference = false;
		}
	};

	// --- Realtime subscription ---
	const realtime =
		browser && initialViewer && initialRealtimeConfig.url && initialRealtimeConfig.anonKey
			? createRealtimeSubscription({
					getRealtimeClient: () =>
						getBrowserRealtimeClient(initialRealtimeConfig.url!, initialRealtimeConfig.anonKey!),
					fetchToken: async () =>
						requestJson<{ expiresAt?: string; token: string }>('/api/realtime/token').catch(
							() => null
						),
					viewerId: initialViewer.id,
					onRefresh: (artworkId: string) => {
						void refreshSelectedArtwork(artworkId);
					}
				})
			: null;

	const refreshSelectedArtwork = async (artworkId: string) => {
		try {
			const refreshedArtwork = await loadArtworkDetail(artworkId);
			if (selectedArtwork?.id === artworkId) {
				detailErrorMessage = null;
				syncArtwork(refreshedArtwork);
			}
		} catch (error) {
			if (selectedArtwork?.id === artworkId) {
				detailErrorMessage = error instanceof Error ? error.message : ARTWORK_DETAIL_ERROR_MESSAGE;
			}
		}
	};

	$effect(() => {
		const artworkId = selectedArtworkId;

		if (!browser || !realtime) return;

		if (!artworkId) {
			realtime.stop();
			return;
		}

		void realtime.start(artworkId);

		return () => {
			realtime.stop();
		};
	});

	$effect(() => {
		const currentHistoryState = historyDetailState;
		const galleryUrl = currentGalleryUrl;

		if (!browser) return;

		if (currentHistoryState && currentHistoryState.roomId !== roomId) {
			detailLoadSequence += 1;
			isHydratingDetail = false;
			didCreateLocalDetailHistoryEntry = false;
			selectedArtwork = null;
			detailOrigin = null;
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- path is already resolved in currentGalleryUrl
			replaceState(galleryUrl, clearGalleryDetailHistoryState($page.state));
			return;
		}

		if (!currentHistoryState) {
			detailLoadSequence += 1;
			isHydratingDetail = false;
			didCreateLocalDetailHistoryEntry = false;

			if (selectedArtwork || detailOrigin) {
				selectedArtwork = null;
				detailOrigin = null;
			}

			return;
		}

		if (selectedArtwork?.id === currentHistoryState.artworkId) {
			detailOrigin = currentHistoryState.source;
			return;
		}

		void loadArtworkFromHistoryState(currentHistoryState);
	});

	// --- Transitions ---
	const handleBackToHome = (event: MouseEvent) => {
		if (!viewer) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (isExitingToHome) return;
		isExitingToHome = true;
		showExitFade = true;
	};

	const completeExitToHome = () => {
		const url = `${resolve('/')}?from=gallery`;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- URL is already resolved and extended with query params
		void goto(url);
	};

	const refreshGallery = async () => {
		if (isRefreshingGallery) {
			return;
		}

		isRefreshingGallery = true;
		detailErrorMessage = null;
		// A refresh is a request for fresh data: the room is about to remount
		// around the new stream, and the feed it hands over on the way out must
		// not come back over the top of it.
		suppressNextRoomFeedSnapshot(roomId);
		detailPrefetcher.clear();

		try {
			await invalidateAll();
		} catch (error) {
			detailErrorMessage =
				error instanceof Error ? error.message : 'Gallery could not be refreshed.';
		} finally {
			isRefreshingGallery = false;
		}
	};

	// --- Clean home return query param ---
	onMount(() => {
		if (!enteredFromHome) return;

		if (roomId === 'hall-of-fame') {
			replaceState(resolve('/gallery'), window.history.state);
		} else {
			replaceState(resolve('/gallery/[room]', { room: roomId }), window.history.state);
		}
	});

	/*
	 * The grey overlay carried over from the home page used to be dropped in
	 * `onMount`, which — with the route branching three page instances around
	 * the stream — meant it dissolved over the loading skeleton belonging to an
	 * instance that was about to be thrown away. Hold it until the room content
	 * is actually on screen.
	 */
	$effect(() => {
		if (isRoomBusy) return;
		showEntryFade = false;
	});

	/** ...but never hold the page hostage to a slow or failed stream. */
	const ENTRY_FADE_MAX_HOLD_MS = 1500;
	$effect(() => {
		if (!enteredFromHome) return;

		const timer = setTimeout(() => {
			showEntryFade = false;
		}, ENTRY_FADE_MAX_HOLD_MS);

		return () => clearTimeout(timer);
	});

	// --- Empty state ---
	const roomNoteClassNames: Record<GalleryRoomId, string> = {
		'hall-of-fame': '',
		'hot-wall': '',
		mystery: '',
		'your-studio': ''
	};
	const showEmptyState = $derived(Boolean(roomEmptyStateMessage) && roomId !== 'hot-wall');
	const emptyStateSupportMessage = $derived.by(() => {
		if (viewer && roomId === 'your-studio') {
			return 'Publish a new piece from the studio and it will show up here.';
		}

		if (viewer) {
			return 'Publish a new piece from the studio to start climbing the gallery walls.';
		}

		return 'New pieces will appear here as artists publish them.';
	});

	$effect(() => {
		if (!galleryLayout) return;

		/*
		 * Ownership, not lifecycle. The room lives inside the layout's
		 * `{#key roomId}` block, whose out-transition defers this teardown ~225ms
		 * — long after the incoming room has published its own handlers into the
		 * same stores. Clearing unconditionally therefore erased the live room's
		 * bindings: Refresh became a no-op that still looked enabled, Back lost
		 * its fade to the home page, and the detail panel unmounted entirely.
		 */
		const actions = {
			isRefreshingGallery,
			onBack: handleBackToHome,
			onRefresh: refreshGallery
		};

		const panel = {
			adultContentEnabled: adultContentAllowed,
			artwork: selectedArtwork,
			isHydratingDetail,
			onAdultContentToggle: updateAdultContentPreference,
			onArtworkChange: syncArtwork,
			onArtworkPatch: patchArtwork,
			onClose: closeArtworkDetail,
			onNotify: notifyFromPanel,
			revealedArtworkIds,
			viewer
		};

		galleryLayout.actionBindings.set(actions);
		galleryLayout.panelBindings.set(panel);

		return () => {
			if (get(galleryLayout.actionBindings) === actions) galleryLayout.actionBindings.set(null);
			if (get(galleryLayout.panelBindings) === panel) galleryLayout.panelBindings.set(null);
		};
	});
</script>

{#snippet roomLoadFailure(message: string)}
	<div
		class="rounded-xl border-4 border-ink-warm bg-paper-bright p-10 text-center shadow-md"
		data-testid="gallery-room-error"
	>
		<p class="font-display text-2xl text-ink-warm">Something went wrong</p>
		<p class="mt-3 text-ink-faint">{message}</p>
		<button
			class="mt-6 rounded-full border-3 border-ink-warm bg-[#f6df65] px-5 py-2 text-sm font-black text-ink-warm transition hover:-translate-y-0.5 disabled:opacity-60"
			disabled={isRefreshingGallery}
			onclick={() => refreshGallery()}
			type="button"
		>
			{isRefreshingGallery ? 'Retrying…' : 'Try again'}
		</button>
	</div>
{/snippet}

{#snippet roomBody()}
	{#if showEmptyState}
		<div
			class="rounded-xl border-4 border-dashed border-olive bg-paper-bright p-10 text-center shadow-md"
		>
			<p class="font-display text-2xl text-ink-warm">{roomEmptyStateMessage}</p>
			<p class="mt-3 text-ink-faint">
				{emptyStateSupportMessage}
			</p>
			{#if !viewer}
				<div class="mt-6 flex justify-center">
					<GameLink href="/" variant="primary" size="sm">
						<span class="font-semibold">Join &amp; draw</span>
					</GameLink>
				</div>
			{/if}
		</div>
	{:else if roomId === 'hall-of-fame'}
		<HallOfFameRoom
			{artworks}
			pageInfo={seedDiscovery.pageInfo}
			adultContentEnabled={adultContentAllowed}
			feedCacheKey={roomId}
			loadMoreArtworks={roomLoadMoreArtworks}
			onPrefetch={prefetchArtworkDetail}
			onSelect={openArtwork}
			{revealedArtworkIds}
			viewerId={viewer?.id ?? null}
		/>
	{:else if roomId === 'hot-wall'}
		<HotWallRoom
			{artworks}
			pageInfo={seedDiscovery.pageInfo}
			adultContentEnabled={adultContentAllowed}
			feedCacheKey={roomId}
			loadMoreArtworks={roomLoadMoreArtworks}
			onPrefetch={prefetchArtworkDetail}
			onSelect={openArtwork}
			{revealedArtworkIds}
			viewerId={viewer?.id ?? null}
		/>
	{:else if roomId === 'mystery' && artworks.length > 0}
		<MysteryRoom
			{artworks}
			pageInfo={seedDiscovery.pageInfo}
			adultContentEnabled={adultContentAllowed}
			feedCacheKey={roomId}
			loadMoreArtworks={roomLoadMoreArtworks}
			{fetchRandomArtwork}
			onSelect={openArtwork}
			{revealedArtworkIds}
			viewerId={viewer?.id ?? null}
		/>
	{:else if roomId === 'your-studio'}
		<YourStudioRoom
			{artworks}
			pageInfo={seedDiscovery.pageInfo}
			adultContentEnabled={adultContentAllowed}
			feedCacheKey={roomId}
			loadMoreArtworks={roomLoadMoreArtworks}
			onPrefetch={prefetchArtworkDetail}
			onSelect={openArtwork}
			viewerId={viewer?.id ?? null}
		/>
	{/if}
{/snippet}

<div class="relative z-10" data-testid="gallery-room-content">
	<div
		class="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8"
	>
		{#if roomId === 'your-studio'}
			<div class="mb-4 flex justify-start md:mb-6" data-testid="your-studio-room-note-flow">
				<PostItNote
					attachment={room.postItAttachment}
					className={roomNoteClassNames[roomId]}
					color={room.postItColor}
					label={room.name}
					seedKey={room.id}
					text={room.description}
				/>
			</div>
		{:else}
			<div
				class="pointer-events-none mb-4 flex justify-center md:absolute md:top-5 md:-left-16 md:z-25 md:mb-0 md:rotate-[-20deg] md:justify-start"
				data-testid="gallery-room-note"
			>
				<PostItNote
					attachment={room.postItAttachment}
					className={roomNoteClassNames[roomId]}
					color={room.postItColor}
					label={room.name}
					seedKey={room.id}
					text={room.description}
				/>
			</div>
		{/if}

		{#if showSensitiveArtworkNote}
			<div
				class="pointer-events-none mb-4 flex justify-center md:mb-6 md:rotate-14 md:justify-end lg:absolute lg:top-20 lg:right-0 lg:z-26 lg:mb-0 xl:right-[max(-17.5rem,calc((80rem-100vw)/2))]"
			>
				<PostItNote
					attachment="tape"
					className="pointer-events-auto"
					color="linear-gradient(160deg, #fef49c 0%, #f1df77 100%)"
					label="18+ artworks"
					seedKey={`gallery-sensitive-${roomId}`}
					text={adultContentAllowed
						? 'Sensitive artworks are visible on this account.'
						: 'Sensitive artworks stay blurred until you opt in.'}
				>
					{#if viewer}
						<button
							type="button"
							class="w-full rounded-card border-3 border-ink-warm bg-[#fff7d4] px-4 py-2 text-sm font-black text-ink-warm shadow-[2px_3px_0_rgba(45,36,32,0.18)] transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
							disabled={isSavingAdultContentPreference}
							onclick={() => updateAdultContentPreference(!adultContentAllowed)}
						>
							{adultContentAllowed ? 'Hide 18+ artworks' : 'Reveal 18+ artworks'}
						</button>
					{:else}
						<p class="text-xs font-semibold text-rust">Sign in to reveal 18+ artworks.</p>
					{/if}
				</PostItNote>
			</div>
		{/if}

		<div class="space-y-5 md:space-y-6">
			{#if roomContent}
				{#await roomContent}
					<RoomLoadingSkeleton {roomId} />
				{:then}
					{@render roomBody()}
				{:catch}
					{@render roomLoadFailure(ROOM_LOAD_ERROR_MESSAGE)}
				{/await}
			{:else if loadError}
				{@render roomLoadFailure(loadError)}
			{:else if isRoomLoading}
				<RoomLoadingSkeleton {roomId} />
			{:else}
				{@render roomBody()}
			{/if}
		</div>
	</div>
</div>

<!-- Transient outcomes announce themselves instead of shoving the room down. -->
<GalleryStatusRegion message={detailErrorMessage} onDismiss={() => (detailErrorMessage = null)} />

<!-- Arriving from the home page: the veil the home page dropped, lifting. -->
<PageFadeOverlay direction="out" visible={showEntryFade} />

<!-- Leaving for it: the veil drops, and navigation waits for it to be down. -->
<PageFadeOverlay direction="in" onComplete={completeExitToHome} visible={showExitFade} />
