<script lang="ts">
	/*
	 * A little record player in the corner. Pressing it lowers the tonearm onto
	 * the record and the record turns; pressing it again lifts the arm and the
	 * record stops where it was. Which record is on is the button's
	 * description, and a paper slip with its name slides out on hover or focus.
	 */
	let {
		currentTrackLabel = null,
		enabled = false,
		onToggle,
		playbackUnavailable = false
	}: {
		currentTrackLabel?: string | null;
		enabled?: boolean;
		onToggle: () => void;
		playbackUnavailable?: boolean;
	} = $props();

	const id = $props.id();
	const playing = $derived(enabled && !playbackUnavailable);
	const statusLabel = $derived(
		playbackUnavailable ? 'Quiet for now' : (currentTrackLabel ?? 'Ambient loop')
	);
</script>

<div class="record-player-shell">
	<button
		type="button"
		class="record-player focus-ring"
		class:is-playing={playing}
		aria-label="Ambient music"
		aria-pressed={enabled}
		aria-describedby={`${id}-track`}
		onclick={onToggle}
	>
		<span class="record-slip" id={`${id}-track`}>{statusLabel}</span>
		<span class="record-plinth" aria-hidden="true"></span>
		<span class="record-disc" aria-hidden="true">
			<span class="record-label">
				<span class="record-label-mark"></span>
				<span class="record-label-dot"></span>
				<span class="record-spindle"></span>
			</span>
		</span>
		<!-- The vinyl's sheen stays put while the record turns under it. -->
		<span class="record-sheen" aria-hidden="true"></span>
		<svg class="record-arm" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
			<defs>
				<linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stop-color="#f4f0e8" />
					<stop offset=".5" stop-color="#b9b1a5" />
					<stop offset="1" stop-color="#e6e0d6" />
				</linearGradient>
				<radialGradient id={`${id}-pivot`} cx=".35" cy=".3" r=".8">
					<stop offset="0" stop-color="#f6f1e8" />
					<stop offset=".6" stop-color="#cfc6b8" />
					<stop offset="1" stop-color="#9e9486" />
				</radialGradient>
			</defs>
			<g class="record-arm-swing">
				<rect
					x="51"
					y="0.5"
					width="4.4"
					height="6"
					rx="1.4"
					transform="rotate(22 53 3.5)"
					fill="#3a2e25"
				/>
				<path
					d="M50 9 L45 21 Q42.6 28 41.2 32.6"
					stroke="#5e574f"
					stroke-width="2.3"
					fill="none"
					stroke-linecap="round"
				/>
				<path
					d="M50 9 L45 21 Q42.6 28 41.2 32.6"
					stroke={`url(#${id}-steel)`}
					stroke-width="1.3"
					fill="none"
					stroke-linecap="round"
				/>
				<rect
					x="38.8"
					y="31.6"
					width="4.6"
					height="6.6"
					rx="1.1"
					transform="rotate(14 41 35)"
					fill="#2d2420"
				/>
				<path d="M43.4 33.2 L45.6 34.2" stroke="#b9b1a5" stroke-width=".9" stroke-linecap="round" />
				<circle
					cx="50"
					cy="9"
					r="4.6"
					fill={`url(#${id}-pivot)`}
					stroke="rgba(45,36,32,.45)"
					stroke-width=".8"
				/>
				<circle cx="50" cy="9" r="1.8" fill="#3a2e25" />
				<circle cx="49.4" cy="8.4" r=".5" fill="#f4f0e8" />
			</g>
		</svg>
	</button>
</div>

