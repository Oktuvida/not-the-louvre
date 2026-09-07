<script lang="ts">
	import PolaroidSkeletonGrid from '$lib/features/gallery-exploration/components/PolaroidSkeletonGrid.svelte';

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

{#if error}
	<div
		data-testid="scroll-sentinel-error"
		class="flex flex-col items-center gap-3 py-8 text-center"
	>
		<p class="text-sm text-stone-600">{error}</p>
		<button
			type="button"
			class="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700"
			onclick={() => onRetry?.()}
		>
			Retry
		</button>
	</div>
{/if}

{#if !hasMore && !isLoading && !error}
	<div data-testid="scroll-sentinel-end" class="py-8 text-center">
		<p class="text-sm text-stone-400">You've seen it all — nothing more to show.</p>
	</div>
{/if}

<div
	bind:this={sentinelRef}
	data-testid="scroll-sentinel"
	style="height: 1px; width: 100%;"
	aria-hidden="true"
></div>
