<script lang="ts">
	import { ArrowLeft, Paintbrush, RefreshCw } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { gsap } from '$lib/client/gsap';
	import { getBrowserRealtimeClient } from '$lib/features/realtime/browser-client';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import ArtworkDetailPanel from '$lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import {
		toGalleryArtwork,
		toGalleryArtworkDetail
	} from '$lib/features/gallery-exploration/gallery-adapter';
	import GalleryRoomNav from '$lib/features/gallery-exploration/components/GalleryRoomNav.svelte';
	import { createMuseumWallPatternUrl } from '$lib/features/home-entry-scene/canvas/museum-canvas';
	import {
		galleryRoomIds,
		type GalleryRoomConfig,
		type GalleryRoomId
	} from '$lib/features/gallery-exploration/model/rooms';
	import { createRealtimeSubscription } from '$lib/features/gallery-exploration/use-realtime-subscription.svelte';
	import AmbientParticleOverlay from '$lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import HallOfFameRoom from '$lib/features/gallery-exploration/rooms/HallOfFameRoom.svelte';
	import HotWallRoom from '$lib/features/gallery-exploration/rooms/HotWallRoom.svelte';
	import MysteryRoom from '$lib/features/gallery-exploration/rooms/MysteryRoom.svelte';
	import YourStudioRoom from '$lib/features/gallery-exploration/rooms/YourStudioRoom.svelte';

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

	const { initialViewer, initialRealtimeConfig, initialArtworks } = (() => ({
		initialViewer: $state.snapshot(viewer),
		initialRealtimeConfig: $state.snapshot(realtimeConfig),
		initialArtworks: $state.snapshot(routeArtworks)
	}))();

	let artworks = $state(initialArtworks);

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	let isSavingAdultContentPreference = $state(false);
	let selectedArtwork = $state<Artwork | null>(null);
	let detailErrorMessage = $state<string | null>(null);
	const enteredFromHome = browser ? $page.url?.searchParams?.get('from') === 'home' : false;
	let entryFadeOpacity = $state(enteredFromHome ? 1 : 0);
	let showEntryFade = $state(enteredFromHome);
	let exitFadeOpacity = $state(0);
	let showExitFade = $state(false);
	let isExitingToHome = $state(false);
	let isRefreshingGallery = $state(false);
	let previousRoomIndex = $state(-1);
	let museumWallPatternUrl = $state('');

	const selectedArtworkId = $derived(selectedArtwork?.id ?? null);
	const adultContentAllowed = $derived(adultContentPreferenceOverride ?? adultContentEnabled);
	const hasSensitiveArtwork = $derived(
		artworks.some((artwork) => artwork.isNsfw) || Boolean(selectedArtwork?.isNsfw)
	);
	const currentRoomIndex = $derived(galleryRoomIds.indexOf(roomId));
	const slideDirection = $derived.by(() => {
		if (previousRoomIndex === -1) return 0;
		return currentRoomIndex > previousRoomIndex ? 1 : currentRoomIndex < previousRoomIndex ? -1 : 0;
	});

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
	const openArtwork = async (artwork: Artwork) => {
		detailErrorMessage = null;
		try {
			selectedArtwork = await loadArtworkDetail(artwork.id);
		} catch (error) {
			selectedArtwork = null;
			detailErrorMessage =
				error instanceof Error ? error.message : 'Artwork details could not be loaded';
		}
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

		const fade = { opacity: 0 };
		gsap.to(fade, {
			opacity: 1,
			duration: 0.5,
			ease: 'power2.in',
			onUpdate: () => {
				exitFadeOpacity = fade.opacity;
			},
			onComplete: () => {
				const url = `${resolve('/')}?from=gallery`;
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- URL is already resolved and extended with query params
				void goto(url);
			}
		});
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

	// --- Museum wall pattern ---
	$effect(() => {
		if (!browser || museumWallPatternUrl) return;
		museumWallPatternUrl = createMuseumWallPatternUrl();
	});

	// --- Clean home return query param ---
	onMount(() => {
		if (!enteredFromHome) return;

		if (roomId === 'hall-of-fame') {
			replaceState(resolve('/gallery'), window.history.state);
		} else {
			replaceState(resolve('/gallery/[room]', { room: roomId }), window.history.state);
		}

		const fade = { opacity: 1 };
		gsap.to(fade, {
			opacity: 0,
			duration: 0.5,
			delay: 0.05,
			ease: 'power2.out',
			onUpdate: () => {
				entryFadeOpacity = fade.opacity;
			},
			onComplete: () => {
				showEntryFade = false;
			}
		});
	});

	// --- Track previous room index for slide direction ---
	$effect(() => {
		const idx = currentRoomIndex;
		return () => {
			previousRoomIndex = idx;
		};
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
</script>

<div
	class="relative min-h-screen bg-cover bg-fixed bg-center bg-no-repeat"
	data-testid="gallery-room-shell"
	style="background-color: #252018;"
>
	<div
		class="absolute inset-0 z-0 bg-[#252018]"
		data-testid="gallery-wall-bricks"
		style={`background-image: url('${museumWallPatternUrl}'); background-size: 512px 512px; background-repeat: repeat;`}
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_86%_12%,rgba(255,247,214,0.34)_0%,rgba(255,243,201,0.18)_18%,rgba(255,241,196,0.06)_36%,transparent_58%)]"
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(46,28,11,0.14)_78%,rgba(20,12,6,0.28)_100%)]"
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_12%_92%,rgba(18,10,4,0.34)_0%,rgba(18,10,4,0.22)_26%,rgba(18,10,4,0.08)_46%,transparent_66%)]"
	></div>
	<div
		class="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_0%,transparent_42%,rgba(12,9,7,0.08)_66%,rgba(12,9,7,0.2)_100%)]"
	></div>

	<AmbientParticleOverlay className="z-[5] opacity-90" />

	<div
		class="pointer-events-none sticky top-0 z-40 px-3 pt-3 md:px-8 md:pt-6"
		data-testid="gallery-room-header"
	>
		<div class="pointer-events-auto absolute top-3 left-3 md:top-6 md:left-8">
			<div onclickcapture={handleBackToHome}>
				<GameLink href="/" variant="ghost" size="sm" className="w-fit -rotate-1 shadow-xl">
					<ArrowLeft class="mr-1 h-5 w-5" />
					<span class="font-semibold">Back</span>
				</GameLink>
			</div>
		</div>

		<div
			class="pointer-events-auto absolute top-3 right-3 z-20 flex flex-row items-start gap-2 md:top-6 md:right-8 md:max-w-none md:flex-col md:items-end md:gap-3"
		>
			{#if viewer}
				<GameLink
					href="/draw"
					variant="primary"
					size="sm"
					className="h-11 min-w-11 rotate-1 px-0 shadow-xl md:h-auto md:min-w-0 md:px-[var(--sticker-padding-x)]"
					contentClassName="px-0 md:px-[calc(var(--sticker-padding-x)-2px)]"
				>
					<Paintbrush class="h-5 w-5 md:mr-1" />
					<span class="sr-only">Create Art</span>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">Create Art</div>
				</GameLink>
				<GameButton
					variant="secondary"
					size="sm"
					className="relative z-20 !h-11 !min-w-11 rotate-1 !px-0 shadow-xl md:!h-auto md:!min-w-0 md:!px-[var(--sticker-padding-x)]"
					disabled={isRefreshingGallery}
					onclick={refreshGallery}
				>
					<RefreshCw class={`h-5 w-5 md:mr-1 ${isRefreshingGallery ? 'animate-spin' : ''}`} />
					<span class="sr-only">{isRefreshingGallery ? 'Refreshing' : 'Refresh'}</span>
					<div aria-hidden="true" class="hidden font-semibold md:inline-flex">
						{isRefreshingGallery ? 'Refreshing' : 'Refresh'}
					</div>
				</GameButton>
			{/if}
		</div>

		<div class="pointer-events-auto mx-auto max-w-full px-12 pt-15 md:w-fit md:px-0 md:pt-1">
			<GalleryRoomNav {roomId} {viewer} />
		</div>
	</div>

	<div
		class="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8"
	>
		{#key roomId}
			<div
				class="relative overflow-visible"
				in:fly={{ x: slideDirection * 300, duration: slideDirection === 0 ? 0 : 300 }}
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

				{#if hasSensitiveArtwork}
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
						/>
					{:else if roomId === 'hot-wall'}
						<HotWallRoom
							{artworks}
							pageInfo={routeDiscovery.pageInfo}
							adultContentEnabled={adultContentAllowed}
							loadMoreArtworks={roomLoadMoreArtworks}
							onSelect={openArtwork}
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
							loadMoreArtworks={roomLoadMoreArtworks}
							onSelect={openArtwork}
						/>
					{/if}
				</div>
			</div>
		{/key}
	</div>

	<ArtworkDetailPanel
		adultContentEnabled={adultContentAllowed}
		artwork={selectedArtwork}
		onAdultContentToggle={updateAdultContentPreference}
		onArtworkChange={syncArtwork}
		onArtworkPatch={patchArtwork}
		onClose={() => {
			selectedArtwork = null;
		}}
		{viewer}
	/>
</div>

{#if showEntryFade}
	<div
		class="pointer-events-none fixed inset-0 z-[100]"
		style={`background-color: #6e6e6e; opacity: ${entryFadeOpacity};`}
	></div>
{/if}

{#if showExitFade}
	<div
		class="pointer-events-none fixed inset-0 z-[100]"
		style={`background-color: #6e6e6e; opacity: ${exitFadeOpacity};`}
	></div>
{/if}
