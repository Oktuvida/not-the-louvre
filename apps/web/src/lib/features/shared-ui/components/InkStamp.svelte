<script lang="ts">
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';

	/*
	 * Something the visitor did that did not save, stamped across the thing it
	 * was done to in red rubber-stamp ink: NOT SENT on a postcard, NOT
	 * PUBLISHED on a drawing. Under the stamp a slip of paper says what
	 * happened in one sentence and offers to do it again.
	 *
	 * The stamp covers its nearest positioned ancestor, so the caller puts it
	 * inside the thing that failed. It stays until the action is tried again or
	 * the visitor puts it away: a failure that faded on its own could be missed,
	 * and the work it is about is still there to be saved. Only the slip takes
	 * clicks; the rest of the thing underneath stays usable.
	 *
	 * It lands with a thump of motion, and simply appears for a visitor who
	 * asked for reduced motion.
	 */
	let {
		label,
		message,
		onDismiss,
		onRetry,
		retrying = false,
		retryLabel = 'Try again'
	}: {
		/** The stamp's two or three words, e.g. "Not sent". */
		label: string;
		/** One sentence: what did not happen. */
		message: string;
		onDismiss?: () => void;
		/** Does the same thing again; without it the slip only explains. */
		onRetry?: () => void;
		retrying?: boolean;
		retryLabel?: string;
	} = $props();
</script>

<div class="ink-stamp-cover" role="alert">
	<p class="ink-stamp">{label}</p>
	<div class="ink-stamp-slip">
		<p class="ink-stamp-message">{message}</p>
		{#if onRetry || onDismiss}
			<div class="ink-stamp-actions">
				{#if onRetry}
					<GameButton size="sm" variant="primary" disabled={retrying} onclick={onRetry}>
						<span>{retrying ? 'Trying again…' : retryLabel}</span>
					</GameButton>
				{/if}
				{#if onDismiss}
					<button
						type="button"
						class="ink-stamp-dismiss focus-ring"
						aria-label="Put the notice away"
						onclick={onDismiss}
					>
						<svg viewBox="0 0 20 20" aria-hidden="true">
							<path d="M4.5 4 C 8 8, 11 11.5, 15.5 16 M15 4.5 C 11.5 8, 8.5 11, 4.5 15.5"></path>
						</svg>
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.ink-stamp-cover {
		position: absolute;
		inset: 0;
		z-index: 30;
		container-type: size;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.75rem;
		pointer-events: none;
	}

	/* Red ink from a rubber stamp: a double frame, letters spaced out, and a
	 * mottled mask where the ink did not take. */
	.ink-stamp {
		margin: 0;
		padding: 0.3em 0.75em;
		border: 0.16em solid currentColor;
		border-radius: 0.28em;
		outline: 0.05em solid currentColor;
		outline-offset: -0.34em;
		color: var(--color-stamp);
		font-family: var(--font-display);
		font-size: clamp(1rem, 10cqi, 2.6rem);
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		white-space: nowrap;
		rotate: -9deg;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='40'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0.5'/%3E%3C/filter%3E%3Crect width='90' height='40' filter='url(%23m)'/%3E%3C/svg%3E")
			0 0 / 90px 40px;
		animation: ink-stamp-land 420ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
	}

	@keyframes ink-stamp-land {
		from {
			opacity: 0;
			scale: 1.7;
		}

		60% {
			opacity: 1;
			scale: 0.94;
		}

		to {
			opacity: 1;
			scale: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ink-stamp {
			animation: none;
		}
	}

	/* A slip of paper tucked under the stamp. */
	.ink-stamp-slip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		max-width: min(18rem, 100%);
		padding: 0.6rem 0.85rem 0.7rem;
		background: var(--color-paper-bright);
		box-shadow:
			0 1px 2px rgb(40 25 10 / 0.2),
			0 6px 14px rgb(40 25 10 / 0.18);
		rotate: 1.2deg;
		pointer-events: auto;
	}

	.ink-stamp-message {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.2rem;
		font-weight: 700;
		line-height: 1.15;
		color: var(--color-ink-warm);
		text-align: center;
		text-wrap: pretty;
	}

	.ink-stamp-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.ink-stamp-dismiss {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--color-muted-ink);
		cursor: pointer;
	}

	.ink-stamp-dismiss svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
</style>
