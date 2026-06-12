<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidateAll, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { getBrowserRealtimeClient } from '$lib/features/realtime/browser-client';
	import { getGalleryLayoutContext } from '$lib/features/gallery-exploration/gallery-layout-context';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import {
		toGalleryArtwork,
		toGalleryArtworkDetail
	} from '$lib/features/gallery-exploration/gallery-adapter';
	import {
		type GalleryRoomConfig,
		type GalleryRoomId
	} from '$lib/features/gallery-exploration/model/rooms';
	import { createRealtimeSubscription } from '$lib/features/gallery-exploration/use-realtime-subscription.svelte';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import HallOfFameRoom from '$lib/features/gallery-exploration/rooms/HallOfFameRoom.svelte';
	import HotWallRoom from '$lib/features/gallery-exploration/rooms/HotWallRoom.svelte';
	import MysteryRoom from '$lib/features/gallery-exploration/rooms/MysteryRoom.svelte';
	import YourStudioRoom from '$lib/features/gallery-exploration/rooms/YourStudioRoom.svelte';

	type GalleryDetailHistoryState = NonNullable<App.PageState['galleryDetail']>;

	const LOCAL_GALLERY_DETAIL_SOURCE = 'local-room-selection' as const;

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
		artworks: routeArtworks,
		discovery: routeDiscovery = { pageInfo: { hasMore: false, nextCursor: null }, request: null },
		emptyStateMessage = null,
		loadMoreArtworks = async (request: {
			authorId: string | null;
			cursor: string;
			limit: number;
			sort: 'hot' | 'recent' | 'top';
			window: 'all' | null;
		}) => {
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

			const response = await fetch(`/api/artworks?${query.join('&')}`, {
				headers: { accept: 'application/json' }
			});

			if (!response.ok) {
				throw new Error('Gallery discovery could not be loaded');
			}

			const payload = (await response.json()) as {
				items: Parameters<typeof toGalleryArtwork>[0][];
				pageInfo: { hasMore: boolean; nextCursor: string | null };
			};

			return {
				artworks: payload.items.map((item) => toGalleryArtwork(item)),
				pageInfo: payload.pageInfo
			};
		},
		loadArtworkDetail = async (artworkId: string) => {
			const [detailResponse, commentsResponse] = await Promise.all([
				fetch(`/api/artworks/${artworkId}`),
				fetch(`/api/artworks/${artworkId}/comments`)
			]);
			if (!detailResponse.ok) {
				throw new Error('Artwork details could not be loaded');
			}

			const payload = (await detailResponse.json()) as {
				artwork: Parameters<typeof toGalleryArtworkDetail>[0];
			};
			const detail = toGalleryArtworkDetail(payload.artwork);

			if (!commentsResponse.ok) {
				return detail;
			}

			const commentsPayload = (await commentsResponse.json()) as {
				comments: Array<{
					author: { nickname: string };
					body: string;
					createdAt: Date | string;
					id: string;
				}>;
			};

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
			const response = await fetch('/api/artworks/random', {
				headers: { accept: 'application/json' }
			});

			if (!response.ok) {
				throw new Error('Could not fetch a random artwork');
			}

			const payload = (await response.json()) as {
				artwork: Parameters<typeof toGalleryArtwork>[0];
			};

			return toGalleryArtwork(payload.artwork);
		},
		room,
		roomId,
		realtimeConfig = { anonKey: null, url: null },
		viewer = null
	}: {
		adultContentEnabled?: boolean;
		artworks: Artwork[];
		discovery?: {
			pageInfo: { hasMore: boolean; nextCursor: string | null };
			request: {
				authorId: string | null;
				limit: number;
				sort: 'hot' | 'recent' | 'top';
				window: 'all' | null;
			} | null;
		};
		emptyStateMessage?: string | null;
		fetchRandomArtwork?: () => Promise<Artwork>;
		loadMoreArtworks?: (request: {
			authorId: string | null;
			cursor: string;
			limit: number;
			sort: 'hot' | 'recent' | 'top';
			window: 'all' | null;
		}) => Promise<{
			artworks: Artwork[];
			pageInfo: { hasMore: boolean; nextCursor: string | null };
		}>;
		loadArtworkDetail?: (artworkId: string) => Promise<Artwork>;
		realtimeConfig?: { anonKey: string | null; url: string | null };
		room: GalleryRoomConfig;
		roomId: GalleryRoomId;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
	} = $props();

	const galleryLayout = getGalleryLayoutContext();
	const revealedArtworkIds = galleryLayout?.revealedArtworkIds ?? writable(new Set());

	const { initialViewer, initialRealtimeConfig, initialArtworks } = (() => ({
		initialViewer: $state.snapshot(viewer),
		initialRealtimeConfig: $state.snapshot(realtimeConfig),
		initialArtworks: $state.snapshot(routeArtworks)
	}))();

	let artworks = $state(initialArtworks);

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	let isSavingAdultContentPreference = $state(false);
	let selectedArtwork = $state<Artwork | null>(null);
	let isHydratingDetail = $state(false);
	let detailErrorMessage = $state<string | null>(null);
	const enteredFromHome = browser ? $page.url?.searchParams?.get('from') === 'home' : false;
	let showEntryFade = $state(enteredFromHome);
	let showExitFade = $state(false);
	let isExitingToHome = $state(false);
	const fadeDuration = $derived(prefersReducedMotion.current ? 0 : 250);
	let isRefreshingGallery = $state(false);
	let detailOrigin = $state<GalleryDetailHistoryState['source'] | null>(null);
	let didCreateLocalDetailHistoryEntry = $state(false);
	let detailLoadSequence = 0;

	const selectedArtworkId = $derived(selectedArtwork?.id ?? null);
	const adultContentAllowed = $derived(adultContentPreferenceOverride ?? adultContentEnabled);
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
		artworks = routeArtworks;
	});

	// --- Room-scoped loadMoreArtworks that binds discovery request context ---
	const roomLoadMoreArtworks = $derived.by(() => {
		const request = routeDiscovery.request;
		if (!request) return undefined;
		return async (params: { cursor: string }) => {
			return loadMoreArtworks({ ...request, cursor: params.cursor });
		};
	});

	// --- Detail panel ---
	const loadArtworkFromHistoryState = async (historyState: GalleryDetailHistoryState) => {
		const requestSequence = ++detailLoadSequence;
		detailErrorMessage = null;

		// Open the panel instantly with the room copy of the artwork; the full
		// detail (fresh votes, comments) hydrates in place once fetched.
		if (selectedArtwork?.id !== historyState.artworkId) {
			const roomArtwork = artworks.find((candidate) => candidate.id === historyState.artworkId);
			if (roomArtwork) {
				selectedArtwork = roomArtwork;
				detailOrigin = historyState.source;
			}
		}
		isHydratingDetail = true;

		try {
			const nextArtwork = await loadArtworkDetail(historyState.artworkId);
			if (requestSequence !== detailLoadSequence) return;

			selectedArtwork = nextArtwork;
			detailOrigin = historyState.source;
		} catch (error) {
			if (requestSequence !== detailLoadSequence) return;

			selectedArtwork = null;
			detailOrigin = null;
			detailErrorMessage =
				error instanceof Error ? error.message : 'Artwork details could not be loaded';

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
			const response = await fetch('/api/viewer/content-preferences', {
				body: JSON.stringify({ adultContentEnabled: enabled }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});

			if (!response.ok) {
				throw new Error('18+ artwork preference could not be updated.');
			}

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
					fetchToken: async () => {
						const response = await fetch('/api/realtime/token', {
							headers: { accept: 'application/json' }
						});
						if (!response.ok) return null;
						const { token } = (await response.json()) as { token: string };
						return token;
					},
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
				detailErrorMessage =
					error instanceof Error ? error.message : 'Artwork details could not be loaded';
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

		// Dropping the flag removes the overlay; its outro fade reveals the room.
		showEntryFade = false;
	});

	// --- Empty state ---
	const roomNoteClassNames: Record<GalleryRoomId, string> = {
		'hall-of-fame': '',
		'hot-wall': '',
		mystery: '',
		'your-studio': ''
	};
	const showEmptyState = $derived(Boolean(emptyStateMessage) && roomId !== 'hot-wall');
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

		galleryLayout.actionBindings.set({
			isRefreshingGallery,
			onBack: handleBackToHome,
			onRefresh: refreshGallery
		});

		galleryLayout.panelBindings.set({
			adultContentEnabled: adultContentAllowed,
			artwork: selectedArtwork,
			isHydratingDetail,
			onAdultContentToggle: updateAdultContentPreference,
			onArtworkChange: syncArtwork,
			onArtworkPatch: patchArtwork,
			onClose: closeArtworkDetail,
			revealedArtworkIds,
			viewer
		});

		return () => {
			galleryLayout.actionBindings.set(null);
			galleryLayout.panelBindings.set(null);
		};
	});
