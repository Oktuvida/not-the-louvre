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
		<div class="ambient-tab-pin"></div>
		<div class="ambient-tab-copy">
			<span class="ambient-tab-kicker">Ambience</span>
			<span class="ambient-tab-title">{statusLabel}</span>
		</div>
		<span class="ambient-tab-pill">{enabled ? 'ON' : 'OFF'}</span>
	</button>
</div>

<style>
	.ambient-tab-shell {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 920;
		pointer-events: none;
	}

	.ambient-tab {
		pointer-events: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 12.5rem;
		padding: 0.9rem 1rem 0.9rem 1.15rem;
		border: 2px solid rgba(78, 60, 40, 0.24);
		border-radius: 1.1rem;
		background: linear-gradient(180deg, rgba(255, 248, 222, 0.96), rgba(240, 224, 169, 0.96));
		box-shadow:
			0 1rem 2rem rgba(58, 34, 19, 0.16),
			inset 0 1px 0 rgba(255, 255, 255, 0.44);
		color: #2f241c;
		text-align: left;
		transform: rotate(-2deg);
		transition:
			transform 180ms ease,
			box-shadow 180ms ease,
			filter 180ms ease;
	}

	.ambient-tab:hover {
		transform: rotate(-1deg) translateY(-1px);
		box-shadow:
			0 1.15rem 2.2rem rgba(58, 34, 19, 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.5);
	}

	.ambient-tab:focus-visible {
		outline: 3px solid rgba(113, 145, 127, 0.5);
		outline-offset: 3px;
	}

	.ambient-tab-on {
		filter: saturate(1.04);
	}

	.ambient-tab-off {
		background: linear-gradient(180deg, rgba(252, 244, 223, 0.92), rgba(236, 224, 193, 0.92));
	}

	.ambient-tab-unavailable {
		background: linear-gradient(180deg, rgba(250, 242, 227, 0.92), rgba(231, 223, 204, 0.94));
	}

	.ambient-tab-pin {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 999px;
		flex: none;
		border: 1px solid rgba(95, 69, 41, 0.5);
		background: radial-gradient(circle at 35% 35%, #fff5d6, #8e6632 80%);
		box-shadow: 0 0.15rem 0.4rem rgba(58, 34, 19, 0.24);
	}

	.ambient-tab-icon {
		display: none;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		flex: none;
	}

	.ambient-tab-icon svg {
		width: 100%;
		height: 100%;
	}

	.ambient-tab-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.ambient-tab-kicker {
		font-family: var(--font-body);
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #7a5a33;
	}

	.ambient-tab-title {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.05;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ambient-tab-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.8rem;
		padding: 0.4rem 0.55rem;
		border-radius: 999px;
		border: 1px solid rgba(47, 36, 28, 0.16);
		background: rgba(255, 250, 240, 0.72);
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	@media (max-width: 700px) {
		.ambient-tab-shell {
			right: 0.8rem;
			bottom: 0.8rem;
		}

		.ambient-tab {
			min-width: 0;
			width: 3.4rem;
			height: 3.4rem;
			max-width: none;
			padding: 0;
			justify-content: center;
			border-radius: 999px;
			transform: none;
		}

		.ambient-tab:hover {
			transform: translateY(-1px);
		}

		.ambient-tab-icon {
			display: inline-flex;
		}

		.ambient-tab-pin,
		.ambient-tab-copy,
		.ambient-tab-pill {
			display: none;
		}
	}
</style>
