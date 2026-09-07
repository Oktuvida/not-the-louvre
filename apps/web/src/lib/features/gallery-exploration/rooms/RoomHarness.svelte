<script lang="ts">
	import type { Component } from 'svelte';

	/*
	 * One harness for every room spec.
	 *
	 * The five per-room harnesses were the same file five times: restate the
	 * room's prop interface, destructure it, forward it, wrap it in a sized box
	 * so the virtualizer has something to measure. The only thing they added
	 * over rendering the room directly was that box, and the restated interfaces
	 * were free to drift from the components they stand in for.
	 *
	 * `onInstance` keeps what the FilmReel harness needed the bind for: a handle
	 * on the component's exported methods.
	 */
	// `roomProps`, not `props`: @testing-library/svelte's `rerender` unwraps a
	// top-level `props` key for backwards compatibility, which would swallow the
	// component along with it.
	let {
		component,
		onInstance,
		roomProps,
		style = 'height: 800px; overflow: auto;'
	}: {
		// Deliberately untyped over the room: a generic parameter cannot be
		// inferred through `render()`, so a typed one would collapse to its
		// constraint and reject every real component. Each spec keeps its own
		// typed `renderRoom` helper, which is where prop mistakes surface.
		component: unknown;
		onInstance?: (instance: Record<string, unknown> | undefined) => void;
		roomProps: Record<string, unknown>;
		style?: string;
	} = $props();

	const Room = $derived(component as Component<Record<string, unknown>>);
	let instance = $state<Record<string, unknown>>();

	$effect(() => {
		onInstance?.(instance);
	});
</script>

<div {style}>
	<Room bind:this={instance} {...roomProps} />
</div>
