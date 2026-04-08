<script lang="ts">
	let {
		src,
		alt,
		width = 768,
		height = 768,
		className = ''
	}: {
		src: string;
		alt: string;
		width?: number;
		height?: number;
		className?: string;
	} = $props();
</script>

<img {src} {alt} {width} {height} loading="lazy" decoding="async" class={className} />
