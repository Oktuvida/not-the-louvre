<script lang="ts">
	import PolaroidSkeletonGrid from '#lib/features/gallery-exploration/components/PolaroidSkeletonGrid.svelte';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';

	interface Props {
		onTrigger?: () => void;
		onRetry?: () => void;
		disabled?: boolean;
		hasMore: boolean;
		isLoading: boolean;
		error: string | null;
		rootMargin?: string;
		skeletonCount?: number;
		skeletonGridClassName?: string;
	}

	let {
		onTrigger,
		onRetry,
		disabled = false,
		hasMore,
		isLoading,
		error,
		rootMargin = '400px',
		skeletonCount = 3,
		skeletonGridClassName = 'grid gap-6 py-6'
	}: Props = $props();

	let sentinelRef: HTMLDivElement | undefined = $state();

	/*
	 * Paging is otherwise silent for a screen reader: the skeleton cards are
	 * decoration and the error text is a plain paragraph nothing points at. One
	 * always-mounted polite region (a region that only appears with its message
	 * is announced unreliably) reports the terminal states, in wording that does
	 * not duplicate the visible copy.
	 */
	const statusMessage = $derived.by(() => {
		if (error) return 'More artworks could not be loaded.';
		if (isLoading) return 'Loading more artworks…';
		if (!hasMore) return 'No more artworks to load.';
		return '';
	});

	$effect(() => {
		if (!sentinelRef) return;
		if (disabled || !hasMore || isLoading || error) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting) {
					onTrigger?.();
				}
			},
			{ rootMargin }
		);

		observer.observe(sentinelRef);

		return () => {
			observer.disconnect();
		};
	});
</script>

<p aria-live="polite" class="sr-only" data-testid="scroll-sentinel-status" role="status">
	{statusMessage}
</p>

{#if isLoading}
	<PolaroidSkeletonGrid
		cardTestIdPrefix="skeleton-card-"
		count={skeletonCount}
		gridClassName={skeletonGridClassName}
		testId="scroll-sentinel-skeleton"
	/>
{/if}

<!--
	Both notices sit on the dark museum wall (var(--color-wall)), where the stone greys they
	used to wear resolved to ~2.1:1. The palette here is the wall's own paper and
	dust tones, and the retry is the same sticker control every other action in the
	gallery uses instead of a lone flat grey button.
-->
{#if error}
	<div
		data-testid="scroll-sentinel-error"
		class="flex flex-col items-center gap-3 py-8 text-center"
	>
		<p class="wall-text text-sm text-wall-text">{error}</p>
		<GameButton variant="secondary" size="sm" onclick={() => onRetry?.()}>
			<span class="font-semibold">Retry</span>
		</GameButton>
	</div>
{/if}

{#if !hasMore && !isLoading && !error}
	<div data-testid="scroll-sentinel-end" class="py-8 text-center">
		<p class="wall-text text-sm text-clay">You've seen it all — nothing more to show.</p>
	</div>
{/if}

<div
	bind:this={sentinelRef}
	data-testid="scroll-sentinel"
	style="height: 1px; width: 100%;"
	aria-hidden="true"
></div>

<style>
	/* The wall is a photographic texture, not a flat fill; the same shadow the
	 * room empty states use keeps the text readable over its lighter bricks. */
	.wall-text {
		text-shadow: 0 1px 2px rgba(45, 36, 32, 0.5);
	}
</style>
