<script lang="ts">
	const BLUR_CLASSES = 'scale-[1.04] blur-xl saturate-0';

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

<img
	{src}
	{alt}
	{loading}
	{decoding}
	aria-label={blurred ? ariaLabel : undefined}
	class={`h-full w-full object-cover transition duration-200 ${blurred ? BLUR_CLASSES : ''} ${className}`}
/>
