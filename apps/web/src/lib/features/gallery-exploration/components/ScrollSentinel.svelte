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
		class={skeletonGridClassName}
		style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))"
	>
		{#each Array.from({ length: skeletonCount }, (_, i) => i) as i (i)}
			<div data-testid="skeleton-card-{i}" class="animate-pulse">
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
