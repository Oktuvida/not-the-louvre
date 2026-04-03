<script lang="ts">
	interface Props {
		onTrigger?: () => void;
		onRetry?: () => void;
		disabled?: boolean;
		hasMore: boolean;
		isLoading: boolean;
		error: string | null;
		rootMargin?: string;
		skeletonCount?: number;
	}

	let {
		onTrigger,
		onRetry,
		disabled = false,
		hasMore,
		isLoading,
		error,
		rootMargin = '200px',
		skeletonCount = 3
	}: Props = $props();

	let sentinelRef: HTMLDivElement | undefined = $state();

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

{#if isLoading}
	<div
		data-testid="scroll-sentinel-skeleton"
		class="grid grid-cols-1 gap-6 py-6 md:grid-cols-2 lg:grid-cols-3"
	>
		{#each Array.from({ length: skeletonCount }, (_, i) => i) as i (i)}
			<div data-testid="skeleton-card-{i}" class="animate-pulse">
				<div class="rounded-sm bg-stone-200 p-3 shadow">
					<div class="aspect-square w-full rounded-xs bg-stone-300"></div>
					<div class="mt-3 flex items-center gap-2">
						<div class="h-8 w-8 rounded-full bg-stone-300"></div>
						<div class="flex-1 space-y-1.5">
							<div class="h-3 w-3/4 rounded bg-stone-300"></div>
							<div class="h-2.5 w-1/2 rounded bg-stone-300"></div>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
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
