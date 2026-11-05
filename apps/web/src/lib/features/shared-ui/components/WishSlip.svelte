<script lang="ts">
	import type { Snippet } from 'svelte';

	/*
	 * A strip torn from a ruled sheet with what somebody would love to see drawn:
	 * the same paper in the mailbox, on the sketchbook and beside the postcard.
	 */
	let {
		byline,
		children,
		label,
		text,
		tilt = 0
	}: {
		byline?: string;
		children?: Snippet;
		/** A small printed heading over the handwriting. */
		label?: string;
		text?: string;
		tilt?: number;
	} = $props();
</script>

<span class="wish-slip" style:--slip-tilt={`${tilt}deg`}>
	<span class="wish-slip-paper">
		{#if label}
			<span class="wish-slip-label">{label}</span>
		{/if}
		{#if text}
			<span class="wish-slip-text">{text}</span>
		{/if}
		{@render children?.()}
		{#if byline}
			<span class="wish-slip-by">{byline}</span>
		{/if}
	</span>
</span>

<style>
	/* The clip-path would cut its shadow off, so the shadow is cast by the span
	 * around it, as the fork tag's is. */
	.wish-slip {
		display: inline-block;
		max-width: 100%;
		rotate: var(--slip-tilt);
		filter: drop-shadow(0.05em 0.16em 0.14em rgb(40 25 10 / 0.34));
	}

	.wish-slip-paper {
		display: block;
		padding: var(--slip-padding, 0.62rem 1.25rem 0.5rem 1.35rem);
		background-color: #fbf8f2;
		background-image: linear-gradient(
			transparent calc(100% - 1.72rem),
			rgb(90 120 160 / 0.2) calc(100% - 1.72rem),
			rgb(90 120 160 / 0.2) calc(100% - 1.66rem),
			transparent calc(100% - 1.66rem)
		);
		clip-path: polygon(
			0.3rem 0,
			100% 0,
			calc(100% - 0.34rem) 14%,
			100% 27%,
			calc(100% - 0.22rem) 44%,
			100% 58%,
			calc(100% - 0.38rem) 73%,
			calc(100% - 0.08rem) 88%,
			calc(100% - 0.3rem) 100%,
			0 100%,
			0.26rem 84%,
			0.04rem 66%,
			0.32rem 51%,
			0.06rem 33%,
			0.28rem 17%
		);
	}

	.wish-slip-label {
		display: block;
		margin-bottom: 0.15rem;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(45 36 32 / 0.68);
	}

	.wish-slip-text {
		display: block;
		font-family: var(--font-hand);
		font-size: var(--slip-text, 1.5rem);
		font-weight: 600;
		line-height: 1.12;
		color: var(--color-ink-warm);
	}

	.wish-slip-by {
		display: block;
		margin-top: 0.1rem;
		font-family: var(--font-hand);
		font-size: 1rem;
		line-height: 1.1;
		text-align: right;
		color: rgb(45 36 32 / 0.68);
	}
</style>
