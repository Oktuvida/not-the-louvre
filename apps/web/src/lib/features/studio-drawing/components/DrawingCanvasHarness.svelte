<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';

	type Controls = { redo(): boolean; undo(): boolean };

	// The canvas fills whatever box the page gives it; specs give it a known
	// one, so a CSS pixel maps to a known number of document pixels.
	let {
		onControls,
		scale = 1,
		size = 384,
		...props
	}: ComponentProps<typeof DrawingCanvas> & {
		onControls?: (controls: Controls) => void;
		/** A CSS transform on the box, as the studio's opening sketchbook applies. */
		scale?: number;
		size?: number;
	} = $props();

	let canvas = $state<Controls>();

	$effect(() => {
		if (canvas) onControls?.(canvas);
	});
</script>

<div
	style:width={`${size}px`}
	style:height={`${size}px`}
	style:transform={`scale(${scale})`}
	style:transform-origin="top left"
>
	<DrawingCanvas bind:this={canvas} {...props} />
</div>
