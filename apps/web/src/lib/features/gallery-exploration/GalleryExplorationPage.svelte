<script lang="ts">
	import { Brush } from 'lucide-svelte';
	import { browser } from '$app/env';
	import { goto, refreshAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { get } from 'svelte/store';
	import { prefersReducedMotion } from 'svelte/motion';
	import { apiErrorMessage, requestJson } from '#lib/client/api.js';
	import { setAdultContentEnabled } from '#lib/client/avatar-upload.js';
	import { getGalleryLayoutContext } from '#lib/features/gallery-exploration/gallery-layout-context.js';
	import { onMount, untrack } from 'svelte';
	import { writable } from 'svelte/store';
	import {
		artworkEngagement,
		type Artwork
	} from '#lib/features/artwork-presentation/model/artwork.js';
	import {
		toGalleryArtwork,
		toGalleryArtworkDetail,
		toGalleryComments
	} from '#lib/features/gallery-exploration/gallery-adapter.js';
	import { createDetailPrefetcher } from '#lib/features/gallery-exploration/detail-prefetch.js';
	import {
		galleryRoomDiscoveryRequest,
		type GalleryArtworkPage,
		type GalleryDiscovery,
		type GalleryDiscoveryRequest,
		type GalleryRoomContent
	} from '#lib/features/gallery-exploration/model/discovery.js';
	import {
		patchCachedArtwork,
		readRoomFeedSnapshot,
		suppressNextRoomFeedSnapshot
	} from '#lib/features/gallery-exploration/model/feed-cache.js';
	import {
		type GalleryRoomConfig,
		type GalleryRoomId
	} from '#lib/features/gallery-exploration/model/rooms.js';
	import { applyArtworkLiveChange } from '#lib/features/gallery-exploration/artwork-live-change.js';
	import { createArtworkLiveUpdates } from '#lib/features/gallery-exploration/artwork-live-updates.js';
	import type { Viewer } from '#lib/shared/viewer.js';
	import PostItNote from '#lib/features/shared-ui/components/PostItNote.svelte';
	import GameLink from '#lib/features/shared-ui/components/GameLink.svelte';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import ChalkEasel from '#lib/features/gallery-exploration/components/ChalkEasel.svelte';
	import ReservedSpot from '#lib/features/gallery-exploration/components/ReservedSpot.svelte';
	import PageFadeOverlay from '#lib/features/shared-ui/components/PageFadeOverlay.svelte';
	import GalleryStatusRegion from '#lib/features/gallery-exploration/components/GalleryStatusRegion.svelte';
	import RoomLoadingSkeleton from '#lib/features/gallery-exploration/components/RoomLoadingSkeleton.svelte';
	import HallOfFameRoom from '#lib/features/gallery-exploration/rooms/HallOfFameRoom.svelte';
	import type { AwardStyle } from '#lib/features/shared-ui/award-style.js';
	import HotWallRoom from '#lib/features/gallery-exploration/rooms/HotWallRoom.svelte';
	import MysteryRoom from '#lib/features/gallery-exploration/rooms/MysteryRoom.svelte';
	import YourStudioRoom from '#lib/features/gallery-exploration/rooms/YourStudioRoom.svelte';

	type GalleryDetailHistoryState = NonNullable<App.PageState['galleryDetail']>;

	type NewArtworksCheck = { count: number; preview: Artwork | null };

	const LOCAL_GALLERY_DETAIL_SOURCE = 'local-room-selection' as const;

	// Chalked under "This room is still being hung." on the easel.
	const ROOM_LOAD_ERROR_MESSAGE = 'Give it a moment, then try again.';

	const ROOM_REFRESH_ERROR_MESSAGE =
		"Couldn't check this room for new pieces. What's up may be a little old.";

	/*
	 * The house copy for a failed API call. `apiErrorMessage` prefers the
	 * server's own `{ code, message }` when the answer really was this API
	 * explaining itself to a visitor (a rate limit, a rejected cursor) and keeps
	 * these strings for a 500, a proxy's HTML page or a dropped connection.
	 */
	const GALLERY_DISCOVERY_ERROR_MESSAGE = 'Give it a moment, then try again.';
	const ARTWORK_DETAIL_ERROR_MESSAGE = "Couldn't open that one. Tap it again?";
	const GALLERY_REFRESH_ERROR_MESSAGE =
		"Couldn't check for new pieces just now. Try again in a moment.";
	const ADULT_PREFERENCE_ERROR_MESSAGE = "Your 18+ setting didn't save. Try again in a moment.";

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
				requestJson<{ comments: Parameters<typeof toGalleryComments>[0] }>(
					`/api/artworks/${artworkId}/comments`
				).catch(() => null)
			]);

			const detail = toGalleryArtworkDetail(payload.artwork);

			if (!commentsPayload) {
				return detail;
			}

			return { ...detail, comments: toGalleryComments(commentsPayload.comments) };
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
		viewer = null,
		awardStyle = 'stamps',
		checkForNewArtworks,
		newArtworkCheckMs = 60_000

		/** Set only by the route's failure path; never reuses the empty-state slot. */
		/**
		 * The streamed room payload. Owning the await here — instead of branching
		 * three `<GalleryExplorationPage>` instances around it in the route — is
		 * what keeps one instance alive across the skeleton→room hand-off, so the
		 * entry fade, the layout bindings and the detail state survive it.
		 */
	}: {
		adultContentEnabled?: boolean;
		artworks?: Artwork[];
		discovery?: GalleryDiscovery;
		emptyStateMessage?: string | null;
		isRoomLoading?: boolean;
		loadError?: string | null;
		roomContent?: Promise<GalleryRoomContent> | null;
		fetchRandomArtwork?: () => Promise<Artwork>;
		loadMoreArtworks?: (request: GalleryDiscoveryRequest & { cursor: string }) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		loadArtworkDetail?: (artworkId: string) => Promise<Artwork>;
		room: GalleryRoomConfig;
		roomId: GalleryRoomId;
		viewer?: Viewer | null;
		/** The Hall of Fame's award style, drawn once per visit to the gallery. */
		awardStyle?: AwardStyle;
		/**
		 * How many pieces are up that are not on the wall yet, and the newest of
		 * them. Reads the room's own first page unless a caller supplies one.
		 */
		checkForNewArtworks?: (knownIds: string[]) => Promise<NewArtworksCheck>;
		/** How often the room looks for new pieces while it is on screen. */
		newArtworkCheckMs?: number;
	} = $props();

	const galleryLayout = getGalleryLayoutContext();
	const revealedArtworkIds = galleryLayout?.revealedArtworkIds ?? writable(new Set<string>());

	// Deliberately frozen at construction; the IIFE keeps it out of the reactive
	// graph without tripping `state_referenced_locally`.
	const { initialRoomContent, rememberedSeed } = (() => ({
		initialRoomContent: roomContent,
		rememberedSeed: roomContent ? (readRoomFeedSnapshot(roomId)?.seed ?? null) : null
	}))();

	/*
	 * The first page the room shows while its stream is on the way, when it
	 * already has one to show: a room the visitor walked through before goes
	 * straight back up as it was left, and a room handed its own stream again
	 * (a navigation that lands where the visitor already is) stays as it is.
	 * Either way the fresh page merges in when it lands.
	 */
	let heldSeed = $state<GalleryArtworkPage | null>(rememberedSeed);

	// --- Streamed room content ---------------------------------------------
	// This seeder is what feeds both the template and the script-level state
	// (notes, panel bindings, the seed each room reconciles against). The
	// template draws from that state rather than awaiting the promise itself,
	// so a remembered room stays in one branch across its fresh page landing.
	// The rejection handler is attached at init, not in onMount, so a streamed
	// failure never surfaces as an unhandled rejection.
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
				// The room stays up as it was left; the visitor is told it may
				// be stale rather than having it taken off the wall.
				if (isSeedRemembered) detailErrorMessage = ROOM_REFRESH_ERROR_MESSAGE;
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

	// What is on the wall now, read before a new stream replaces it.
	let seedOnWall: GalleryArtworkPage | null = null;

	// A new promise for this room: a refresh is the visitor asking for fresh
	// data, and the room goes back to its skeleton while it settles; any other
	// keeps what is on the wall until the fresh page lands.
	$effect.pre(() => {
		const pending = roomContent;
		if (!pending || pending === initialRoomContent) return;

		untrack(() => {
			heldSeed = isRefreshingGallery ? null : seedOnWall;
			streamedContent = null;
			streamFailed = false;
		});

		return seedFromStream(pending);
	});

	const isSeedRemembered = $derived(heldSeed !== null && streamedContent === null);

	const seedArtworks = $derived(
		roomContent
			? (streamedContent?.artworks ?? (isSeedRemembered ? heldSeed!.artworks : []))
			: routeArtworks
	);

	const seedDiscovery = $derived<GalleryDiscovery>(
		roomContent
			? (streamedContent?.discovery ?? {
					pageInfo: isSeedRemembered ? heldSeed!.pageInfo : { hasMore: false, nextCursor: null },
					request: galleryRoomDiscoveryRequest(roomId, viewer?.id ?? null)
				})
			: routeDiscovery
	);

	const roomEmptyStateMessage = $derived(
		roomContent ? (streamedContent?.emptyStateMessage ?? null) : emptyStateMessage
	);

	// A room on the wall is not loading, even while its fresh page streams.
	const isRoomBusy = $derived(
		roomContent ? streamedContent === null && !streamFailed && !isSeedRemembered : isRoomLoading
	);

	// Reseeds from route data on navigation; votes and comment counts patch it
	// locally in between.
	let artworks = $derived<Artwork[]>(seedArtworks);

	$effect(() => {
		if (seedArtworks.length === 0) return;
		seedOnWall = {
			artworks: $state.snapshot(seedArtworks),
			pageInfo: $state.snapshot(seedDiscovery.pageInfo)
		};
	});

	/*
	 * What the room tells a screen reader while it streams.
	 *
	 * The text belongs here rather than in the skeleton because the skeleton is
	 * mounted and unmounted whole by the `{#await}` below: a live region that
	 * appears together with its message is announced unreliably, and it takes
	 * its terminal message down with it before anything can read it. The region
	 * that carries this lives in the room shell and outlives every branch.
	 */
	let roomStatusMessage = $state('');
	let wasRoomBusy = false;

	$effect(() => {
		const isBusy = isRoomBusy;
		const hasFailed = streamFailed || Boolean(loadError);
		// The seed, not the room's own `artworks`: that one is filled by its own
		// effect, which has not run yet when this one settles.
		const count = seedArtworks.length;

		if (isBusy) {
			wasRoomBusy = true;
			roomStatusMessage = 'Loading artworks…';
			return;
		}

		// Nothing was ever awaited (route data arrived with the page): announcing
		// a count nobody waited for is noise.
		if (!wasRoomBusy) return;
		wasRoomBusy = false;

		// A failure announces itself from the alert below; saying both would
		// queue two messages for one event.
		roomStatusMessage = hasFailed
			? ''
			: count === 0
				? 'This room is empty.'
				: `${count} artworks loaded.`;
	});

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	let isSavingAdultContentPreference = $state(false);
	let selectedArtwork = $state<Artwork | null>(null);
	let isHydratingDetail = $state(false);
	let detailErrorMessage = $state<string | null>(null);

	const enteredFromHome = browser ? page.url?.searchParams?.get('from') === 'home' : false;

	let showEntryFade = $state(enteredFromHome);
	let showExitFade = $state(false);
	let isExitingToHome = $state(false);
	let isRefreshingGallery = $state(false);
	let detailOrigin = $state<GalleryDetailHistoryState['source'] | null>(null);
	let didCreateLocalDetailHistoryEntry = $state(false);
	let detailLoadSequence = 0;

	const selectedArtworkId = $derived(selectedArtwork?.id ?? null);

	// Until the stream lands, the preference the page was handed (the root
	// layout reads it for every request) stands in for the stream's copy.
	const adultContentAllowed = $derived(
		adultContentPreferenceOverride ??
			(roomContent
				? (streamedContent?.adultContentEnabled ?? adultContentEnabled)
				: adultContentEnabled)
	);

	const hasSensitiveArtwork = $derived(
		artworks.some((artwork) => artwork.isNsfw) || Boolean(selectedArtwork?.isNsfw)
	);
	const showSensitiveArtworkNote = $derived(hasSensitiveArtwork && roomId !== 'your-studio');
	const currentGalleryUrl = $derived(
		roomId === 'hall-of-fame'
			? resolve('/gallery/[[room]]', {})
			: resolve('/gallery/[[room]]', { room: roomId })
	);

	const historyDetailState = $derived(readGalleryDetailHistoryState(page.state));

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

			const currentHistoryState = readGalleryDetailHistoryState(page.state);

			if (
				browser &&
				currentHistoryState?.artworkId === historyState.artworkId &&
				currentHistoryState.roomId === historyState.roomId
			) {
				didCreateLocalDetailHistoryEntry = false;

				goto(currentGalleryUrl, {
					shallow: true,
					replace: true,
					state: clearGalleryDetailHistoryState(page.state)
				});
			}
		} finally {
			if (requestSequence === detailLoadSequence) {
				isHydratingDetail = false;
			}
		}
	};

	// The address bar names the artwork while it is open, so a copied link or a
	// reload lands on its permalink; the room stays mounted underneath.
	const openArtwork = (artwork: Artwork) => {
		detailErrorMessage = null;
		didCreateLocalDetailHistoryEntry = true;

		goto(resolve('/artwork/[artworkId]', { artworkId: artwork.id }), {
			shallow: true,
			state: {
				...page.state,
				galleryDetail: {
					artworkId: artwork.id,
					roomId,
					source: LOCAL_GALLERY_DETAIL_SOURCE
				}
			}
		});
	};

	const closeArtworkDetail = () => {
		// The message deliberately outlives the panel: a failure raised on the
		// last click (a vote that did not land, a comment that bounced) is what
		// the visitor is closing the postcard to go and read. The region retires
		// it on its own timer.
		detailLoadSequence += 1;
		isHydratingDetail = false;

		const currentHistoryState = readGalleryDetailHistoryState(page.state);

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
			goto(currentGalleryUrl, {
				shallow: true,
				replace: true,
				state: clearGalleryDetailHistoryState(page.state)
			});
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
	const notifyFromPanel = (message: string | null) => {
		detailErrorMessage = message;
	};

	const syncArtwork = (nextArtwork: Artwork) => {
		selectedArtwork = nextArtwork;
		const engagement = artworkEngagement(nextArtwork);
		patchCachedArtwork(nextArtwork.id, engagement);

		const index = artworks.findIndex((candidate) => candidate.id === nextArtwork.id);
		if (index === -1) return;

		artworks = artworks.map((candidate, candidateIndex) =>
			candidateIndex === index ? { ...candidate, ...engagement } : candidate
		);
	};

	const patchArtwork = (
		artworkId: string,
		patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
	) => {
		if (selectedArtwork?.id === artworkId) {
			selectedArtwork = { ...selectedArtwork, ...patch };
		}
		patchCachedArtwork(artworkId, patch);

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
			detailErrorMessage = error instanceof Error ? error.message : ADULT_PREFERENCE_ERROR_MESSAGE;
		} finally {
			isSavingAdultContentPreference = false;
		}
	};

	// --- Live updates ---
	// Signed in or not, whoever has an artwork open sees its votes and comments
	// change as they happen. A change carries its data; only one that does not
	// (a comment taken down, a reconnect) reads the artwork again.
	const realtime = browser
		? createArtworkLiveUpdates({
				onChange: (artworkId, change) => {
					const patched =
						change && selectedArtwork?.id === artworkId
							? applyArtworkLiveChange(selectedArtwork, change)
							: null;

					if (!patched) {
						void refreshSelectedArtwork(artworkId);
					} else if (patched !== selectedArtwork) {
						syncArtwork(patched);
					}
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

		realtime.start(artworkId);

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

			goto(galleryUrl, {
				shallow: true,
				replace: true,
				state: clearGalleryDetailHistoryState(page.state)
			});

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
			await refreshAll();
		} catch (error) {
			detailErrorMessage = error instanceof Error ? error.message : GALLERY_REFRESH_ERROR_MESSAGE;
		} finally {
			isRefreshingGallery = false;
		}
	};

	// --- New pieces ---
	// The room re-reads its own first page now and then while it is on screen,
	// and counts what is not on the wall yet. Nothing shows until something is
	// new, so the gallery needs no Refresh button.
	const readFirstPage = async (knownIds: string[]): Promise<NewArtworksCheck> => {
		const request = seedDiscovery.request;
		if (!request) return { count: 0, preview: null };

		const query = [
			`limit=${encodeURIComponent(String(request.limit))}`,
			`sort=${encodeURIComponent(request.sort)}`
		];
		if (request.authorId) query.push(`authorId=${encodeURIComponent(request.authorId)}`);
		if (request.window) query.push(`window=${encodeURIComponent(request.window)}`);

		const payload = await requestJson<{ items: Parameters<typeof toGalleryArtwork>[0][] }>(
			`/api/artworks?${query.join('&')}`
		);
		const known = new Set(knownIds);
		const fresh = payload.items
			.map((item) => toGalleryArtwork(item))
			.filter((artwork) => !known.has(artwork.id));
		return { count: fresh.length, preview: fresh[0] ?? null };
	};

	let newPieces = $state<NewArtworksCheck | null>(null);

	$effect(() => {
		if (roomId === 'mystery' || isRoomBusy) return;
		const check = checkForNewArtworks ?? readFirstPage;
		const knownIds = artworks.map((artwork) => artwork.id);
		let stopped = false;
		let timer: number | undefined;

		const look = async () => {
			if (!document.hidden) {
				try {
					const found = await check(knownIds);
					// A look that lands while the wall is being re-hung saw the old wall.
					if (!stopped && !isRefreshingGallery) newPieces = found.count > 0 ? found : null;
				} catch {
					// A missed look is not worth telling anyone about: the next one runs on time.
				}
			}
			if (!stopped) timer = window.setTimeout(look, newArtworkCheckMs);
		};

		timer = window.setTimeout(look, newArtworkCheckMs);
		return () => {
			stopped = true;
			window.clearTimeout(timer);
		};
	});

	const hangNewPieces = async () => {
		newPieces = null;
		window.scrollTo({ top: 0, behavior: prefersReducedMotion.current ? 'auto' : 'smooth' });
		await refreshGallery();
	};

	// --- Clean home return query param ---
	onMount(() => {
		if (!enteredFromHome) return;

		// A best piece picked on the front door arrives open: the address is
		// its own, as for an artwork opened from the wall.
		const arrivingWith = historyDetailState;
		if (arrivingWith?.source === 'external') {
			goto(resolve('/artwork/[artworkId]', { artworkId: arrivingWith.artworkId }), {
				shallow: true,
				replace: true,
				state: page.state
			});
			return;
		}

		if (roomId === 'hall-of-fame') {
			goto(resolve('/gallery/[[room]]', {}), {
				shallow: true,
				replace: true,
				state: window.history.state
			});
		} else {
			goto(resolve('/gallery/[[room]]', { room: roomId }), {
				shallow: true,
				replace: true,
				state: window.history.state
			});
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
		 * Ownership, not lifecycle. The room lives inside the layout's keyed
		 * room stage, and the room that replaces it publishes its own handlers
		 * into the same stores. Clearing unconditionally therefore erased the
		 * live room's bindings: Refresh became a no-op that still looked
		 * enabled, Back lost its fade to the home page, and the detail panel
		 * unmounted entirely.
		 */
		const actions = {
			newPieces: newPieces
				? {
						count: newPieces.count,
						previewBlurred: Boolean(newPieces.preview?.isNsfw) && !adultContentAllowed,
						previewUrl: newPieces.preview?.imageUrl ?? null
					}
				: null,
			onBack: handleBackToHome,
			onHangNewPieces: hangNewPieces
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
			// Let go only once the room replacing this one has had its turn: the
			// stage builds the next room before it tears this one down, and
			// letting go at once left the stores empty in between, while the
			// header and the detail panel were still reading them.
			queueMicrotask(() => {
				if (get(galleryLayout.actionBindings) === actions) galleryLayout.actionBindings.set(null);
				if (get(galleryLayout.panelBindings) === panel) galleryLayout.panelBindings.set(null);
			});
		};
	});
</script>

{#snippet roomLoadFailure(message: string)}
	<!-- `role="alert"` on the failure, never on the skeleton: a room that failed
	     to load is the one room event worth interrupting a reader for. -->
	<div class="py-6" data-testid="gallery-room-error" role="alert">
		<ChalkEasel title="This room is still being hung." {message}>
			<GameButton
				variant="secondary"
				size="sm"
				disabled={isRefreshingGallery}
				onclick={() => refreshGallery()}
			>
				<span class="font-semibold">{isRefreshingGallery ? 'Retrying…' : 'Try again'}</span>
			</GameButton>
		</ChalkEasel>
	</div>
{/snippet}

{#snippet roomBody()}
	{#if showEmptyState}
		<ReservedSpot
			message={roomEmptyStateMessage ?? ''}
			reservedFor={roomId === 'your-studio' ? 'for you' : 'for the next masterpiece'}
			support={emptyStateSupportMessage}
		>
			{#if !viewer}
				<GameLink href="/" variant="primary" size="sm">
					<Brush class="h-5 w-5" />
					<span class="font-semibold">Join & draw</span>
				</GameLink>
			{:else if roomId === 'your-studio'}
				<!-- The empty studio is the moment to draw: the way there, not just the news. -->
				<GameLink href="/draw" variant="primary" size="sm">
					<Brush class="h-5 w-5" />
					<span class="font-semibold">Draw your first piece</span>
				</GameLink>
			{/if}
		</ReservedSpot>
	{:else if roomId === 'hall-of-fame'}
		<HallOfFameRoom
			{artworks}
			{awardStyle}
			pageInfo={seedDiscovery.pageInfo}
			adultContentEnabled={adultContentAllowed}
			feedCacheKey={roomId}
			seedIsRemembered={isSeedRemembered}
			serverRendered={!roomContent}
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
			seedIsRemembered={isSeedRemembered}
			serverRendered={!roomContent}
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
			seedIsRemembered={isSeedRemembered}
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
			seedIsRemembered={isSeedRemembered}
			serverRendered={!roomContent}
			loadMoreArtworks={roomLoadMoreArtworks}
			onPrefetch={prefetchArtworkDetail}
			onSelect={openArtwork}
			viewerId={viewer?.id ?? null}
		/>
	{/if}
{/snippet}

<div class="relative z-10" data-testid="gallery-room-content">
	<p aria-live="polite" class="sr-only" data-testid="gallery-room-status">{roomStatusMessage}</p>
	<div
		class="relative z-10 mx-auto flex max-w-[160rem] flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8"
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
			<!-- The room's note is stuck on the wall over the top left, taking no room
			     from the room (on a phone it sits above it). It stays inside the window,
			     low enough to clear the room tabs and, until 2xl, a little smaller to
			     keep off the champion's medal. -->
			<div
				class="room-note pointer-events-none mb-4 flex justify-center md:absolute md:top-14 md:left-4 md:z-25 md:mb-0 md:origin-top-left md:-rotate-12 md:scale-80 md:justify-start 2xl:scale-100"
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
				class="pointer-events-none mb-4 flex justify-center md:mb-6 md:rotate-14 md:justify-end lg:absolute lg:top-20 lg:right-4 lg:z-26 lg:mb-0 lg:origin-top-right lg:scale-80 xl:scale-100"
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

		<div aria-busy={isRoomBusy} class="space-y-5 md:space-y-6">
			{#if roomContent}
				<!-- One branch for the room whether it streamed or was remembered, so
				     a remembered room is not rebuilt when its fresh page lands. -->
				{#if streamedContent || isSeedRemembered}
					{@render roomBody()}
				{:else if streamFailed}
					{@render roomLoadFailure(ROOM_LOAD_ERROR_MESSAGE)}
				{:else}
					<RoomLoadingSkeleton {roomId} />
				{/if}
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

<!-- Transient outcomes announce themselves instead of shoving the room down.
     Everything routed here is a failure or a blocked action, so the region is
     the assertive one: a vote that silently did not land is worth interrupting
     a reader for, and the panel's own `role="alert"` is gone now that it hands
     its outcomes up here. -->
<GalleryStatusRegion
	message={detailErrorMessage}
	onDismiss={() => (detailErrorMessage = null)}
	tone="error"
/>

<!-- Arriving from the home page: the veil the home page dropped, lifting. -->
<PageFadeOverlay direction="out" visible={showEntryFade} />

<!-- Leaving for it: the veil drops, and navigation waits for it to be down. -->
<PageFadeOverlay direction="in" onComplete={completeExitToHome} visible={showExitFade} />
