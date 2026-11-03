<script lang="ts">
	import PolaroidSkeletonGrid from '#lib/features/gallery-exploration/components/PolaroidSkeletonGrid.svelte';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import ChalkEasel from '#lib/features/gallery-exploration/components/ChalkEasel.svelte';
	import VelvetRope from '#lib/features/gallery-exploration/components/VelvetRope.svelte';

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
		// Two screens ahead: the next page is on its way long before the visitor
		// reaches the end of this one, even on a fast fling over a slow network.
		rootMargin = '200% 0px',
		skeletonCount = 3,
		skeletonGridClassName = 'py-6'
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
			// The document as root, not the implicit one: the implicit root drops
			// the margin whenever the page is framed (an embed, a test runner).
			{ root: document, rootMargin }
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
	Both notices are objects on the wall, not text over its bricks: a failed page
	is chalked on an easel with its retry, and the end of the wall is roped off
	with its label. Either way the words sit on their own board or paper.
-->
{#if error}
	<div data-testid="scroll-sentinel-error" class="py-8">
		<ChalkEasel title="The next wall is still being hung." message={error}>
			<GameButton variant="secondary" size="sm" onclick={() => onRetry?.()}>
				<span class="font-semibold">Try again</span>
			</GameButton>
		</ChalkEasel>
	</div>
{/if}

{#if !hasMore && !isLoading && !error}
	<div data-testid="scroll-sentinel-end" class="py-10">
		<VelvetRope />
	</div>
{/if}

<div
	bind:this={sentinelRef}
	data-testid="scroll-sentinel"
	style="height: 1px; width: 100%;"
	aria-hidden="true"
></div>
