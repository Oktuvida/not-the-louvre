<script lang="ts">
	import { homeFloatingPaint } from '$lib/features/home-entry-scene/state/home-entry.svelte';

	let {
		className = '',
		testId = 'ambient-particle-overlay'
	}: { className?: string; testId?: string } = $props();

	let animatedLayer: HTMLDivElement | null = $state(null);
	let onScreen = $state(true);
	let pageVisible = $state(true);

	/*
	 * 23 elements — 18 particles plus five 64px blobs under a 10px `filter:
	 * blur()`, each of which is pinned to its own rendering surface — used to
	 * animate for the entire life of the gallery, the home and the studio. The
	 * gallery is the expensive case: the overlay's host spans the whole
	 * (arbitrarily tall) document, so once the visitor scrolls past the 180vh
	 * cap the whole set kept ticking somewhere above the viewport forever.
	 *
	 * Pausing is `animation-play-state`, not unmounting: the particles keep
	 * their positions and phases, so scrolling back finds the ambience exactly
	 * where it was rather than restarted in unison.
	 */
	const running = $derived(onScreen && pageVisible);

	$effect(() => {
		const layer = animatedLayer;
		if (!layer) return;

		const readVisibility = () => {
			pageVisible = document.visibilityState === 'visible';
		};
		readVisibility();
		document.addEventListener('visibilitychange', readVisibility);

		if (typeof IntersectionObserver === 'undefined') {
			return () => document.removeEventListener('visibilitychange', readVisibility);
		}

		const observer = new IntersectionObserver(
			(entries) => {
				onScreen = entries.some((entry) => entry.isIntersecting);
			},
			// A screen of slack so the ambience is already moving by the time the
			// layer scrolls back in, never caught mid-resume.
			{ rootMargin: '100% 0px' }
		);
		observer.observe(layer);

		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', readVisibility);
		};
	});
</script>

<div
	class={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
	data-testid={testId}
	aria-hidden="true"
>
	<div
		class="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,248,237,0.16),transparent_34%),linear-gradient(180deg,rgba(255,252,245,0.08),rgba(228,214,196,0.26))]"
	></div>

	<!-- Animated layer is capped near the first viewports: particles far below
	     the fold would tick the compositor forever without ever being seen. -->
	<div
		bind:this={animatedLayer}
		class="ambient-motion absolute inset-x-0 top-0 h-full max-h-[180vh] overflow-hidden motion-reduce:hidden"
		class:is-paused={!running}
		data-running={running}
	>
		{#each Array.from({ length: 18 }).map((_, index) => index) as index (`particle-${index}`)}
			<div
				class="ambient-particle absolute h-3 w-3 animate-[drift_6s_ease-in-out_infinite] rounded-full"
				style={`
					background: ${['#f4c430', '#d4956c', '#8b9d91', '#c84f4f', '#e8b896'][index % 5]};
					left: ${(index * 13) % 100}%;
					top: ${(index * 17) % 100}%;
					opacity: 0.15;
					animation-delay: ${index * 0.12}s;
				`}
			></div>
		{/each}

		<div class="absolute inset-0 z-5">
			{#each homeFloatingPaint as color, index (`splotch-${color}-${index}`)}
				<!-- No `blur-sm` here: `.paint-blob` is unlayered CSS and beats
				     Tailwind's layered `filter`, so the class was dead weight and
				     a future "soften the blobs" tweak would have edited nothing. -->
				<div
					class="paint-blob absolute rounded-full opacity-20"
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
</div>

<style>
	/*
	 * Unlayered, and more specific than both `.animate-[drift_…]` and the
	 * `.paint-blob` utility, so it wins the `animation-play-state` longhand
	 * without touching the `animation` shorthand either of them declares.
	 */
	.ambient-motion.is-paused .ambient-particle,
	.ambient-motion.is-paused .paint-blob {
		animation-play-state: paused;
	}
</style>
