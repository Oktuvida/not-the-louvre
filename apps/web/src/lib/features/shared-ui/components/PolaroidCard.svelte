<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import { hashString } from '$lib/features/artwork-presentation/model/frame';

	let {
		artwork,
		className = '',
		onclick,
		testId
	}: {
		artwork: Artwork;
		className?: string;
		onclick?: () => void;
		testId?: string;
	} = $props();

	const seed = $derived(hashString(artwork.id));
	const attachment = $derived(seed % 2 === 0 ? 'tape' : 'pin');
	const rotation = $derived((seed % 7) - 3 || 1);
	const tapeVariant = $derived(seed % 3);
	const pinClass = $derived(
		['pin-blue', 'pin-red', 'pin-green', 'pin-yellow'][seed % 4] ?? 'pin-blue'
	);
	const isFork = $derived(Boolean(artwork.lineage?.isFork));
	const forkParentTitle = $derived(
		artwork.lineage?.parentStatus === 'available' ? (artwork.lineage.parent?.title ?? null) : null
	);
	// Paint stain position/color — deterministic per card
	const stainVariant = $derived(seed % 5);
	const stainColor = $derived(
		[
			'rgba(74,127,181,0.07)',
			'rgba(200,79,79,0.07)',
			'rgba(93,186,93,0.06)',
			'rgba(244,196,48,0.08)',
			'rgba(139,106,174,0.07)'
		][seed % 5] ?? 'rgba(74,127,181,0.07)'
	);
</script>

<button
	type="button"
	class={`group relative cursor-pointer text-left ${className}`}
	data-testid={testId}
	style={`transform: rotate(${rotation}deg);`}
	{onclick}
>
	<div
		class="polaroid relative bg-[#f8f4ed] p-[8px] pb-0 shadow-[3px_4px_12px_rgba(0,0,0,0.22),0_1px_3px_rgba(0,0,0,0.1)] transition duration-200 group-hover:z-[5] group-hover:scale-[1.06] group-hover:rotate-0"
	>
		<!-- Paint stain decoration -->
		<div
			class="pointer-events-none absolute rounded-full opacity-100"
			style={`
				background: ${stainColor};
				width: ${28 + (seed % 20)}px;
				height: ${24 + (seed % 16)}px;
				${stainVariant === 0 ? 'bottom: 12px; right: -6px;' : stainVariant === 1 ? 'top: -4px; right: 10px;' : stainVariant === 2 ? 'bottom: 8px; left: -4px;' : stainVariant === 3 ? 'top: 50%; left: -8px;' : 'bottom: -4px; right: 14px;'}
				filter: blur(4px);
				transform: rotate(${(seed % 40) - 20}deg);
			`}
		></div>

		{#if attachment === 'tape'}
			<div
				class={`pointer-events-none absolute z-[3] h-4 w-12 border border-[rgba(200,190,170,0.3)] bg-[rgba(255,255,240,0.55)] ${tapeVariant === 0 ? 'top-[-7px] left-1/2 -translate-x-1/2 -rotate-3' : tapeVariant === 1 ? 'top-[-6px] left-2 rotate-[12deg]' : 'top-[-6px] right-[6px] -rotate-[8deg]'}`}
			></div>
		{:else}
			<div
				class={`polaroid-pin pointer-events-none absolute top-[-6px] left-1/2 z-[4] h-[14px] w-[14px] -translate-x-1/2 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)] ${pinClass}`}
			></div>
		{/if}

		<!-- Image area -->
		<div class="relative aspect-square overflow-hidden border border-[#d6cfc5]">
			{#if isFork}
				<div
					class="absolute top-3 left-3 z-10 rounded-full border-2 border-[#2d2420] bg-[#f7d58a] px-3 py-1 text-[0.65rem] font-black tracking-[0.18em] text-[#2d2420] uppercase shadow-md"
				>
					Forked
				</div>
			{/if}
			<img src={artwork.imageUrl} alt={artwork.title} class="h-full w-full object-cover" />
		</div>

		<!-- Caption area -->
		<div class="flex items-start gap-3 px-[6px] pt-2 pb-[10px]">
			<div
				class="flex h-8 w-8 min-w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-[2.5px] border-[#2d2420] bg-[#e8ddd0] shadow-[1px_2px_4px_rgba(0,0,0,0.15)]"
			>
				{#if artwork.artistAvatar}
					<img src={artwork.artistAvatar} alt={artwork.artist} class="h-full w-full object-cover" />
				{:else}
					<div class="h-full w-full bg-[linear-gradient(135deg,#c4b5a0,#a89680)]"></div>
				{/if}
			</div>

			<div class="min-w-0 flex-1">
				<p
					class="truncate text-[1.05rem] leading-[1.2] font-semibold text-[#2d2420]"
					style="font-family: 'Caveat', cursive;"
				>
					{artwork.title}
				</p>
				<p class="truncate text-[0.82rem] text-[#8a6c52]" style="font-family: 'Caveat', cursive;">
					{artwork.artist}
				</p>
				{#if isFork}
					<p
						class="truncate font-['Fredoka'] text-[0.7rem] font-semibold tracking-[0.08em] text-[#8a6a42] uppercase"
					>
						{forkParentTitle ? `From ${forkParentTitle}` : 'Forked artwork'}
					</p>
				{/if}
			</div>

			<div
				class="shrink-0 pt-0.5 text-right font-['Fredoka'] text-[0.7rem] leading-[1.2] tracking-[0.04em] text-[#8a6c52]"
			>
				<div data-testid={testId ? `${testId}-score` : undefined}>
					&#11088; {artwork.score}
				</div>
				<div data-testid={testId ? `${testId}-comments` : undefined}>
					&#128172; {artwork.commentCount ?? artwork.comments.length}
				</div>
			</div>
		</div>
	</div>
</button>

<style>
	.pin-blue {
		background: radial-gradient(circle at 4px 4px, #4a90d9, #2d6bb5);
	}

	.pin-red {
		background: radial-gradient(circle at 4px 4px, #e74c3c, #c0392b);
	}

	.pin-green {
		background: radial-gradient(circle at 4px 4px, #5dba5d, #3a8f3a);
	}

	.pin-yellow {
		background: radial-gradient(circle at 4px 4px, #f4c430, #d4a017);
	}

	/* Pin highlight dot */
	.polaroid-pin::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 4px;
		width: 4px;
		height: 4px;
		background: rgba(255, 255, 255, 0.35);
		border-radius: 50%;
	}
</style>
