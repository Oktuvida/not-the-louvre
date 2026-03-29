<script lang="ts">
	import { browser } from '$app/environment';
	import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import ArtworkDetailPanel from '$lib/features/artwork-presentation/components/ArtworkDetailPanel.svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import GalleryRoomNav from '$lib/features/gallery-exploration/components/GalleryRoomNav.svelte';
	import type {
		GalleryRoomConfig,
		GalleryRoomId
	} from '$lib/features/gallery-exploration/model/rooms';
	import MysteryRoom from '$lib/features/gallery-exploration/rooms/MysteryRoom.svelte';
	import BrassPlaque from '$lib/features/shared-ui/components/BrassPlaque.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import PolaroidCard from '$lib/features/shared-ui/components/PolaroidCard.svelte';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import WaxSealMedal from '$lib/features/shared-ui/components/WaxSealMedal.svelte';
	import { toGalleryArtworkDetail } from '$lib/features/gallery-exploration/gallery-adapter';

	let {
		artworks,
		emptyStateMessage = null,
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
		room,
		roomId,
		realtimeConfig = { anonKey: null, url: null },
		viewer = null
	}: {
		artworks: Artwork[];
		emptyStateMessage?: string | null;
		loadArtworkDetail?: (artworkId: string) => Promise<Artwork>;
		realtimeConfig?: { anonKey: string | null; url: string | null };
		room: GalleryRoomConfig;
		roomId: GalleryRoomId;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
	} = $props();

	let selectedArtwork = $state<Artwork | null>(null);
	let mysteryIndex = $state(0);
	let detailErrorMessage = $state<string | null>(null);
	let cleanupRealtime: (() => void) | null = null;
	const selectedArtworkId = $derived(selectedArtwork?.id ?? null);

	const mysteryArtwork = $derived(
		artworks.length > 0 ? (artworks[mysteryIndex % artworks.length] ?? artworks[0]) : null
	);

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

	const spinMystery = () => {
		mysteryIndex += 1;
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
		const supabase = createClient(realtimeConfig.url, realtimeConfig.anonKey, {
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false
			}
		});
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
			void supabase.realtime.disconnect();
		};
	};

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

	const podiumMeta = {
		1: {
			base: 'h-32',
			color: '#f4c430',
			height: 'h-72 md:h-80',
			label: 'CHAMPION',
			medal: '🥇',
			width: 'w-72 md:w-80'
		},
		2: {
			base: 'h-24',
			color: '#c0c0c0',
			height: 'h-64 md:h-72',
			label: 'RUNNER UP',
			medal: '🥈',
			width: 'w-64 md:w-72'
		},
		3: {
			base: 'h-20',
			color: '#cd7f32',
			height: 'h-64 md:h-72',
			label: 'BRONZE STAR',
			medal: '🥉',
			width: 'w-64 md:w-72'
		}
	} as const;

	const hallOfFameArtworks = $derived(artworks);
	const hallOfFamePodium = $derived([
		{ artwork: hallOfFameArtworks[1], position: 2 as const },
		{ artwork: hallOfFameArtworks[0], position: 1 as const },
		{ artwork: hallOfFameArtworks[2], position: 3 as const }
	]);

	const frameForArtwork = (artworkId: string, podiumPosition?: 1 | 2 | 3) =>
		resolveArtworkFrame({ artworkId, podiumPosition });

	const roomNoteClassNames: Record<GalleryRoomId, string> = {
		'hall-of-fame': '',
		'hot-wall': '',
		mystery: '',
		'your-studio': ''
	};
</script>

