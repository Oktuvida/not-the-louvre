<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';

	// The canvas fills whatever box the page gives it; specs give it a known
	// one, so a CSS pixel maps to a known number of document pixels.
	let { size = 384, ...props }: ComponentProps<typeof DrawingCanvas> & { size?: number } = $props();
</script>

<div style:width={`${size}px`} style:height={`${size}px`}>
	<DrawingCanvas {...props} />
</div>
