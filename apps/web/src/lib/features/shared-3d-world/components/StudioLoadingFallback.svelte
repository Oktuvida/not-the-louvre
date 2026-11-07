<script lang="ts">
	import {
		COMPOSED_FOR,
		SKETCH_FRAME
	} from '#lib/features/home-entry-scene/scene/studio-framing.js';
	import { STUDIO_SKETCH_URL } from '#lib/features/home-entry-scene/scene/studio-model.js';

	/*
	 * The studio drawn in pencil, where the 3D room will stand, while three.js
	 * and the model are on their way: the drawing comes from the model itself
	 * (scripts/sketch-studio-room.ts), seen from the camera the room rests at,
	 * so the room fades in exactly over it. It sketches itself in, the long
	 * lines of the room first.
	 *
	 * If the room never comes, the drawing stays: it is a room to look at, and
	 * the page works without the 3D. `onRetry` adds a way to try the real one
	 * again, when trying again can help.
	 */
	let { failed = false, onRetry }: { failed?: boolean; onRetry?: () => void } = $props();
</script>

<div class="studio-sketch-frame" data-testid="studio-scene-fallback">
	<!-- Placed in pixels of the composition every pose was made on, scaled the
	     way the room is, so the drawing lies under it on any screen. -->
	<img
		alt=""
		class="studio-sketch"
		data-testid="studio-sketch"
		decoding="async"
		src={STUDIO_SKETCH_URL}
		style:--composed-width={COMPOSED_FOR.width}
		style:--composed-height={COMPOSED_FOR.height}
		style:--sketch-left={SKETCH_FRAME.left - COMPOSED_FOR.width / 2}
		style:--sketch-top={SKETCH_FRAME.top - COMPOSED_FOR.height / 2}
		style:--sketch-width={SKETCH_FRAME.width}
		style:--sketch-height={SKETCH_FRAME.height}
	/>
	<p class="sr-only" role="status">
		{failed ? 'Only the sketch of the studio today.' : 'Setting up the studio…'}
	</p>
	{#if failed && onRetry}
		<button class="sketch-note" onclick={onRetry} type="button">
			only the sketch today… <span class="sketch-note-action">try the real room</span>
		</button>
	{/if}
</div>

<style>
	.studio-sketch-frame {
		position: absolute;
		inset: 0;
		container-type: size;
		pointer-events: none;
	}

	.studio-sketch {
		/* One pixel of the composition on this screen: the room's own scale. */
		--unit: min(100cqw / var(--composed-width), 100cqh / var(--composed-height));
		position: absolute;
		left: calc(50% + var(--sketch-left) * var(--unit));
		top: calc(50% + var(--sketch-top) * var(--unit));
		width: calc(var(--sketch-width) * var(--unit));
		height: calc(var(--sketch-height) * var(--unit));
		max-width: none;
		user-select: none;
	}

	/* A note pencilled on the drawing's left wall, clear of the doors out. */
	.sketch-note {
		position: absolute;
		top: 44%;
		left: max(1rem, 4%);
		max-width: 14rem;
		padding: 0.35rem 0.6rem;
		border: 0;
		background: rgb(251 247 238 / 0.92);
		box-shadow: 0 1px 2px rgb(40 25 10 / 0.25);
		rotate: -3deg;
		color: var(--color-ink-warm, #2d2420);
		font-family: var(--font-hand);
		font-size: 1.25rem;
		line-height: 1.15;
		text-align: left;
		pointer-events: auto;
		cursor: pointer;
	}

	.sketch-note-action {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}

	.sketch-note-action::after {
		content: ' ↻';
	}

	.sketch-note:focus-visible {
		outline: 2px solid var(--color-ink-warm, #2d2420);
		outline-offset: 3px;
	}
</style>
