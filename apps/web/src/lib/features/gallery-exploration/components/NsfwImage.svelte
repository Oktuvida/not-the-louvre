<script lang="ts" module>
	// Sources whose pixels have already been decoded in this session. The
	// virtualizer recycles rows constantly, and a card coming back from the
	// buffer must reappear instantly instead of replaying the 200ms fade.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- session-wide memo, deliberately non-reactive
	const settledSources = new Set<string>();
</script>

<script lang="ts">
	let {
		src,
		alt,
		className = '',
		blurred = false,
		showScrim = true,
		ariaLabel = undefined,
		loading = 'lazy',
		decoding = 'async',
		fetchpriority = 'auto'
	}: {
		src: string;
		alt: string;
		className?: string;
		blurred?: boolean;
		/**
		 * The built-in "18+ / Sensitive content" scrim. Surfaces that paint their
		 * own, richer scrim over the same box — the artwork detail panel, whose
		 * scrim also carries the "Reveal 18+ artworks" call to action — opt out of
		 * it so the badge is not announced twice, while still reading the shared
		 * blur treatment from the `--nsfw-*` tokens.
		 */
		showScrim?: boolean;
		ariaLabel?: string;
		loading?: 'eager' | 'lazy';
		decoding?: 'async' | 'sync';
		fetchpriority?: 'auto' | 'high' | 'low';
	} = $props();

	let imageElement = $state<HTMLImageElement>();
	// Starts opaque so the server-rendered markup shows the real photo; the
	// effect below only opens the fade when the image genuinely has not landed.
	let isLoaded = $state(true);

	const markSettled = (settledSrc: string) => {
		settledSources.add(settledSrc);
		isLoaded = true;
	};

	$effect(() => {
		const currentSrc = src;

		if (settledSources.has(currentSrc) || (imageElement?.complete ?? false)) {
			markSettled(currentSrc);
			return;
		}

		isLoaded = false;
	});
</script>

<!-- The linen background is the placeholder: the cream paper every drawing is
     made on, at no cost, until the photo fades in over it. -->
<div class={`relative h-full w-full bg-linen ${className}`}>
	<img
		bind:this={imageElement}
		{src}
		{alt}
		{loading}
		{decoding}
		{fetchpriority}
		onload={() => {
			markSettled(src);
		}}
		aria-label={blurred ? ariaLabel : undefined}
		class={`nsfw-photo relative h-full w-full object-cover ${blurred ? 'is-sensitive' : ''} ${
			isLoaded ? 'is-loaded' : ''
		}`}
	/>
	{#if blurred && showScrim}
		<div class="nsfw-scrim">
			<span class="rounded-full border-2 border-paper-bright px-3 py-1 text-xs font-black">18+</span
			>
			<p class="mt-2 text-[0.65rem] font-semibold tracking-wide uppercase opacity-80">
				Sensitive content
			</p>
		</div>
	{/if}
</div>

<style>
	/* The NSFW treatment is written once, here, and read from the shared
	 * `--nsfw-*` tokens so the Hot Wall, the podium, the home preview stack and
	 * the Mystery reel all censor artwork at the same radius and scrim. */
	.nsfw-photo {
		opacity: 0;
		transition:
			opacity var(--duration-ui) ease,
			filter var(--duration-ui) ease,
			scale var(--duration-ui) ease;
	}

	.nsfw-photo.is-loaded {
		opacity: 1;
	}

	.nsfw-photo.is-sensitive {
		scale: 1.04;
		filter: blur(var(--nsfw-blur, 20px)) saturate(0);
	}

	.nsfw-scrim {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		background: var(--nsfw-scrim, rgba(45, 36, 32, 0.68));
		color: var(--color-paper-bright);
	}
</style>
