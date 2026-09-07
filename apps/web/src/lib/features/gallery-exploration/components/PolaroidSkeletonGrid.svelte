<script lang="ts">
	import { GALLERY_GRID_TEMPLATE_COLUMNS } from '$lib/features/gallery-exploration/model/grid';

	/*
	 * The placeholder box of a PolaroidCard, laid out on the same grid the real
	 * cards land on. Used by both the streamed room skeleton and the
	 * infinite-scroll skeleton, which used to hold byte-identical copies of it.
	 *
	 * Geometry is deliberately coupled to PolaroidCard.svelte and must be kept
	 * in step with it: the real card is `p-[8px] pb-0` with an `items-start`
	 * caption whose two Caveat lines run about 40px, while this placeholder is
	 * `p-[8px]` with a 32px avatar row. Both come out at `image + 66px`, so the
	 * grid does not settle when the cards arrive — copying `pb-0` here without
	 * also growing the text column would make the placeholder 8px short.
	 *
	 * Purely decorative: the surrounding component owns the announcement.
	 */
	let {
		cardTestIdPrefix,
		count = 3,
		gridClassName = 'grid gap-12 py-6',
		testId
	}: {
		cardTestIdPrefix?: string;
		count?: number;
		gridClassName?: string;
		testId?: string;
	} = $props();
</script>

<div
	aria-hidden="true"
	class={gridClassName}
	data-testid={testId}
	style={`grid-template-columns: ${GALLERY_GRID_TEMPLATE_COLUMNS}`}
>
	{#each Array.from({ length: count }, (_, i) => i) as i (i)}
		<div
			class="animate-pulse"
			data-testid={cardTestIdPrefix ? `${cardTestIdPrefix}${i}` : undefined}
		>
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
