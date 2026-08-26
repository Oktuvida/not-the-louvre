<script lang="ts">
	const BLUR_CLASSES = 'scale-[1.04] blur-lg saturate-0';

	let {
		src,
		alt,
		className = '',
		blurred = false,
		ariaLabel = undefined,
		loading = 'lazy',
		decoding = 'async',
		fetchpriority = 'auto'
	}: {
		src: string;
		alt: string;
		className?: string;
		blurred?: boolean;
		ariaLabel?: string;
		loading?: 'eager' | 'lazy';
		decoding?: 'async' | 'sync';
		fetchpriority?: 'auto' | 'high' | 'low';
	} = $props();

	let imageElement = $state<HTMLImageElement>();
	let isLoaded = $state(false);

	// Re-check on src changes so recycled cards fade the new image in too;
	// `complete` covers images that resolved from cache before hydration.
	$effect(() => {
		void src;
		isLoaded = imageElement?.complete ?? false;
	});
</script>

<div class={`relative h-full w-full bg-[#ece4d8] ${className}`}>
	<img
		bind:this={imageElement}
		{src}
		{alt}
		{loading}
		{decoding}
		{fetchpriority}
		onload={() => {
			isLoaded = true;
		}}
		aria-label={blurred ? ariaLabel : undefined}
		class={`h-full w-full object-cover transition duration-200 ${blurred ? BLUR_CLASSES : ''} ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
	/>
	{#if blurred}
		<div
			class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[rgba(45,36,32,0.6)] text-[#fdfbf7]"
		>
			<span class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black">18+</span>
			<p class="mt-2 text-[0.65rem] font-semibold tracking-wide uppercase opacity-80">
				Sensitive content
			</p>
		</div>
	{/if}
</div>
