<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/*
	 * A strip of washi tape stuck to a sheet of paper, used as a control.
	 *
	 * The ten-point torn-ends clip-path was copy-pasted verbatim — comment and
	 * all — into the auth sheet's close button, the avatar sheet's close button
	 * and the detail panel's safety chips, which is three chances for the tape
	 * to stop looking like the same tape.
	 *
	 * The angle is the one thing that legitimately varies between strips, so it
	 * is a prop and lands inline, where it beats this component's own rule.
	 */
	let {
		children,
		class: className = '',
		element = $bindable(null),
		rotate = '2.4deg',
		type = 'button',
		...rest
	}: HTMLButtonAttributes & {
		children?: Snippet;
		class?: string;
		element?: HTMLButtonElement | null;
		/** How crooked the strip is stuck on. */
		rotate?: string;
	} = $props();
</script>

<button
	bind:this={element}
	class={`washi-tape focus-ring ${className}`.trim()}
	style={`rotate: ${rotate};`}
	{type}
	{...rest}
>
	{@render children?.()}
</button>

<style>
	.washi-tape {
		flex-shrink: 0;
		border: 0;
		padding: 9px 18px;
		font-weight: 700;
		color: var(--color-olive);
		cursor: pointer;
		background: repeating-linear-gradient(
			-45deg,
			rgba(228, 214, 186, 0.92) 0 10px,
			rgba(240, 230, 207, 0.92) 10px 20px
		);
		box-shadow: 0 2px 5px rgba(45, 36, 32, 0.22);
		/* torn tape ends — drop this line if it ghosts */
		clip-path: polygon(
			3% 0%,
			97% 2%,
			100% 26%,
			98% 52%,
			100% 78%,
			96% 100%,
			4% 98%,
			0% 70%,
			2% 44%,
			0% 22%
		);
		transition: translate 140ms ease;
	}

	.washi-tape:hover {
		translate: 0 -2px;
	}
</style>
