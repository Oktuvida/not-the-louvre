<script lang="ts">
	import AmbientParticleOverlay from '#lib/features/shared-ui/components/AmbientParticleOverlay.svelte';

	let { isExiting = false }: { isExiting?: boolean } = $props();
</script>

<AmbientParticleOverlay />

<!-- Game Title -->
<div
	class="home-hero absolute left-1/2 z-20 -translate-x-1/2 transition-[translate,opacity] duration-700 ease-in"
	class:-translate-y-[calc(100%+6rem)]={isExiting}
	class:opacity-0={isExiting}
>
	<h1
		class="home-hero-title text-center font-display leading-none font-black tracking-tight whitespace-nowrap text-ink-warm"
		style="text-shadow: 4px 4px 0px #e8b896, 8px 8px 0px rgba(45, 36, 32, 0.2);"
	>
		NOT THE LOUVRE
	</h1>
	<p
		class="relative mx-auto mt-3 w-fit rotate-[-1.5deg] px-8 py-2 text-center text-xl text-[#4a3a30] italic"
		style="
    font-family: var(--font-body);
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 4px,
        rgba(180,155,100,0.06) 4px,
        rgba(180,155,100,0.06) 5px
      ),
      linear-gradient(
        178deg,
        rgba(243,222,172,0.80) 0%,
        rgba(232,210,155,0.76) 100%
      );
    clip-path: polygon(
      0%   2%,
      98%  0%,
      100% 100%,
      2%   98%
    );
    box-shadow: 1px 2px 6px rgba(0,0,0,0.13), inset 0 1px 0 rgba(255,255,255,0.25);
    mix-blend-mode: multiply;
  "
	>
		Where masterpieces are made... or not
	</p>
</div>
<!-- Footer tagline -->
<div
	class="home-footer pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 text-sm text-wall-text italic transition-[translate,opacity] duration-700 ease-in"
	class:translate-y-[calc(100%+3rem)]={isExiting}
	class:opacity-0={isExiting}
	style="font-family: var(--font-body); letter-spacing: 0.01em; text-shadow: 0 1px 1px rgba(45,36,32,.7), 0 2px 8px rgba(45,36,32,.35);"
>
	A social art studio where your doodles compete for glory
</div>

<style>
	/*
	 * The title fits the screen: as wide as a third of a wide screen, most of an
	 * upright one, never larger than it was designed (4.5rem). On an upright
	 * screen a signed-in artist's corner (PersistentNav) is at the top left, so
	 * the title starts under it.
	 */
	.home-hero {
		top: 4rem;
	}

	.home-hero-title {
		font-size: clamp(2.25rem, 5vw, 4.5rem);
	}

	@media (orientation: portrait) {
		.home-hero-title {
			font-size: clamp(2rem, 9vw, 4.5rem);
		}

		:global([data-visitor='signed-in']) .home-hero {
			top: calc(var(--account-top, 1rem) + 8.8 * var(--account-em, 1rem) + 1rem);
		}
	}

	/* The footer line only where it has the bottom of the screen to itself:
	 * an upright screen gives that to Gallery, a short one has no room. */
	@media (orientation: portrait), (max-height: 30rem) {
		.home-footer {
			display: none;
		}
	}
</style>
