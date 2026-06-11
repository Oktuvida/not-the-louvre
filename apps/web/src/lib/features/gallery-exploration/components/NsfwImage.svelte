<script lang="ts">
	const BLUR_CLASSES = 'scale-[1.04] blur-lg saturate-0';

	let {
		src,
		alt,
		className = '',
		blurred = false,
		ariaLabel = undefined,
		loading = 'lazy',
		decoding = 'async'
	}: {
		src: string;
		alt: string;
		className?: string;
		blurred?: boolean;
		ariaLabel?: string;
		loading?: 'eager' | 'lazy';
		decoding?: 'async' | 'sync';
	} = $props();
</script>

<div class={`relative h-full w-full ${className}`}>
	<img
		{src}
		{alt}
		{loading}
		{decoding}
		aria-label={blurred ? ariaLabel : undefined}
		class={`h-full w-full object-cover transition duration-200 ${blurred ? BLUR_CLASSES : ''}`}
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
