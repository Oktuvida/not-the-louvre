<script lang="ts">
	import PolaroidSkeletonGrid from '#lib/features/gallery-exploration/components/PolaroidSkeletonGrid.svelte';
	import type { GalleryRoomId } from '#lib/features/gallery-exploration/model/rooms.js';

	/*
	 * A placeholder shaped like the room it precedes.
	 *
	 * A skeleton earns its keep by reserving the space the content will land in.
	 * A single grid of polaroids did the opposite on the default landing route:
	 * `/gallery` resolves to the Hall of Fame, so eight stacked cards were
	 * replaced by a three-tier podium the instant the stream arrived — a
	 * full-viewport jump that reads as a page reload.
	 *
	 * The header blocks are plain pulse boxes on purpose: they borrow the room's
	 * own geometry (the podium sizes, the lead card's `max-w-md`, the reel's
	 * shell) without re-implementing wax seals, banners or engraved plaques,
	 * which would drift from the real room the first time it changes.
	 */
	let {
		cardCount = 8,
		roomId = 'hall-of-fame'
	}: {
		cardCount?: number;
		roomId?: GalleryRoomId;
	} = $props();

	// Mirrors HallOfFameRoom's podiumMeta width/height classes.
	const podiumBlocks = [
		{ frame: 'w-76 md:w-[22rem] h-76 md:h-[22rem]', medal: 'h-16 w-16' },
		{ frame: 'w-68 md:w-[19rem] h-68 md:h-[19rem]', medal: 'h-14 w-14' },
		{ frame: 'w-60 md:w-[16rem] h-60 md:h-[16rem]', medal: 'h-12 w-12' }
	];

	// YourStudioRoom's grid runs at gap-15 (60px); the other grids at gap-12.
	const gridClassName = $derived(
		roomId === 'your-studio' ? 'grid gap-15 py-6' : 'grid gap-12 py-6'
	);
</script>

<!--
	No live region here: this component is mounted and unmounted whole by the
	room's `{#await}`, so a region inside it would appear together with its
	message (announced unreliably) and disappear before it could say the wait is
	over. The gallery page owns one that outlives every branch.
-->
<div data-testid="room-loading-skeleton" data-room-skeleton={roomId}>
	{#if roomId === 'hall-of-fame'}
		<div class="space-y-12">
			<div
				aria-hidden="true"
				class="mb-16 flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-end lg:gap-10"
			>
				{#each podiumBlocks as block, index (index)}
					<div class="flex animate-pulse flex-col items-center gap-5">
						<div class="mb-5 flex flex-col items-center gap-3">
							<div class={`${block.medal} rounded-full bg-sand`}></div>
							<div class="h-6 w-32 rounded bg-sand"></div>
						</div>
						<div class={`${block.frame} rounded border border-hairline bg-linen`}></div>
						<div class="h-16 w-44 rounded bg-sand"></div>
					</div>
				{/each}
			</div>

			<div class="w-full">
				<PolaroidSkeletonGrid
					count={cardCount}
					{gridClassName}
					testId="room-loading-skeleton-grid"
				/>
			</div>
		</div>
	{:else if roomId === 'hot-wall'}
		<div class="space-y-10">
			<div aria-hidden="true" class="flex flex-col items-center gap-4">
				<div
					class="mt-12 aspect-square w-full max-w-md animate-pulse rounded-xl border border-hairline bg-linen"
				></div>
			</div>

			<div class="w-full">
				<PolaroidSkeletonGrid
					count={cardCount}
					{gridClassName}
					testId="room-loading-skeleton-grid"
				/>
			</div>
		</div>
	{:else if roomId === 'mystery'}
		<div
			aria-hidden="true"
			class="relative flex min-h-[320px] flex-col items-center justify-center gap-8 px-2 py-6 pt-28 md:min-h-[400px] md:gap-16 md:px-0 md:py-8 md:pt-55"
		>
			<div
				class="h-[200px] w-full animate-pulse rounded-xl border border-hairline bg-linen md:h-[280px]"
			></div>
			<div
				class="h-14 w-full max-w-[16rem] animate-pulse rounded-xl bg-sand md:h-16 md:max-w-[20rem]"
			></div>
		</div>
	{:else}
		<div class="w-full">
			<PolaroidSkeletonGrid count={cardCount} {gridClassName} testId="room-loading-skeleton-grid" />
		</div>
	{/if}
</div>