<style>
	.record-player-shell {
		position: fixed;
		right: 20px;
		bottom: 20px;
		/* Below the navigation fade overlays, above page chrome. */
		z-index: var(--z-ambient);
		pointer-events: none;
	}

	/*
	 * A control floating over a dimmed modal, clickable and still in the tab
	 * order, contradicts `aria-modal="true"`. The rule has to be global because
	 * the dialog is somewhere else entirely in the tree; it covers the artwork
	 * detail panel, its avatar preview and the avatar editor alike.
	 */
	:global(body:has([role='dialog'][aria-modal='true'])) .record-player-shell {
		display: none;
	}

	.record-player {
		--focus-ring-offset: 4px;
		pointer-events: auto;
		position: relative;
		display: block;
		width: 56px;
		height: 56px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
		transition: transform 200ms ease;
	}

	.record-player:hover {
		transform: translateY(-1px);
	}

	.record-player:active {
		transform: scale(0.96);
	}

	/* The cream plinth the record sits on. */
	.record-plinth {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 28%, #fffdf8, #f4ede1 62%, #e8dccb);
		box-shadow:
			0 1px 1px rgb(40 25 10 / 0.2),
			0 6px 14px rgb(40 25 10 / 0.3),
			inset 0 -1px 2px rgb(120 95 60 / 0.22),
			inset 0 1px 0 #fff;
	}

	/* The record: fine grooves, two gaps between tracks, a dark lead-out. */
	.record-disc {
		position: absolute;
		top: 6px;
		left: 6px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background:
			radial-gradient(circle, transparent 0 8.4px, #121010 8.4px 10px, transparent 10px),
			radial-gradient(
				circle,
				transparent 0 14.6px,
				rgb(255 255 255 / 0.07) 14.6px 15.2px,
				transparent 15.2px
			),
			radial-gradient(
				circle,
				transparent 0 18.4px,
				rgb(255 255 255 / 0.07) 18.4px 19px,
				transparent 19px
			),
			radial-gradient(circle, transparent 0 21.2px, #100d0c 21.2px),
			repeating-radial-gradient(circle, #1d1916 0 0.5px, #2a231f 0.5px 1px);
		box-shadow:
			0 0 0 1.5px rgb(70 52 34 / 0.16),
			0 1px 2px rgb(0 0 0 / 0.45);
		filter: saturate(0.55) brightness(0.9);
		animation: record-turn 1.8s linear infinite;
		animation-play-state: paused;
		transition: filter 500ms ease;
	}

	/* The label, its mark off-centre so the turning shows. */
	.record-label {
		position: absolute;
		top: 14px;
		left: 14px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 35%, #e8a26b, #d4834a 55%, #b8693a);
		box-shadow:
			inset 0 0 0 1px rgb(90 40 10 / 0.35),
			inset 0 0 0 3.4px transparent,
			inset 0 0 0 3.9px rgb(253 251 247 / 0.55);
	}

	.record-label-mark {
		position: absolute;
		top: 1.6px;
		left: 7px;
		width: 2px;
		height: 3.6px;
		border-radius: 1px;
		background: #fdfbf7;
	}

	.record-label-dot {
		position: absolute;
		top: 9.6px;
		left: 3.2px;
		width: 1.6px;
		height: 1.6px;
		border-radius: 50%;
		background: rgb(253 251 247 / 0.8);
	}

	.record-spindle {
		position: absolute;
		top: 6.3px;
		left: 6.3px;
		width: 3.4px;
		height: 3.4px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #f2ece2, #a69c8e);
		box-shadow: 0 0 0 0.6px rgb(45 36 32 / 0.6);
	}

	.record-sheen {
		position: absolute;
		top: 6px;
		left: 6px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		pointer-events: none;
		background: conic-gradient(
			from 18deg,
			transparent 0 5%,
			rgb(255 255 255 / 0.08) 8%,
			rgb(255 255 255 / 0.24) 11%,
			rgb(255 255 255 / 0.08) 14%,
			transparent 18% 51%,
			rgb(255 255 255 / 0.06) 55%,
			rgb(255 255 255 / 0.17) 59%,
			rgb(255 255 255 / 0.06) 63%,
			transparent 67%
		);
		mask: radial-gradient(circle, transparent 0 10px, #000 10.5px);
	}

	.record-arm {
		position: absolute;
		top: 0;
		left: 0;
		overflow: visible;
		pointer-events: none;
	}

	/* The tonearm swings in from its rest, pivoting at its top right. */
	.record-arm-swing {
		transform-box: view-box;
		transform-origin: 50px 9px;
		transform: rotate(-62deg) scale(0.85);
		opacity: 0;
		filter: drop-shadow(1px 2px 1.2px rgb(0 0 0 / 0.38));
		transition:
			transform 750ms cubic-bezier(0.3, 1.35, 0.5, 1),
			opacity 250ms ease;
	}

	.is-playing .record-arm-swing {
		transform: rotate(0deg) scale(1);
		opacity: 1;
	}

	.is-playing .record-disc {
		animation-play-state: running;
		filter: none;
	}

	/* The record's name, on a slip of paper that slides out to its left. */
	.record-slip {
		position: absolute;
		top: 50%;
		right: calc(100% + 10px);
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
		translate: 8px -50%;
		rotate: -2deg;
		pointer-events: none;
		transition:
			opacity 200ms ease,
			translate 200ms ease;
	}

	.record-player:hover .record-slip,
	.record-player:focus-visible .record-slip {
		opacity: 1;
		translate: 0 -50%;
	}

	@keyframes record-turn {
		to {
			rotate: 360deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.record-disc {
			animation: none;
		}

		.record-arm-swing,
		.record-slip {
			transition: opacity 200ms ease;
		}
	}
</style>
