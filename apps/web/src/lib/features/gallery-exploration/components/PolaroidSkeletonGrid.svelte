<script lang="ts">
	import '../gallery-grid.css';

	/*
	 * The placeholder box of a PolaroidCard, laid out on the same grid the real
	 * cards land on. Used by both the streamed room skeleton and the
	 * infinite-scroll skeleton, which used to hold byte-identical copies of it.
	 *
	 * Geometry is deliberately coupled to PolaroidCard.svelte and must be kept
	 * in step with it: like the card, it is drawn in em from its own width. The
	 * real card is `p-[0.5em] pb-0` with an `items-start` caption whose two
	 * Caveat lines run about 2.5em, while this placeholder is `p-[0.5em]` with a
	 * 2em avatar row. Both come out at `image + 4.125em`, so the grid does not
	 * settle when the cards arrive — copying `pb-0` here without also growing
	 * the text column would make the placeholder half an em short.
	 *
	 * Purely decorative: the surrounding component owns the announcement.
	 */
	let {
		cardTestIdPrefix,
		count = 3,
		gridClassName = 'py-6',
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
	class={`gallery-grid-host gallery-grid ${gridClassName}`}
	data-testid={testId}
>
	{#each Array.from({ length: count }, (_, i) => i) as i (i)}
		<div
			class="skeleton-card animate-pulse"
			data-testid={cardTestIdPrefix ? `${cardTestIdPrefix}${i}` : undefined}
		>
			<div
				class="skeleton-polaroid bg-paper-card p-[0.5em] shadow-sheet"
				style={`transform: rotate(${(i % 3) - 1}deg);`}
			>
				<div class="aspect-square w-full border border-hairline bg-linen"></div>
				<div class="flex items-center gap-[0.75em] px-[0.375em] pt-[0.5em] pb-[0.625em]">
					<div class="h-[2em] w-[2em] shrink-0 rounded-full bg-sand"></div>
					<div class="flex-1 space-y-[0.375em]">
						<div class="h-[0.75em] w-3/4 rounded bg-sand"></div>
						<div class="h-[0.625em] w-1/2 rounded bg-[#efe5d6]"></div>
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	/* The same scale as PolaroidCard: 16px on a 373px card. */
	.skeleton-card {
		container-type: inline-size;
	}

	.skeleton-polaroid {
		font-size: clamp(0.8125rem, 4.29cqi, 1.5rem);
	}
</style>
