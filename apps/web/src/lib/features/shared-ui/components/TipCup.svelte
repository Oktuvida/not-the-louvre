<script lang="ts">
	import { KOFI_HANDLE } from '#lib/features/shared-ui/support.js';
</script>

<!-- A cup of coffee beside the record player, in plain sight on every page a
     visitor walks through. On a small screen the cup goes alone, and its line
     stays for a screen reader. -->
<a
	class="tip-cup focus-ring"
	href={`https://ko-fi.com/${KOFI_HANDLE}`}
	rel="noopener noreferrer"
	target="_blank"
>
	<span class="tip-cup-slip">help us keep the museum open</span>
	<svg class="tip-cup-drawing" viewBox="0 0 64 64" aria-hidden="true">
		<g class="tip-cup-edge">
			<path d="M12 28h34v14c0 8-6 13-13 13h-8c-7 0-13-5-13-13z"></path>
			<path d="M46 31h4c9 0 9 14 0 14h-5"></path>
			<path d="M23 19c-3-3 3-6 0-10M34 19c-3-3 3-6 0-10"></path>
		</g>
		<g class="tip-cup-ink">
			<path class="tip-cup-china" d="M12 28h34v14c0 8-6 13-13 13h-8c-7 0-13-5-13-13z"></path>
			<path d="M46 31h4c9 0 9 14 0 14h-5"></path>
			<path d="M23 19c-3-3 3-6 0-10M34 19c-3-3 3-6 0-10"></path>
		</g>
		<path class="tip-cup-heart" d="M29 46.5l-6.2-6c-3.8-3.7 1.9-9 6.2-4.2 4.3-4.8 10 .5 6.2 4.2z"
		></path>
	</svg>
</a>

<style>
	/* On a screen on its side it stands on the record player: its margin, its
	 * size and a gap above it. */
	.tip-cup {
		--focus-ring-offset: 3px;
		position: fixed;
		right: 20px;
		bottom: 88px;
		z-index: var(--z-ambient);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
	}

	/* Like the record player: nothing floats over a dimmed modal, clickable and
	 * in the tab order. Global because the dialog is elsewhere in the tree. */
	:global(body:has([role='dialog'][aria-modal='true'])) .tip-cup {
		display: none;
	}

	/* Pencilled on a slip of paper, as the Mystery Room's line is. */
	.tip-cup-slip {
		padding: 0.25rem 0.65rem 0.3rem;
		rotate: -1.5deg;
		background: #fffdf8;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.1),
			0 4px 10px rgb(40 25 10 / 0.3);
		color: #5a4a3c;
		font-family: var(--font-hand);
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.15;
		white-space: nowrap;
	}

	.tip-cup-drawing {
		display: block;
		flex: none;
		width: 56px;
		height: 56px;
		filter: drop-shadow(0 2px 3px rgb(40 25 10 / 0.45));
		transition: rotate var(--duration-ui) ease;
	}

	.tip-cup:hover .tip-cup-drawing {
		rotate: -6deg;
	}

	.tip-cup-edge,
	.tip-cup-ink {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* The white edge a sticker keeps when it is cut out. */
	.tip-cup-edge {
		stroke: #fffdf8;
		stroke-width: 11px;
	}

	.tip-cup-ink {
		stroke: var(--color-ink-warm);
		stroke-width: 3px;
	}

	.tip-cup-china {
		fill: var(--color-paper-bright);
	}

	.tip-cup-heart {
		fill: var(--color-danger-bright);
	}

	/* Upright, the room above the record player belongs to the main button: the
	 * cup stands beside it, in the gap Gallery leaves on a phone. */
	@media (orientation: portrait) {
		.tip-cup {
			right: 78px;
			bottom: 20px;
		}
	}

	/* The cup alone where its line would run into something. */
	@media (max-width: 47.99rem), (max-height: 30rem) {
		.tip-cup-slip {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tip-cup-drawing {
			transition: none;
		}
	}
</style>
