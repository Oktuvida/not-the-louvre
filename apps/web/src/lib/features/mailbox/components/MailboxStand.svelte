<script lang="ts">
	import MailboxDrawing from '#lib/features/mailbox/components/MailboxDrawing.svelte';

	let { onOpen }: { onOpen: () => void } = $props();
</script>

<!-- It stands on the Gallery button with its post behind the sticker, and comes
     after it in the page so it can feel the button move. Gallery slides and
     turns under the pointer, and a post behind it has nothing to come away from.
     Like the record player and the cup, it says what it is on hover or focus. -->
<button
	type="button"
	class="mailbox-stand focus-ring"
	aria-label="The Mailbox"
	aria-haspopup="dialog"
	onclick={onOpen}
>
	<span class="mailbox-stand-slip" aria-hidden="true">the mailbox</span>
	<MailboxDrawing />
</button>

<style>
	.mailbox-stand {
		--focus-ring-offset: 3px;
		position: absolute;
		bottom: calc(100% - 0.55rem);
		left: 0.7rem;
		z-index: 0;
		width: 7.6rem;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		transform-origin: 44% 92%;
		transition: rotate var(--duration-ui) ease;
	}

	.mailbox-stand-slip {
		position: absolute;
		bottom: calc(100% - 0.4rem);
		left: 50%;
		padding: 4px 10px 3px;
		background: #fbf8f2;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.08),
			0 4px 8px rgb(40 25 10 / 0.22);
		font-family: var(--font-hand);
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.1;
		white-space: nowrap;
		color: var(--color-ink-warm);
		opacity: 0;
		translate: -50% 6px;
		rotate: -2deg;
		pointer-events: none;
		transition:
			opacity 200ms ease,
			translate 200ms ease;
	}

	.mailbox-stand:focus-visible .mailbox-stand-slip {
		opacity: 1;
		translate: -50% 0;
	}

	.mailbox-stand :global(.mailbox-flag) {
		transition: transform 200ms cubic-bezier(0.3, 1.8, 0.5, 1);
	}

	.mailbox-stand :global(.mailbox-slips) {
		transition: transform 200ms ease;
	}

	/* Only where there is a pointer: a tap would leave them stuck out. */
	@media (hover: hover) {
		.mailbox-stand:hover {
			rotate: -3deg;
		}

		.mailbox-stand:hover .mailbox-stand-slip {
			opacity: 1;
			translate: -50% 0;
		}

		.mailbox-stand:hover :global(.mailbox-flag) {
			transform: rotate(7deg);
		}

		.mailbox-stand:hover :global(.mailbox-slips) {
			transform: translateX(-6px);
		}

		/* Gallery moves beside it, and it rocks on its post. */
		:global(.home-gallery:hover) ~ .mailbox-stand {
			rotate: 2deg;
		}

		:global(.home-gallery:hover) ~ .mailbox-stand :global(.mailbox-flag) {
			transform: rotate(-6deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mailbox-stand,
		.mailbox-stand :global(.mailbox-flag),
		.mailbox-stand :global(.mailbox-slips) {
			transition: none;
		}

		.mailbox-stand-slip {
			transition: opacity 200ms ease;
		}
	}
</style>
