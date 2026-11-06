<script lang="ts">
	import { resolve } from '$app/paths';

	/*
	 * The end of the wall: a velvet rope slung between two brass posts, and the
	 * museum's label hung on it, which is also the way to who keeps the place.
	 */
</script>

<div class="velvet-rope">
	<svg class="velvet-rope-scene" viewBox="0 0 420 170" aria-hidden="true">
		<defs>
			<linearGradient id="velvet-rope-brass" x1="0" x2="1">
				<stop offset="0" stop-color="#8a6420" />
				<stop offset=".42" stop-color="#e6c56c" />
				<stop offset=".6" stop-color="#c79a3a" />
				<stop offset="1" stop-color="#7a5418" />
			</linearGradient>
			<radialGradient id="velvet-rope-knob" cx=".35" cy=".3" r=".75">
				<stop offset="0" stop-color="#fff2c0" />
				<stop offset=".45" stop-color="#d9ad4a" />
				<stop offset="1" stop-color="#6e4a12" />
			</radialGradient>
			<radialGradient id="velvet-rope-foot" cx=".4" cy=".3" r=".8">
				<stop offset="0" stop-color="#ecc867" />
				<stop offset="1" stop-color="#6e4a12" />
			</radialGradient>
		</defs>
		<!-- The posts' shadows on the floor. -->
		<ellipse cx="62" cy="162" rx="34" ry="6" fill="#1a120b" fill-opacity=".35" />
		<ellipse cx="358" cy="162" rx="34" ry="6" fill="#1a120b" fill-opacity=".35" />
		{#each [62, 358] as x (x)}
			<rect x={x - 6} y="26" width="12" height="124" rx="3" fill="url(#velvet-rope-brass)" />
			<ellipse cx={x} cy="154" rx="26" ry="8" fill="url(#velvet-rope-foot)" />
			<rect x={x - 9} y="22" width="18" height="8" rx="3" fill="url(#velvet-rope-brass)" />
			<circle cx={x} cy="14" r="11" fill="url(#velvet-rope-knob)" />
		{/each}
		<!-- The rope: a deep red velvet, its nap catching the light along the top. -->
		<path
			d="M70 34 C 150 118, 270 118, 350 34"
			stroke="#5e1712"
			stroke-width="13"
			fill="none"
			stroke-linecap="round"
		/>
		<path
			d="M70 34 C 150 118, 270 118, 350 34"
			stroke="#8f2a22"
			stroke-width="9"
			fill="none"
			stroke-linecap="round"
		/>
		<path
			d="M74 32 C 152 112, 268 112, 346 32"
			stroke="#c0453a"
			stroke-width="2.5"
			fill="none"
			stroke-linecap="round"
			stroke-opacity=".7"
		/>
		<!-- The hooks at either end. -->
		<circle cx="70" cy="34" r="5" fill="none" stroke="url(#velvet-rope-brass)" stroke-width="3" />
		<circle cx="350" cy="34" r="5" fill="none" stroke="url(#velvet-rope-brass)" stroke-width="3" />
	</svg>
	<div class="velvet-rope-label">
		<p class="velvet-rope-title">End of the collection</p>
		<p class="velvet-rope-note">The rest is still being drawn</p>
		<a class="velvet-rope-staff focus-ring" href={resolve('/gallery/staff')}>meet the staff →</a>
	</div>
</div>

<style>
	.velvet-rope {
		position: relative;
		width: min(26rem, 100%);
		margin: 0 auto;
		aspect-ratio: 420 / 170;
	}

	.velvet-rope-scene {
		display: block;
		pointer-events: none;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	/* The label hangs from the dip of the rope. */
	.velvet-rope-label {
		position: absolute;
		top: 58%;
		left: 50%;
		translate: -50% 0;
		rotate: -1.5deg;
		padding: 0.55rem 0.9rem 0.5rem;
		text-align: center;
		white-space: nowrap;
		background: #fdfcfa;
		box-shadow:
			0 1px 0 #ddd6ca,
			0 4px 8px rgb(40 25 10 / 0.3);
	}

	.velvet-rope-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #8f2a22;
	}

	.velvet-rope-staff {
		display: inline-block;
		margin-top: 0.25rem;
		color: var(--color-pencil);
		font-family: var(--font-hand);
		font-size: 1rem;
		line-height: 1.2;
	}

	.velvet-rope-note {
		margin: 0.2rem 0 0;
		font-family: var(--font-hand);
		font-size: 1.25rem;
		line-height: 1.1;
		color: var(--color-ink-warm);
	}
</style>
