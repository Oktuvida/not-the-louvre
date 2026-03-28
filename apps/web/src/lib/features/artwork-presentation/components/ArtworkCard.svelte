<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

	let {
		artwork,
		index = 0,
		onclick
	}: {
		artwork: Artwork;
		index?: number;
		onclick?: () => void;
	} = $props();

	const rotation = $derived(index % 3 === 0 ? -2 : index % 3 === 1 ? 2 : 0);
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
		class="relative border-[6px] border-[#5d4e37] bg-[#fdfbf7] p-4 shadow-[0_24px_34px_rgba(45,36,32,0.2)] transition duration-300 group-hover:-translate-y-2 group-hover:scale-110 group-hover:rotate-0"
	>
		<img
			src={artwork.imageUrl}
			alt={artwork.title}
			class="aspect-square w-full border-2 border-[#2d2420] object-cover"
		/>

		{#if artwork.artistAvatar}
			<div
				class="absolute -top-4 -right-4 h-16 w-16 overflow-hidden rounded-full border-4 border-[#2d2420] bg-white shadow-xl transition duration-200 hover:scale-110 hover:rotate-[5deg]"
			>
				<img src={artwork.artistAvatar} alt={artwork.artist} class="h-full w-full" />
			</div>
		{/if}

		{#if medal}
			<div
				class="absolute -top-6 -left-6 rotate-12 animate-pulse text-5xl drop-shadow-[2px_2px_4px_rgba(0,0,0,0.3)]"
			>
				{medal}
			</div>
		{/if}

		<!-- Hover Plaque -->
		{#if hovered}
			<div
				class="absolute right-0 -bottom-20 left-0 z-20 animate-[slideUp_0.15s_ease-out] rounded-lg border-[3px] border-[#2d2420] bg-[#8b7355] p-4 [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif] text-[#fdfbf7] shadow-xl"
			>
				<h3 class="mb-1 truncate text-lg font-bold">{artwork.title}</h3>
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
