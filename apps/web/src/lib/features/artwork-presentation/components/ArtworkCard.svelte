<script lang="ts">
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import ArtworkSafetyActions from '$lib/features/artwork-presentation/components/ArtworkSafetyActions.svelte';
	import {
		resolveArtworkFrame,
		type ArtworkPodiumPosition
	} from '$lib/features/artwork-presentation/model/frame';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';

	let {
		artwork,
		adultContentEnabled = false,
		index = 0,
		frameTestId = 'artwork-card-frame',
		podiumPosition,
		viewer = null,
		onArtworkPatch,
		onclick
	}: {
		artwork: Artwork;
		adultContentEnabled?: boolean;
		frameTestId?: string;
		index?: number;
		podiumPosition?: ArtworkPodiumPosition;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
		onArtworkPatch?: (patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>) => void;
		onclick?: () => void;
	} = $props();

	const rotation = $derived(index % 3 === 0 ? -2 : index % 3 === 1 ? 2 : 0);
	const isSensitiveBlurred = $derived(artwork.isNsfw && !adultContentEnabled);
	const frame = $derived(resolveArtworkFrame({ artworkId: artwork.id, podiumPosition }));
	const isFork = $derived(Boolean(artwork.lineage?.isFork));
	const forkParentTitle = $derived(
		artwork.lineage?.parentStatus === 'available' ? (artwork.lineage.parent?.title ?? null) : null
	);
	const medal = $derived(
		artwork.rank && artwork.rank <= 3
			? { 1: '\u{1F947}', 2: '\u{1F948}', 3: '\u{1F949}' }[artwork.rank as 1 | 2 | 3]
			: null
	);

	let hovered = $state(false);
</script>

<button
	type="button"
	class="group relative cursor-pointer text-left"
	style={`transform: rotate(${rotation}deg);`}
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
	{onclick}
>
	<div
		class="relative transition duration-300 group-hover:-translate-y-2 group-hover:scale-110 group-hover:rotate-0"
	>
		{#if viewer}
			<div
				class="absolute top-2 right-2 z-20 opacity-0 transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
			>
				<ArtworkSafetyActions {artwork} compact {viewer} {onArtworkPatch} />
			</div>
		{/if}

		<ArtworkFrame {frame} className="aspect-square w-full" testId={frameTestId}>
			<div class="relative h-full w-full">
				{#if isFork}
					<div
						class="absolute top-3 left-3 z-10 rounded-full border-2 border-[#2d2420] bg-[#f7d58a] px-3 py-1 text-[0.65rem] font-black tracking-[0.18em] text-[#2d2420] uppercase shadow-md"
					>
						Forked
					</div>
				{/if}
				<img
					src={artwork.imageUrl}
					alt={artwork.title}
					class={`h-full w-full object-cover transition duration-200 ${isSensitiveBlurred ? 'scale-[1.04] blur-xl saturate-0' : ''}`}
				/>
				{#if isSensitiveBlurred}
					<div
						class="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[#2d2420] bg-[rgba(45,36,32,0.72)] px-4 text-center text-[#fdfbf7]"
					>
						<span class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black"
							>18+</span
						>
						<p class="mt-3 text-sm font-bold uppercase">Sensitive artwork</p>
						<p class="mt-1 max-w-[12rem] text-xs">Reveal 18+ artworks to view this piece.</p>
					</div>
				{/if}
			</div>
		</ArtworkFrame>

		{#if artwork.artistAvatar}
			<div class="absolute -top-5 -right-5">
				<WaxSealAvatar
					alt={artwork.artist}
					className="transition duration-200 hover:scale-110 hover:rotate-[5deg]"
					seed={artwork.id}
					size="lg"
					src={artwork.artistAvatar}
				/>
			</div>
		{/if}

		{#if medal}
			<div
				class="absolute -top-6 -left-6 rotate-12 animate-pulse text-5xl drop-shadow-[2px_2px_4px_rgba(0,0,0,0.3)]"
			>
				{medal}
			</div>
		{/if}

		<div class="mt-4 space-y-2 border-t-2 border-[#e5dfd5] pt-3 text-[#2d2420]">
			<h3 class="truncate text-lg font-bold">{artwork.title}</h3>
			{#if isFork}
				<p class="truncate text-xs font-semibold tracking-[0.12em] text-[#8a6a42] uppercase">
					{forkParentTitle ? `From ${forkParentTitle}` : 'Forked artwork'}
				</p>
			{/if}
			<p class="truncate text-sm text-[#6b625a]">by {artwork.artist}</p>
			<div class="flex items-center gap-3 text-xs font-semibold text-[#5a5249]">
				<span>⭐ {artwork.score}</span>
				<span>💬 {artwork.commentCount ?? artwork.comments.length}</span>
			</div>
		</div>

		<!-- Hover Plaque -->
		{#if hovered}
			<div
				class="absolute right-0 -bottom-20 left-0 z-20 animate-[slideUp_0.15s_ease-out] rounded-lg border-[3px] border-[#2d2420] bg-[#8b7355] p-4 [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif] text-[#fdfbf7] shadow-xl"
			>
				<h3 class="mb-1 truncate text-lg font-bold">{artwork.title}</h3>
				{#if isFork}
					<p class="truncate text-xs font-semibold tracking-[0.12em] text-[#f7d58a] uppercase">
						{forkParentTitle ? `From ${forkParentTitle}` : 'Forked artwork'}
					</p>
				{/if}
				<p class="truncate text-sm opacity-90">by {artwork.artist}</p>
				<div class="mt-2 flex items-center gap-3 text-sm">
					<span class="flex items-center gap-1 font-bold text-[#f4c430]">
						⭐ {artwork.score}
					</span>
					<span class="flex items-center gap-1">
						<!-- ThumbsUp SVG -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-4 w-4"
							><path d="M7 10v12" /><path
								d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
							/></svg
						>
						{artwork.upvotes}
					</span>
					<span class="flex items-center gap-1">
						<!-- MessageCircle SVG -->
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-4 w-4"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg
						>
						{artwork.comments.length}
					</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Wall Shadow -->
	<div
		class="pointer-events-none absolute inset-0 -z-10 translate-x-2 translate-y-2 bg-[linear-gradient(to_bottom_right,transparent,rgba(0,0,0,0.1))]"
	></div>
</button>

<style>
	@keyframes slideUp {
		0% {
			opacity: 0;
			transform: translateY(10px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
