<script lang="ts">
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

	const buttonLabel = $derived(enabled ? 'Mute ambient audio' : 'Enable ambient audio');
	const isMuted = $derived(!enabled || playbackUnavailable);
	const statusLabel = $derived(
		playbackUnavailable ? 'Quiet for now' : (currentTrackLabel ?? 'Ambient loop')
	);
</script>

<div class="ambient-tab-shell">
	<button
		type="button"
		class:ambient-tab-on={enabled}
		class:ambient-tab-off={!enabled}
		class:ambient-tab-unavailable={playbackUnavailable}
		class="ambient-tab"
		aria-label={buttonLabel}
		onclick={onToggle}
	>
		<!-- A brushstroke swiped across the glass — it follows you between rooms -->
		<svg
			class="stroke-bg"
			viewBox="0 0 360 110"
			preserveAspectRatio="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<defs>
				<filter
					id="amb-paint"
					x="-30%"
					y="-110%"
					width="160%"
					height="320%"
					color-interpolation-filters="sRGB"
				>
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.013 0.08"
						numOctaves="3"
						seed="7"
						result="e"
					/>
					<feDisplacementMap
						in="SourceGraphic"
						in2="e"
						scale="30"
						xChannelSelector="R"
						yChannelSelector="G"
					/>
				</filter>
				<filter
					id="amb-bristle"
					x="-30%"
					y="-110%"
					width="160%"
					height="320%"
					color-interpolation-filters="sRGB"
				>
					<feTurbulence
						type="turbulence"
						baseFrequency="0.5 0.012"
						numOctaves="2"
						seed="3"
						result="n"
					/>
					<feColorMatrix
						in="n"
						type="matrix"
						values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.5 0 0 0 -0.42"
						result="a"
					/>
					<feComposite in="SourceGraphic" in2="a" operator="in" />
				</filter>
				<clipPath id="amb-clip">
					<path
						d="M24,55 C40,40 72,37 104,38 C152,32 212,34 262,32 C302,33 326,38 336,52 C326,68 302,73 262,74 C212,76 152,78 104,73 C72,74 40,71 24,55 Z"
					/>
				</clipPath>
			</defs>
			<g transform="translate(0 55) scale(1 1.35) translate(0 -55)">
				<path
					d="M24,55 C40,40 72,37 104,38 C152,32 212,34 262,32 C302,33 326,38 336,52 C326,68 302,73 262,74 C212,76 152,78 104,73 C72,74 40,71 24,55 Z"
					class="stroke-shadow"
					opacity="0.22"
					filter="url(#amb-paint)"
					transform="translate(0,3)"
				/>
				<path
					d="M24,55 C40,40 72,37 104,38 C152,32 212,34 262,32 C302,33 326,38 336,52 C326,68 302,73 262,74 C212,76 152,78 104,73 C72,74 40,71 24,55 Z"
					class="stroke-body"
					filter="url(#amb-paint)"
				/>
				<g clip-path="url(#amb-clip)" filter="url(#amb-paint)">
					<rect
						x="18"
						y="28"
						width="324"
						height="56"
						fill="#4a429f"
						opacity="0.0"
						filter="url(#amb-bristle)"
					/>
				</g>
				<path
					d="M56,47 C120,42 190,43 268,45"
					fill="none"
					class="stroke-streak"
					stroke-width="3"
					stroke-linecap="round"
					opacity="0.35"
					filter="url(#amb-paint)"
				/>
			</g>
		</svg>

		<span class="ambient-tab-icon" data-muted={isMuted ? 'true' : 'false'} aria-hidden="true">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M9 18V5l10 4" />
				<path d="M19 9v8" />
				<circle cx="6" cy="18" r="3" />
				<circle cx="16" cy="17" r="3" />
				{#if isMuted}
					<path d="M4 4l16 16" />
				{/if}
			</svg>
		</span>
		<div class="ambient-tab-copy">
			<span class="stroke-note" class:stroke-note-muted={isMuted} aria-hidden="true">♪</span>
			<span class="ambient-tab-title">{statusLabel}</span>
			<span class="ambient-tab-pill">{enabled ? 'ON' : 'OFF'}</span>
		</div>
	</button>
</div>

<style>
	.ambient-tab-shell {
		position: fixed;
		right: 0.4rem;
		bottom: 0.5rem;
		z-index: 920;
		pointer-events: none;
	}

	.ambient-tab {
		--stroke-paint: #7f77dd;
		--stroke-deep: #4a429f;
		--stroke-light: #afa9ec;
		pointer-events: auto;
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 17rem;
		height: 5.2rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: #262240;
		cursor: pointer;
		transition: transform 180ms ease;
	}

	.ambient-tab:hover {
		transform: translateY(-1px) rotate(-0.5deg);
	}

	.ambient-tab:focus-visible {
		outline: 3px solid #4ecdc4;
		outline-offset: -8px;
		border-radius: 2rem;
	}

	/* the paint dries gray while the music is off */
	.ambient-tab-off,
	.ambient-tab-unavailable {
		--stroke-paint: #8d8d96;
		--stroke-deep: #44444c;
		--stroke-light: #b9b9c2;
	}

	.stroke-shadow {
		fill: var(--stroke-deep);
	}

	.stroke-body {
		fill: var(--stroke-paint);
		transition: fill 220ms ease;
	}

	.stroke-streak {
		stroke: var(--stroke-light);
	}

	.stroke-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.ambient-tab-copy {
		position: relative;
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		max-width: 78%;
		/* sit inside the meat of the stroke, clear of the ragged tail */
		translate: -4% 0;
	}

	.stroke-note {
		font-size: 1.05rem;
		line-height: 1;
		translate: 0 -2px;
	}

	.stroke-note-muted {
		opacity: 0.45;
	}

	/* the track name, written into the wet paint */
	.ambient-tab-title {
		font-family: 'Caveat', cursive;
		font-size: 1.5rem;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		rotate: -1.2deg;
	}

	/* ON/OFF, stamped in the same ink */
	.ambient-tab-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.14rem 0.32rem;
		border: 1.5px solid currentColor;
		border-radius: 4px;
		background: transparent;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		opacity: 0.75;
		rotate: 2deg;
		translate: 0 -3px;
	}

	.ambient-tab-on .ambient-tab-pill {
		rotate: -2deg;
	}

	.ambient-tab-icon {
		display: none;
		position: relative;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
		color: #262240;
	}

	.ambient-tab-icon svg {
		width: 100%;
		height: 100%;
	}

	@media (max-width: 700px) {
		.ambient-tab-shell {
			right: -1.6rem;
			bottom: 0.4rem;
		}

		.ambient-tab {
			width: 9.5rem;
			height: 3.6rem;
		}

		.ambient-tab-copy {
			display: none;
		}

		.ambient-tab-icon {
			display: inline-flex;
			translate: -14% 0;
		}
	}
</style>