<div class="pointer-events-none absolute inset-0 overflow-hidden">
	{#each Array.from({ length: 20 }).map((_, index) => index) as index (`gallery-particle-${index}`)}
		<div
			class="absolute h-2 w-2 animate-[drift_4s_ease-in-out_infinite] rounded-full opacity-20"
			style={`
				background: ${['#f4c430', '#d4956c', '#8b9d91', '#c84f4f'][index % 4]};
				left: ${(index * 19) % 100}%;
				top: ${(index * 23) % 100}%;
				animation-delay: ${index * 0.12}s;
			`}
		></div>
	{/each}
</div>

<div
	class="relative min-h-screen bg-[#e7dece] bg-cover bg-fixed bg-center bg-no-repeat"
	style="background-image:url('/gallery-bg.webp');"
>
	<div class="cork-bar sticky top-0 z-40">
		<div class="mx-auto max-w-7xl px-8 py-6">
			<div class="flex items-center justify-between">
				<GameLink href="/" variant="secondary" size="md" className="w-fit -rotate-1 shadow-xl">
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
						class="mr-2 h-5 w-5"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
					>
					<span class="font-semibold">Exit Gallery</span>
				</GameLink>

				<BrassPlaque text="The Gallery" size="large" className="mx-4 shrink text-center" />

				<GameLink href="/draw" variant="primary" size="md" className="w-fit rotate-1 shadow-xl">
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
						class="mr-2 h-5 w-5"
						><path
							d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
						/><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></svg
					>
					<span class="font-semibold">Create Art</span>
				</GameLink>
			</div>
		</div>
	</div>

	<div class="mx-auto flex max-w-7xl flex-col gap-8 px-8 py-8">
		<div class="cork-bar sticky top-[5.5rem] z-30 -mx-8 px-8 py-2">
			<GalleryRoomNav {roomId} />
		</div>

		<div class="relative">
			<!-- Post-it overlay — does not displace content -->
			<div class="pointer-events-none absolute top-2 left-2 z-[25] md:left-4">
				<PostItNote
					attachment={room.postItAttachment}
					className={roomNoteClassNames[roomId]}
					color={room.postItColor}
					label={room.name}
					seedKey={room.id}
					text={room.description}
				/>
			</div>

			{#if detailErrorMessage}
				<div class="rounded-xl border-4 border-[#2d2420] bg-[#f7d8c7] p-5 text-[#7a2e1c]">
					{detailErrorMessage}
				</div>
			{/if}

			{#if emptyStateMessage}
				<div
					class="rounded-xl border-4 border-dashed border-[#5d4e37] bg-[#fdfbf7] p-10 text-center shadow-md"
				>
					<p class="font-display text-2xl text-[#2d2420]">{emptyStateMessage}</p>
					<p class="mt-3 text-[#6b625a]">
						Publish a new piece from the studio and it will show up here.
					</p>
				</div>
			{:else if roomId === 'mystery' && mysteryArtwork}
				<MysteryRoom artwork={mysteryArtwork} onReveal={spinMystery} onSelect={openArtwork} />
			{:else if roomId === 'hall-of-fame'}
				<div class="space-y-12">
					<div
						class="mb-16 flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-end"
					>
						{#each hallOfFamePodium as entry (`podium-${entry.position}-${entry.artwork?.id ?? 'empty'}`)}
							{@const artwork = entry.artwork}
							{#if artwork}
								{@const position = entry.position}
								{@const meta = podiumMeta[position]}
								{@const frame = frameForArtwork(artwork.id, position)}
								<div class="relative flex flex-col items-center">
									<div class="relative mb-5 flex flex-col items-center gap-3">
										<WaxSealMedal {position} size={position === 1 ? 'large' : 'medium'} />
										<div
											class="font-display rounded-full border-[3px] border-[#2d2420] px-6 py-2 font-black text-[#2d2420] shadow-lg"
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
												<img
													src={artwork.imageUrl}
													alt={artwork.title}
													class="h-full w-full object-cover"
												/>
											</ArtworkFrame>
											{#if artwork.artistAvatar}
												<div
													class="absolute -bottom-6 left-1/2 h-20 w-20 -translate-x-1/2 overflow-hidden rounded-full border-4 border-[#2d2420] bg-white shadow-xl"
												>
													<img
														src={artwork.artistAvatar}
														alt={artwork.artist}
														class="h-full w-full"
													/>
												</div>
											{/if}
										</div>
									</button>

									<div
										class={`mt-8 w-full rounded-t-lg border-4 border-[#2d2420] ${meta.base}`}
										style={`background:${meta.color}`}
									>
										<div class="flex h-full flex-col items-center justify-center">
											<div class="font-display text-5xl font-black text-[#2d2420]">{position}</div>
											<div class="mt-1 text-sm font-bold text-[#2d2420]">{artwork.artist}</div>
											<div class="text-xs font-bold text-[#2d2420]">{artwork.score} pts</div>
										</div>
									</div>
								</div>
							{/if}
						{/each}
					</div>

					<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
						{#each hallOfFameArtworks.slice(3) as artwork (artwork.id)}
							<PolaroidCard
								{artwork}
								testId={`ranked-frame-${artwork.id}`}
								onclick={() => openArtwork(artwork)}
							/>
						{/each}
					</div>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
					{#each artworks as artwork (artwork.id)}
						<PolaroidCard {artwork} onclick={() => openArtwork(artwork)} />
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<ArtworkDetailPanel
		artwork={selectedArtwork}
		onArtworkChange={syncArtwork}
		onClose={() => {
			selectedArtwork = null;
		}}
		{viewer}
	/>
</div>

<style>
	.cork-bar {
		background-color: #b8956e;
		background-image:
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 28px,
				rgba(0, 0, 0, 0.04) 28px,
				rgba(0, 0, 0, 0.04) 30px
			),
			repeating-linear-gradient(
				90deg,
				transparent,
				transparent 60px,
				rgba(0, 0, 0, 0.03) 60px,
				rgba(0, 0, 0, 0.03) 62px
			),
			radial-gradient(circle at 80% 20%, rgba(255, 248, 225, 0.15) 0%, transparent 40%);
		border-bottom: 3px solid #8a6944;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.18),
			inset 0 1px 0 rgba(255, 248, 225, 0.15);
	}
</style>