</script>

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
				class="pointer-events-none mb-4 flex justify-center md:absolute md:top-5 md:-left-16 md:z-[25] md:mb-0 md:rotate-[-20deg] md:justify-start"
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
				class="pointer-events-none mb-4 flex justify-center md:mb-6 md:rotate-14 md:justify-end lg:absolute lg:top-20 lg:right-[-2.5rem] lg:z-[26] lg:mb-0 xl:right-[-17.5rem]"
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
							class="w-full rounded-[0.95rem] border-3 border-[#2d2420] bg-[#fff7d4] px-4 py-2 text-sm font-black text-[#2d2420] shadow-[2px_3px_0_rgba(45,36,32,0.18)] transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
							disabled={isSavingAdultContentPreference}
							onclick={() => updateAdultContentPreference(!adultContentAllowed)}
						>
							{adultContentAllowed ? 'Hide 18+ artworks' : 'Reveal 18+ artworks'}
						</button>
					{:else}
						<p class="text-xs font-semibold text-[#8f3720]">Sign in to reveal 18+ artworks.</p>
					{/if}
				</PostItNote>
			</div>
		{/if}

		<div class="space-y-5 md:space-y-6">
			{#if detailErrorMessage}
				<div class="rounded-xl border-4 border-[#2d2420] bg-[#f7d8c7] p-5 text-[#7a2e1c]">
					{detailErrorMessage}
				</div>
			{/if}

			{#if showEmptyState}
				<div
					class="rounded-xl border-4 border-dashed border-[#5d4e37] bg-[#fdfbf7] p-10 text-center shadow-md"
				>
					<p class="font-display text-2xl text-[#2d2420]">{emptyStateMessage}</p>
					<p class="mt-3 text-[#6b625a]">
						{emptyStateSupportMessage}
					</p>
				</div>
			{:else if roomId === 'hall-of-fame'}
				<HallOfFameRoom
					{artworks}
					pageInfo={routeDiscovery.pageInfo}
					adultContentEnabled={adultContentAllowed}
					loadMoreArtworks={roomLoadMoreArtworks}
					onSelect={openArtwork}
					{revealedArtworkIds}
					viewerId={viewer?.id ?? null}
				/>
			{:else if roomId === 'hot-wall'}
				<HotWallRoom
					{artworks}
					pageInfo={routeDiscovery.pageInfo}
					adultContentEnabled={adultContentAllowed}
					loadMoreArtworks={roomLoadMoreArtworks}
					onSelect={openArtwork}
					{revealedArtworkIds}
					viewerId={viewer?.id ?? null}
				/>
			{:else if roomId === 'mystery' && artworks.length > 0}
				<MysteryRoom
					{artworks}
					pageInfo={routeDiscovery.pageInfo}
					adultContentEnabled={adultContentAllowed}
					loadMoreArtworks={roomLoadMoreArtworks}
					{fetchRandomArtwork}
					onSelect={openArtwork}
				/>
			{:else if roomId === 'your-studio'}
				<YourStudioRoom
					{artworks}
					pageInfo={routeDiscovery.pageInfo}
					adultContentEnabled={adultContentAllowed}
					loadMoreArtworks={roomLoadMoreArtworks}
					onSelect={openArtwork}
					viewerId={viewer?.id ?? null}
				/>
			{/if}
		</div>
	</div>
</div>

{#if showEntryFade}
	<div
		class="pointer-events-none fixed inset-0 z-[100] bg-[#6e6e6e]"
		out:fade={{ duration: fadeDuration }}
	></div>
{/if}

{#if showExitFade}
	<div
		class="pointer-events-none fixed inset-0 z-[100] bg-[#6e6e6e]"
		in:fade={{ duration: fadeDuration }}
		onintroend={completeExitToHome}
	></div>
{/if}
