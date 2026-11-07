<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/*
	 * A strip of washi tape stuck to a sheet of paper, used as a control.
	 *
	 * The strip itself is the app's paper tape (`.tape` in utilities.css), the
	 * same tape that holds the notes and photos down, printed with this
	 * control's own quiet weave so its label stays readable.
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
	class={`washi-tape tape focus-ring ${className}`.trim()}
	style={`rotate: ${rotate};`}
	{type}
	{...rest}
>
	{@render children?.()}
</button>

<style>
	.washi-tape {
		--tape-paper: rgb(240 230 207 / 0.92);
		--tape-print: repeating-linear-gradient(
			-45deg,
			rgb(228 214 186 / 0.92) 0 10px,
			transparent 10px 20px
		);
		position: relative;
		flex-shrink: 0;
		border: 0;
		padding: 9px 18px;
		font-weight: 700;
		color: var(--color-olive);
		cursor: pointer;
		background: none;
		transition: translate 140ms ease;
	}

	.washi-tape:hover {
		translate: 0 -2px;
	}
</style>
