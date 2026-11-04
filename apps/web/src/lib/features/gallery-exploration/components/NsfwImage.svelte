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
		undevelopedSrc = null;
	};

	/*
	 * A photo that did not come. The browser would draw its broken-image icon
	 * and the bare title; the polaroid stays empty instead, says so in pencil,
	 * and fetches the photo again by itself after a pause, then a longer one,
	 * and whenever the connection comes back.
	 */
	const RETRY_AFTER_MS = [2_000, 6_000];
	let undevelopedSrc = $state<string | null>(null);
	const undeveloped = $derived(undevelopedSrc === src);
	/** How many times the photo has been asked for again. */
	let attempt = $state(0);
	/*
	 * The browser keeps a failed image under its address for as long as the
	 * page lives, so a new try asks under a new one: the media route reads only
	 * the format from the query.
	 */
	const requestedSrc = $derived(
		attempt === 0 || /^(data|blob):/.test(src)
			? src
			: `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`
	);
	/*
	 * The photo the failures count against, copied out of the `src` prop by
	 * the effect below: an image can fail while its card or postcard is already
	 * on its way out, when the prop's own source is gone, so the error handler
	 * never reads the prop.
	 */
	let trackedSrc = '';
	let failures = 0;
	/** The element whose failure was last counted: the effect below runs again whenever the card re-renders. */
	let failedImage: Element | null = null;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	const tryAgain = () => {
		clearTimeout(retryTimer);
		retryTimer = undefined;
		attempt += 1;
	};

	const markUndeveloped = (image: Element) => {
		if (image === failedImage) return;
		failedImage = image;
		undevelopedSrc = trackedSrc;
		clearTimeout(retryTimer);
		const wait = RETRY_AFTER_MS[failures];
		failures += 1;
		retryTimer = wait === undefined ? undefined : setTimeout(tryAgain, wait);
	};

	$effect(() => () => clearTimeout(retryTimer));

	$effect(() => {
		const currentSrc = src;
		if (currentSrc !== trackedSrc) {
			trackedSrc = currentSrc;
			failures = 0;
		}

		// A server-rendered photo can fail before the page wakes up.
		if (imageElement?.complete && imageElement.naturalWidth === 0) {
			markUndeveloped(imageElement);
			return;
		}

		if (settledSources.has(currentSrc) || (imageElement?.complete ?? false)) {
			markSettled(currentSrc);
			return;
		}

		isLoaded = false;
	});
</script>

<svelte:window
	ononline={() => {
		if (undeveloped) tryAgain();
	}}
/>

<!-- The linen background is the placeholder: the cream paper every drawing is
     made on, at no cost, until the photo fades in over it. -->
<div class={`relative h-full w-full bg-linen ${className}`}>
	{#key attempt}
		<img
			bind:this={imageElement}
			src={requestedSrc}
			{alt}
			{loading}
			{decoding}
			{fetchpriority}
			onload={() => {
				markSettled(trackedSrc);
			}}
			onerror={(event) => markUndeveloped(event.currentTarget)}
			aria-label={blurred ? ariaLabel : undefined}
			class={`nsfw-photo relative h-full w-full object-cover ${blurred ? 'is-sensitive' : ''} ${
				isLoaded ? 'is-loaded' : ''
			} ${undeveloped ? 'is-undeveloped' : ''}`}
		/>
	{/key}
	{#if undeveloped}
		<p class="undeveloped">didn’t develop…</p>
	{:else if blurred && showScrim}
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

	/* Not drawn, so the browser paints no broken picture on the paper; it keeps
	 * its name for a screen reader, and comes back when a new try lands. */
	.nsfw-photo.is-undeveloped {
		opacity: 0;
	}

	/* The empty polaroid, lightly hatched in pencil, says what happened. */
	.undeveloped {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 8%;
		background-image: repeating-linear-gradient(
			-45deg,
			rgb(74 69 64 / 0.09) 0 1px,
			transparent 1px 7px
		);
		color: var(--color-muted-ink);
		font-family: var(--font-hand);
		font-size: 1.15em;
		text-align: center;
		pointer-events: none;
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
