<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	/*
	 * One sheet of museum paper.
	 *
	 * The same three declarations — `var(--color-paper)`, a 3px radius and the two-layer
	 * shadow — used to be typed out in four component stylesheets, each with its
	 * own copy of the paper-grain data URI. They drifted, visibly: the tool tray
	 * sat under a shadow 12% lighter than the auth sheet a click away.
	 *
	 * The material now lives once, as the `.paper-sheet` / `.paper-grain` pair in
	 * `shared-ui/styles/utilities.css`, and this component is the ergonomic way
	 * to wear it. It is a class rather than a private rule in here because Svelte
	 * does not scope a class passed to a component: any sheet that keeps its own
	 * scoped geometry — the ops desk's `<section>`s, the studio's tool tray — has
	 * to stay a plain element, and the auth sheet carries a `use:` action, which
	 * a component cannot take at all. The class reaches all of them.
	 *
	 * The grain is a separate class because two of the sheets scroll: their
	 * grain has to sit on the inner element that scrolls with the content, not
	 * on the clipping box. Those pass `grain={false}` and wear `paper-grain` on
	 * that inner element themselves.
	 */
	let {
		as = 'div',
		children,
		class: className = '',
		element = $bindable(null),
		grain = true,
		...rest
	}: HTMLAttributes<HTMLElement> & {
		/** The tag to paint the sheet as — `section` where the sheet is a landmark. */
		as?: 'div' | 'section' | 'article' | 'aside';
		children?: Snippet;
		/** Geometry only: padding, rotation, width. The paper is not overridable. */
		class?: string;
		element?: HTMLElement | null;
		/** `false` when the sheet scrolls and the grain belongs on its content. */
		grain?: boolean;
	} = $props();

	const classes = $derived(
		['paper-sheet', grain ? 'paper-grain' : '', className].filter(Boolean).join(' ')
	);
</script>

<svelte:element this={as} bind:this={element} class={classes} {...rest}>
	{@render children?.()}
</svelte:element>
