<script lang="ts">
	import { homeFloatingPaint } from '$lib/features/home-entry-scene/state/home-entry.svelte';
</script>

<!-- Animated Background Particles -->
<div class="pointer-events-none absolute inset-0 overflow-hidden">
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
</div>

<!-- Floating Paint Splotches -->
<div class="pointer-events-none absolute inset-0 z-[5]">
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

<!-- Game Title -->
<div class="absolute top-16 left-1/2 z-20 -translate-x-1/2">
	<h1
		class="font-display text-center text-7xl font-black tracking-tight text-[#2d2420]"
		style="text-shadow: 4px 4px 0px #e8b896, 8px 8px 0px rgba(45, 36, 32, 0.2);"
	>
		NOT THE LOUVRE
	</h1>
	<p
		class="mt-2 text-center text-xl text-[#6b625a] italic"
		style="font-family: 'Baloo 2', sans-serif;"
	>
		Where masterpieces are made... or not
	</p>
</div>
<!-- Footer tagline -->
<div
	class="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 text-sm text-[#6b625a] italic"
	style="font-family: 'Baloo 2', sans-serif;"
>
	A social art studio where your doodles compete for glory
</div>
