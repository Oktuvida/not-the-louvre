<script lang="ts">
	// Mirrors the polaroid pulse cards ScrollSentinel shows while paging, so
	// the streamed initial room load looks like the rest of the gallery.
	let { cardCount = 8 }: { cardCount?: number } = $props();
</script>

<div
	data-testid="room-loading-skeleton"
	class="grid gap-12 py-6"
	style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))"
>
	{#each Array.from({ length: cardCount }, (_, i) => i) as i (i)}
		<div class="animate-pulse">
			<div
				class="bg-[#f8f4ed] p-[8px] shadow-[3px_4px_12px_rgba(0,0,0,0.22),0_1px_3px_rgba(0,0,0,0.1)]"
				style={`transform: rotate(${(i % 3) - 1}deg);`}
			>
				<div class="aspect-square w-full border border-[#d6cfc5] bg-[#ece4d8]"></div>
				<div class="flex items-center gap-3 px-[6px] pt-2 pb-[10px]">
					<div class="h-8 w-8 shrink-0 rounded-full bg-[#e8ddd0]"></div>
					<div class="flex-1 space-y-1.5">
						<div class="h-3 w-3/4 rounded bg-[#e8ddd0]"></div>
						<div class="h-2.5 w-1/2 rounded bg-[#efe5d6]"></div>
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>
