<script lang="ts">
	import { ArrowLeft, Paintbrush, RefreshCw } from 'lucide-svelte';
	import { browser } from '$app/environment';
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import { gsap } from '$lib/client/gsap';
	import { getBrowserRealtimeClient } from '$lib/features/realtime/browser-client';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import ArtworkCard from '$lib/features/artwork-presentation/components/ArtworkCard.svelte';
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import ArtworkDetailPanel from '$lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import {
		toGalleryArtwork,
		toGalleryArtworkDetail
	} from '$lib/features/gallery-exploration/gallery-adapter';
	import GalleryRoomNav from '$lib/features/gallery-exploration/components/GalleryRoomNav.svelte';
	import VirtualizedArtworkGrid from '$lib/features/gallery-exploration/components/VirtualizedArtworkGrid.svelte';
	import { createMuseumWallPatternUrl } from '$lib/features/home-entry-scene/canvas/museum-canvas';
	import {
		galleryRoomIds,
		type GalleryRoomConfig,
		type GalleryRoomId
	} from '$lib/features/gallery-exploration/model/rooms';
	import AmbientParticleOverlay from '$lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import WaxSealMedal from '$lib/features/shared-ui/components/WaxSealMedal.svelte';

	let {
		adultContentEnabled = false,
		artworks,
		discovery = { pageInfo: { hasMore: false, nextCursor: null }, request: null },
		emptyStateMessage = null,
		loadHotWallRoom = () => import('$lib/features/gallery-exploration/rooms/HotWallRoom.svelte'),
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
		loadMysteryRoom = () => import('$lib/features/gallery-exploration/rooms/MysteryRoom.svelte'),
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
		loadHotWallRoom?: () => Promise<{
			default: typeof import('$lib/features/gallery-exploration/rooms/HotWallRoom.svelte').default;
		}>;
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
		loadMysteryRoom?: () => Promise<{
			default: typeof import('$lib/features/gallery-exploration/rooms/MysteryRoom.svelte').default;
		}>;
		realtimeConfig?: { anonKey: string | null; url: string | null };
		room: GalleryRoomConfig;
		roomId: GalleryRoomId;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
	} = $props();

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	let isSavingAdultContentPreference = $state(false);
	let selectedArtwork = $state<Artwork | null>(null);
	let detailErrorMessage = $state<string | null>(null);
	let cleanupRealtime: (() => void) | null = null;
	const enteredFromHome = browser ? $page.url?.searchParams?.get('from') === 'home' : false;
	let entryFadeOpacity = $state(enteredFromHome ? 1 : 0);
	let showEntryFade = $state(enteredFromHome);
	let exitFadeOpacity = $state(0);
	let showExitFade = $state(false);
	let isExitingToHome = $state(false);
	let isRefreshingGallery = $state(false);
	let previousRoomIndex = $state(-1);
	let museumWallPatternUrl = $state('');
	let mysteryRoomModule = $state<{
		default: typeof import('$lib/features/gallery-exploration/rooms/MysteryRoom.svelte').default;
	} | null>(null);

	const roomComponentPromise = $derived.by<Promise<
		| {
				default: typeof import('$lib/features/gallery-exploration/rooms/HotWallRoom.svelte').default;
		  }
		| {
				default: typeof import('$lib/features/gallery-exploration/rooms/MysteryRoom.svelte').default;
		  }
	> | null>(() => resolveRoomComponentPromise(roomId));

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

	const stopRealtime = () => {
		cleanupRealtime?.();
		cleanupRealtime = null;
	};

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

	const startRealtime = async (artworkId: string) => {
		stopRealtime();

		if (!viewer || !realtimeConfig.url || !realtimeConfig.anonKey) {
			return;
		}

		const tokenResponse = await fetch('/api/realtime/token', {
			headers: { accept: 'application/json' }
		});

		if (!tokenResponse.ok) {
			return;
		}

		const { token } = (await tokenResponse.json()) as { token: string };
		const supabase = getBrowserRealtimeClient(realtimeConfig.url, realtimeConfig.anonKey);
		await supabase.realtime.setAuth(token);

		const isArtworkEvent = (payload: unknown) => {
			if (typeof payload !== 'object' || payload === null) {
				return false;
			}

			const candidate = payload as {
				new?: { artwork_id?: string };
				old?: { artwork_id?: string };
			};

			return candidate.new?.artwork_id === artworkId || candidate.old?.artwork_id === artworkId;
		};

		const refreshArtwork = () => {
			void refreshSelectedArtwork(artworkId);
		};

		const channel: RealtimeChannel = supabase
			.channel(`gallery-artwork:${artworkId}:${viewer.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'app',
					table: 'artwork_vote_realtime'
				},
				(payload) => {
					if (isArtworkEvent(payload)) {
						refreshArtwork();
					}
				}
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'app',
					table: 'artwork_comment_realtime'
				},
				(payload) => {
					if (isArtworkEvent(payload)) {
						refreshArtwork();
					}
				}
			)
			.subscribe();

		cleanupRealtime = () => {
			void supabase.removeChannel(channel);
		};
	};

	$effect(() => {
		if (!browser || museumWallPatternUrl) return;
		museumWallPatternUrl = createMuseumWallPatternUrl();
	});

	$effect(() => {
		const artworkId = selectedArtworkId;

		if (!browser) {
			return;
		}

		if (!artworkId || !viewer) {
			stopRealtime();
			return;
		}

		void startRealtime(artworkId);

		return () => {
			stopRealtime();
		};
	});

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

	$effect(() => {
		const idx = currentRoomIndex;
		return () => {
			previousRoomIndex = idx;
		};
	});

	$effect(() => {
		if (roomId !== 'mystery' || mysteryRoomModule) {
			return;
		}

		void loadMysteryRoom().then((module) => {
			mysteryRoomModule = module;
		});
	});

	const podiumMeta = {
		1: {
			color: '#f4c430',
			height: 'h-76 md:h-[22rem]',
			label: 'CHAMPION',
			width: 'w-76 md:w-[22rem]'
		},
		2: {
			color: '#c0c0c0',
			height: 'h-68 md:h-[19rem]',
			label: 'RUNNER UP',
			width: 'w-68 md:w-[19rem]'
		},
		3: {
			color: '#cd7f32',
			height: 'h-60 md:h-[16rem]',
			label: 'BRONZE STAR',
			width: 'w-60 md:w-[16rem]'
		}
	} as const;

	const hallOfFameArtworks = $derived(artworks);
	const hallOfFamePodium = $derived([
		{ artwork: hallOfFameArtworks[0], position: 1 as const },
		{ artwork: hallOfFameArtworks[1], position: 2 as const },
		{ artwork: hallOfFameArtworks[2], position: 3 as const }
	]);
	const hotWallLeadArtwork = $derived(artworks[0] ?? null);
	const hotWallRisers = $derived(artworks.slice(1));
	const hotWallGridArtworks = $derived(hotWallRisers.slice(3));

	const frameForArtwork = (artworkId: string, podiumPosition?: 1 | 2 | 3) =>
		resolveArtworkFrame({ artworkId, podiumPosition });

	const resolveRoomComponentPromise = (targetRoomId: GalleryRoomId) => {
		if (targetRoomId === 'hot-wall') {
			return loadHotWallRoom();
		}

		if (targetRoomId === 'mystery') {
			return loadMysteryRoom();
		}

		return null;
	};

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
					{:else if roomId === 'mystery' && artworks.length > 0}
						{#if mysteryRoomModule}
							{@const MysteryRoom =
								mysteryRoomModule.default as typeof import('$lib/features/gallery-exploration/rooms/MysteryRoom.svelte').default}
							<MysteryRoom
								adultContentEnabled={adultContentAllowed}
								{artworks}
								onSelect={openArtwork}
							/>
						{:else if roomComponentPromise}
							{#await roomComponentPromise}
								<div
									class="min-h-[320px] rounded-xl border-4 border-dashed border-[#5d4e37] bg-[#fdfbf7] p-6 text-center shadow-md md:min-h-[400px] md:p-10"
									data-testid="gallery-room-loading"
								>
									<p class="font-display text-2xl text-[#2d2420]">Loading room...</p>
								</div>
							{:then roomModule}
								{@const MysteryRoom =
									roomModule.default as typeof import('$lib/features/gallery-exploration/rooms/MysteryRoom.svelte').default}
								<MysteryRoom
									adultContentEnabled={adultContentAllowed}
									{artworks}
									onSelect={openArtwork}
								/>
							{/await}
						{/if}
					{:else if roomId === 'hall-of-fame'}
						<div class="space-y-12">
							<div
								class="mb-16 flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-end lg:gap-10"
							>
								{#each hallOfFamePodium as entry (`podium-${entry.position}-${entry.artwork?.id ?? 'empty'}`)}
									{@const artwork = entry.artwork}
									{#if artwork}
										{@const position = entry.position}
										{@const meta = podiumMeta[position]}
										{@const frame = frameForArtwork(artwork.id, position)}
										<div class="relative flex flex-col items-center gap-5">
											<div class="relative mb-5 flex flex-col items-center gap-3">
												<WaxSealMedal
													{position}
													size={position === 1 ? 'large' : position === 2 ? 'medium' : 'small'}
												/>
												<div
													class="font-display rounded-full border-[3px] border-[#2d2420] bg-[#f8f2e8]/92 px-5 py-1.5 text-xs font-black tracking-[0.16em] text-[#2d2420] shadow-lg"
													style={`background:${meta.color}`}
												>
													{meta.label}
												</div>
											</div>

											<button
												type="button"
												class={`relative ${meta.width} ${meta.height} cursor-pointer`}
												data-testid={`podium-artwork-${position}`}
												onclick={() => openArtwork(artwork)}
											>
												<div
													class="h-full transition duration-200 hover:-translate-y-2 hover:scale-105"
												>
													<ArtworkFrame
														{frame}
														className="h-full w-full"
														openingClass="h-full"
														testId={`podium-frame-${position}`}
													>
														<div class="relative h-full w-full">
															<img
																src={artwork.imageUrl}
																alt={artwork.title}
																loading={position === 1 ? 'eager' : 'lazy'}
																decoding={position === 1 ? 'sync' : 'async'}
																class={`h-full w-full object-cover transition duration-200 ${artwork.isNsfw && !adultContentAllowed ? 'scale-[1.04] blur-xl saturate-0' : ''}`}
															/>
															{#if artwork.isNsfw && !adultContentAllowed}
																<div
																	class="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[#2d2420] bg-[rgba(45,36,32,0.72)] text-[#fdfbf7]"
																>
																	<span
																		class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black"
																		>18+</span
																	>
																	<p class="mt-3 text-sm font-bold uppercase">Sensitive artwork</p>
																</div>
															{/if}
														</div>
													</ArtworkFrame>
													{#if artwork.artistAvatar}
														<div class="absolute -right-4 -bottom-4">
															<WaxSealAvatar
																alt={artwork.artist}
																seed={artwork.id}
																size="lg"
																src={artwork.artistAvatar}
															/>
														</div>
													{/if}
												</div>
											</button>

											<div
												class="rounded-[1.1rem] border-[3px] border-[#4d351c] bg-[linear-gradient(180deg,rgba(255,249,238,0.96),rgba(239,228,208,0.96))] px-4 py-3 text-center text-[#2d2420] shadow-[0_10px_18px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.45)]"
												data-testid={`podium-plaque-${position}`}
											>
												<div
													class="text-[0.68rem] font-black tracking-[0.18em] text-[#8a6a42] uppercase"
												>
													#{position}
													{meta.label}
												</div>
												<div class="mt-1 text-sm font-bold text-[#2d2420]">{artwork.artist}</div>
												<div class="mt-1 text-xs font-semibold text-[#5f554b]">
													⭐ {artwork.score}
												</div>
											</div>
										</div>
									{/if}
								{/each}
							</div>

							<div class="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
								{#each hallOfFameArtworks.slice(3) as artwork, index (artwork.id)}
									<div style={`transform: translateY(${index % 2 === 0 ? '-6px' : '8px'});`}>
										<PolaroidCard
											{artwork}
											testId={`ranked-polaroid-${artwork.id}`}
											onclick={() => openArtwork(artwork)}
										/>
									</div>
								{/each}
							</div>
						</div>
					{:else if roomId === 'hot-wall'}
						{#if roomComponentPromise}
							{#await roomComponentPromise}
								<div
									class="flex min-h-[28rem] items-center justify-center px-6 py-12"
									data-testid="gallery-room-loading"
								>
									<PostItNote
										attachment="pin"
										className="max-w-sm"
										color="#f4aacb"
										label="The Hot Wall"
										seedKey="hot-wall-coming-soon"
										text="Proximamente."
									/>
								</div>
							{:then roomModule}
								{@const HotWallRoom =
									roomModule.default as typeof import('$lib/features/gallery-exploration/rooms/HotWallRoom.svelte').default}
								<HotWallRoom
									adultContentEnabled={adultContentAllowed}
									gridArtworks={hotWallGridArtworks}
									leadArtwork={hotWallLeadArtwork}
									{viewer}
									onArtworkPatch={patchArtwork}
									onSelect={openArtwork}
									risers={hotWallRisers}
								/>
							{/await}
						{/if}
					{:else if roomId === 'your-studio'}
						<VirtualizedArtworkGrid
							{artworks}
							{discovery}
							{loadMoreArtworks}
							onSelect={openArtwork}
						/>
					{:else}
						<div class="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
							{#each artworks as artwork, index (artwork.id)}
								<ArtworkCard
									adultContentEnabled={adultContentAllowed}
									{artwork}
									{index}
									frameTestId={`gallery-frame-${artwork.id}`}
									{viewer}
									onArtworkPatch={(patch) => patchArtwork(artwork.id, patch)}
									onclick={() => openArtwork(artwork)}
								/>
							{/each}
						</div>
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
