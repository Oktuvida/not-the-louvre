<script lang="ts">
	import type { Snippet } from 'svelte';

	/*
	 * A notice chalked on a little blackboard on an easel, the way a museum
	 * closes a room: what happened, in chalk, and the way on underneath.
	 */
	let {
		children,
		message,
		title
	}: {
		children?: Snippet;
		message: string;
		title: string;
	} = $props();
</script>

<div class="chalk-easel">
	<svg class="chalk-easel-legs" viewBox="0 0 260 240" aria-hidden="true">
		<path
			d="M92 10 L 52 236 M168 10 L 208 236 M130 4 L 130 236"
			stroke="#6b4128"
			stroke-width="9"
			stroke-linecap="round"
		/>
		<path
			d="M92 10 L 52 236 M168 10 L 208 236"
			stroke="#8a5a34"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<path d="M60 190 L 200 190" stroke="#6b4128" stroke-width="7" stroke-linecap="round" />
	</svg>
	<div class="chalk-easel-board">
		<p class="chalk-easel-title">{title}</p>
		<p class="chalk-easel-message">{message}</p>
		{#if children}
			<div class="chalk-easel-action">{@render children()}</div>
		{/if}
	</div>
</div>

<style>
	.chalk-easel {
		position: relative;
		width: min(22rem, 100%);
		margin: 0 auto;
		padding-bottom: 4.5rem;
	}

	.chalk-easel-legs {
		position: absolute;
		inset: -0.5rem 2rem 0;
		width: calc(100% - 4rem);
		height: calc(100% + 0.5rem);
	}

	/* Slate in a wooden frame, a haze of old chalk wiped across it. */
	.chalk-easel-board {
		position: relative;
		padding: 1.1rem 1.25rem 1.2rem;
		text-align: center;
		border: 0.4rem solid #8a5a34;
		border-radius: 3px;
		background:
			radial-gradient(ellipse at 30% 35%, rgb(255 255 255 / 0.07), transparent 55%),
			radial-gradient(ellipse at 75% 70%, rgb(255 255 255 / 0.05), transparent 50%), #2d2a26;
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.4),
			0 8px 14px rgb(30 15 5 / 0.4);
	}

	.chalk-easel-title {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.05;
		color: #f3ece0;
	}

	.chalk-easel-message {
		margin: 0.45rem 0 0;
		font-family: var(--font-hand);
		font-size: 1.2rem;
		line-height: 1.2;
		color: #ddd4c4;
	}

	.chalk-easel-action {
		display: flex;
		justify-content: center;
		margin-top: 0.9rem;
	}
</style>
