<script lang="ts">
	import type { Snippet } from 'svelte';

	/*
	 * An empty room: a spot on the wall pencilled out where a piece will hang,
	 * a card on a nail saying who it is reserved for, and the room's label
	 * beside it explaining the empty wall.
	 */
	let {
		children,
		message,
		reservedFor,
		support
	}: {
		children?: Snippet;
		message: string;
		reservedFor: string;
		support: string;
	} = $props();
</script>

<div class="reserved-spot">
	<div class="reserved-outline">
		<span class="reserved-nail" aria-hidden="true"></span>
		<svg class="reserved-string" viewBox="0 0 120 44" aria-hidden="true">
			<path d="M60 2 L 16 42 M60 2 L 104 42" stroke="#6b5a45" stroke-width="1.6" fill="none" />
		</svg>
		<div class="reserved-card">
			<p class="reserved-card-word">Reserved</p>
			<p class="reserved-card-for">{reservedFor}</p>
		</div>
		<span class="reserved-pencil" aria-hidden="true">your piece goes here</span>
	</div>

	<div class="reserved-label">
		<p class="reserved-message">{message}</p>
		<p class="reserved-support">{support}</p>
		{#if children}
			<div class="reserved-action">{@render children()}</div>
		{/if}
	</div>
</div>

<style>
	.reserved-spot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 2.5rem 3rem;
		padding: 2.5rem 1rem 1rem;
	}

	/* Where the piece will hang, pencilled out on the wall. */
	.reserved-outline {
		position: relative;
		width: min(17rem, 78vw);
		aspect-ratio: 1;
		border: 3px dashed rgb(45 32 20 / 0.55);
		border-radius: 2px;
		/* The wall is a shade lighter where a piece once kept the sun off it. */
		background: rgb(255 250 235 / 0.14);
	}

	.reserved-nail {
		position: absolute;
		top: -1.6rem;
		left: 50%;
		width: 0.7rem;
		height: 0.7rem;
		translate: -50% 0;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #d9cfbe, #6b5a45);
		box-shadow: 1px 2px 2px rgb(30 15 5 / 0.35);
	}

	.reserved-string {
		position: absolute;
		top: -1.35rem;
		left: 50%;
		width: 7.5rem;
		translate: -50% 0;
		overflow: visible;
	}

	.reserved-card {
		position: absolute;
		top: 1.1rem;
		left: 50%;
		width: 11rem;
		translate: -50% 0;
		rotate: 3deg;
		padding: 0.7rem 0.6rem 0.65rem;
		text-align: center;
		background-color: #fbf8f2;
		background-image: radial-gradient(rgb(107 90 69 / 0.08) 1px, transparent 1px);
		background-size: 4px 4px;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.08),
			0 6px 12px rgb(40 25 10 / 0.3);
	}

	.reserved-card-word {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #8f2a22;
	}

	.reserved-card-for {
		margin: 0.15rem 0 0;
		font-family: var(--font-hand);
		font-size: 1.6rem;
		font-weight: 700;
		line-height: 1;
		color: var(--color-ink-warm);
	}

	.reserved-pencil {
		position: absolute;
		right: 0;
		bottom: 1.6rem;
		left: 0;
		text-align: center;
		font-family: var(--font-hand);
		font-size: 1.45rem;
		color: rgb(45 32 20 / 0.72);
	}

	/* The room's label, the way a museum explains an empty wall. */
	.reserved-label {
		width: min(19rem, 86vw);
		padding: 1rem 1.1rem 1rem;
		background: #fdfcfa;
		box-shadow:
			0 1px 0 #ddd6ca,
			0 2px 0 #cfc6b8,
			0 6px 12px rgb(40 25 10 / 0.28);
	}

	.reserved-message {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.25;
		color: var(--color-ink-warm);
	}

	.reserved-support {
		margin: 0.5rem 0 0;
		font-size: 0.95rem;
		line-height: 1.35;
		color: #4a3e36;
	}

	.reserved-action {
		margin-top: 1rem;
	}
</style>
