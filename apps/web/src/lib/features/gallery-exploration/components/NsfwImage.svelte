<script lang="ts" module>
	// Sources whose pixels have already been decoded in this session. The
	// virtualizer recycles rows constantly, and a card coming back from the
	// buffer must reappear instantly instead of replaying the 200ms fade.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- session-wide memo, deliberately non-reactive
	const settledSources = new Set<string>();

	// Once the photo is opaque the LQIP underneath is invisible, so its blur is
	// pure GPU cost. Retire it a beat after the crossfade ends — on a timer, not
	// on `transitionend`, because a cached image never runs a transition at all.
	const PLACEHOLDER_RETIRE_MS = 250;
</script>

<script lang="ts">
	let {
		src,
		alt,
		className = '',
		blurred = false,
		ariaLabel = undefined,
		loading = 'lazy',
		decoding = 'async',
		fetchpriority = 'auto',
		placeholder = null
	}: {
		src: string;
		alt: string;
		className?: string;
		blurred?: boolean;
		ariaLabel?: string;
		loading?: 'eager' | 'lazy';
		decoding?: 'async' | 'sync';
		fetchpriority?: 'auto' | 'high' | 'low';
		placeholder?: string | null;
	} = $props();

	let imageElement = $state<HTMLImageElement>();
	// Starts opaque so the server-rendered markup shows the real photo; the
	// effect below only opens the fade when the image genuinely has not landed.
	let isLoaded = $state(true);
	let placeholderRetired = $state(true);

	const markSettled = (settledSrc: string) => {
		settledSources.add(settledSrc);
		isLoaded = true;
	};

	$effect(() => {
		const currentSrc = src;

		if (settledSources.has(currentSrc) || (imageElement?.complete ?? false)) {
			markSettled(currentSrc);
			placeholderRetired = true;
			return;
		}

		isLoaded = false;
		placeholderRetired = false;
	});

	$effect(() => {
		if (!isLoaded) return;

		const timer = setTimeout(() => {
			placeholderRetired = true;
		}, PLACEHOLDER_RETIRE_MS);

		return () => {
			clearTimeout(timer);
		};
	});
</script>

<div class={`relative h-full w-full bg-[#ece4d8] ${className}`}>
	{#if placeholder}
		<!-- Blurred tiny preview stays mounted beneath the real image so a
		     recycled card never re-decodes it; the slight scale hides the blur's
		     soft edges at the frame border. -->
		<img
			src={placeholder}
			alt=""
			aria-hidden="true"
			draggable="false"
			class={`nsfw-layer nsfw-placeholder ${blurred ? 'is-sensitive' : ''} ${
				placeholderRetired && !blurred ? 'is-retired' : ''
			}`}
		/>
	{/if}
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
	{#if blurred}
		<div class="nsfw-scrim">
			<span class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black">18+</span>
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
	.nsfw-layer {
		position: absolute;
		inset: 0;
		height: 100%;
		width: 100%;
		object-fit: cover;
	}

	.nsfw-placeholder {
		scale: 1.06;
		filter: blur(var(--nsfw-placeholder-blur, 12px));
		transition:
			opacity 200ms ease,
			filter 200ms ease;
	}

	.nsfw-photo {
		opacity: 0;
		transition:
			opacity 200ms ease,
			filter 200ms ease,
			scale 200ms ease;
	}

	.nsfw-photo.is-loaded {
		opacity: 1;
	}

	.nsfw-placeholder.is-sensitive,
	.nsfw-photo.is-sensitive {
		scale: 1.04;
		filter: blur(var(--nsfw-blur, 20px)) saturate(0);
	}

	/* Only ever applied once the opaque photo covers it. */
	.nsfw-placeholder.is-retired {
		opacity: 0;
		filter: none;
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
		color: #fdfbf7;
	}
</style>
