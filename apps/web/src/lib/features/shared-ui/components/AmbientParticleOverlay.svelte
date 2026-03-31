<script lang="ts">
	import { homeFloatingPaint } from '$lib/features/home-entry-scene/state/home-entry.svelte';

	let {
		className = '',
		testId = 'ambient-particle-overlay'
	}: { className?: string; testId?: string } = $props();
</script>

<div
	class={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
	data-testid={testId}
	aria-hidden="true"
>
	<div
		class="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,248,237,0.16),transparent_34%),linear-gradient(180deg,rgba(255,252,245,0.08),rgba(228,214,196,0.26))]"
	></div>

	{#each Array.from({ length: 30 }).map((_, index) => index) as index (`particle-${index}`)}
		<div
			class="absolute h-3 w-3 animate-[drift_6s_ease-in-out_infinite] rounded-full"
			style={`
				background: ${['#f4c430', '#d4956c', '#8b9d91', '#c84f4f', '#e8b896'][index % 5]};
				left: ${(index * 13) % 100}%;
				top: ${(index * 17) % 100}%;
				opacity: 0.15;
				animation-delay: ${index * 0.12}s;
			`}
		></div>
	{/each}

	<div class="absolute inset-0 z-[5]">
		{#each homeFloatingPaint as color, index (`splotch-${color}-${index}`)}
			<div
				class="paint-blob absolute rounded-full opacity-20 blur-sm"
				style={`
					width: 64px;
					height: 64px;
					background: ${color};
					left: ${20 + index * 15}%;
					top: ${30 + (index % 3) * 20}%;
					animation-delay: ${index * 0.5}s;
				`}
			></div>
		{/each}
	</div>
</div>
