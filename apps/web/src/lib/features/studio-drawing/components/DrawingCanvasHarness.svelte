<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';

	type Controls = { redo(): boolean; undo(): boolean };

	// The canvas fills whatever box the page gives it; specs give it a known
	// one, so a CSS pixel maps to a known number of document pixels.
	let {
		onControls,
		size = 384,
		...props
	}: ComponentProps<typeof DrawingCanvas> & {
		onControls?: (controls: Controls) => void;
		size?: number;
	} = $props();

	let canvas = $state<Controls>();

	$effect(() => {
		if (canvas) onControls?.(canvas);
	});
</script>

<div style:width={`${size}px`} style:height={`${size}px`}>
	<DrawingCanvas bind:this={canvas} {...props} />
</div>
