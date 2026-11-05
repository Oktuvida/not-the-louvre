<script lang="ts">
	import { resolve } from '$app/paths';
	import AmbientParticleOverlay from '#lib/features/shared-ui/components/AmbientParticleOverlay.svelte';
	import { cutoutTitleAssetUrl } from '#lib/features/shared-ui/generated-art.js';

	let {
		isExiting = false,
		isInside = false
	}: {
		isExiting?: boolean;
		/** The visitor is in the room: outside, the title is behind the wall. */
		isInside?: boolean;
	} = $props();
</script>

{#snippet ransomNote()}
	<picture>
		<source
			media="(orientation: portrait)"
			srcset={cutoutTitleAssetUrl('stacked')}
			width="494"
			height="254"
		/>
		<img src={cutoutTitleAssetUrl('wide')} alt="Not the Louvre" width="943" height="140" />
	</picture>
{/snippet}

<AmbientParticleOverlay />

<!-- Game Title -->
<div
	class="home-hero absolute left-1/2 z-20 -translate-x-1/2 transition-[translate,opacity] duration-700 ease-in"
	class:-translate-y-[calc(100%+6rem)]={isExiting}
	class:opacity-0={isExiting}
>
	<!-- A ransom note cut from magazines and newspapers: one line on a screen
	     on its side, two on an upright one. Whoever tries pressing it meets who
	     cut it out. -->
	<h1 class="home-hero-title">
		{#if isInside}
			<a class="home-hero-link focus-ring" href={resolve('/gallery/staff')} title="Meet the staff">
				{@render ransomNote()}
			</a>
		{:else}
			{@render ransomNote()}
		{/if}
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
<!-- Lettered by hand on a strip of washi tape stuck to the floor's edge. -->
<div
	class="home-footer pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 transition-[translate,opacity] duration-700 ease-in"
	class:translate-y-[calc(100%+3rem)]={isExiting}
	class:opacity-0={isExiting}
>
	<p class="home-tagline tape tape-washi">
		A social art studio where your doodles compete for glory
	</p>
</div>

<style>
	/*
	 * The title fits the screen: half a wide screen on one line, most of an
	 * upright one on two, never larger than it was designed. On an upright
	 * screen a signed-in artist's corner (PersistentNav) is at the top left, so
	 * the title starts under it.
	 */
	/* As wide as its widest line, never wider than the screen: the subtitle
	 * keeps to one line where it fits and wraps on a small phone. */
	.home-hero {
		top: 4rem;
		width: max-content;
		max-width: calc(100vw - 2rem);
	}

	.home-hero-title {
		width: fit-content;
		margin: 0 auto;
		line-height: 0;
	}

	.home-hero-title img {
		display: block;
		width: clamp(20rem, 42vw, 44rem);
		height: auto;
	}

	.home-hero-link {
		display: block;
		transition: rotate var(--duration-ui) ease;
	}

	.home-hero-link:hover {
		rotate: -0.6deg;
	}

	@media (prefers-reduced-motion: reduce) {
		.home-hero-link {
			transition: none;
		}
	}

	@media (orientation: portrait) {
		.home-hero-title img {
			width: clamp(14rem, 64vw, 26rem);
		}

		:global([data-visitor='signed-in']) .home-hero {
			top: calc(var(--account-top, 1rem) + 8.8 * var(--account-em, 1rem) + 1rem);
		}
	}

	.home-tagline {
		position: relative;
		margin: 0;
		padding: 0.45rem 1.6rem 0.4rem;
		rotate: -1.5deg;
		font-family: var(--font-hand);
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 1.1;
		white-space: nowrap;
		color: var(--color-ink-warm);
	}

	/* The footer line only where it has the bottom of the screen to itself:
	 * an upright screen gives that to Gallery, a short one has no room. */
	@media (orientation: portrait), (max-height: 30rem) {
		.home-footer {
			display: none;
		}
	}
</style>
