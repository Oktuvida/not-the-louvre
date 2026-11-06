<script lang="ts">
	/*
	 * New pieces went up while the visitor was looking: the newest one peeks
	 * out from under the room's header, pinned, with the count written on it.
	 * Tapping it hangs them all. Nothing shows while there is nothing new, so
	 * the gallery needs no Refresh button.
	 */
	let {
		blurred = false,
		count,
		onHang,
		previewUrl = null
	}: {
		/** The newest piece is sensitive and this visitor has not opted in. */
		blurred?: boolean;
		count: number;
		onHang: () => void;
		previewUrl?: string | null;
	} = $props();
</script>

<div class="new-pieces-clip">
	<button type="button" class="new-pieces polaroid-paper focus-ring" onclick={onHang}>
		<span class="new-pieces-photo" aria-hidden="true">
			{#if previewUrl}
				<img src={previewUrl} alt="" class:is-blurred={blurred} decoding="async" />
			{/if}
		</span>
		<span class="new-pieces-pin push-pin" aria-hidden="true"></span>
		<span class="new-pieces-caption">
			+{count} new<span class="sr-only">
				{count === 1 ? ' piece' : ' pieces'} — hang them on the wall</span
			>
		</span>
	</button>
</div>

<style>
	/* The header's lower edge is the line it peeks out from. */
	.new-pieces-clip {
		position: absolute;
		top: 100%;
		left: 50%;
		width: 11rem;
		height: 10.5rem;
		/* Over the room it peeks into, whatever that room has hung up. */
		z-index: 1;
		translate: -50% 0;
		overflow: hidden;
		pointer-events: none;
	}

	.new-pieces {
		--focus-ring-offset: 3px;
		position: absolute;
		top: 0;
		left: 1.5rem;
		display: block;
		width: 8rem;
		padding: 0.5rem 0.5rem 0;
		border: 0;
		cursor: pointer;
		pointer-events: auto;
		rotate: 4deg;
		translate: 0 -46%;
		animation: new-pieces-drop 700ms cubic-bezier(0.3, 1.3, 0.5, 1) both;
		transition: translate 260ms cubic-bezier(0.3, 1.3, 0.5, 1);
	}

	.new-pieces:hover,
	.new-pieces:focus-visible {
		translate: 0 -30%;
	}

	.new-pieces-photo {
		display: block;
		aspect-ratio: 1;
		overflow: hidden;
		background: #fffdf9;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.07);
	}

	.new-pieces-photo img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.new-pieces-photo img.is-blurred {
		filter: blur(var(--nsfw-blur, 20px)) saturate(0);
		scale: 1.1;
	}

	.new-pieces-pin {
		--pin-size: 1.15rem;
		position: absolute;
		bottom: 2.6rem;
		left: 50%;
		translate: -50% 0;
	}

	.new-pieces-caption {
		display: block;
		padding: 0.25rem 0 0.4rem;
		text-align: center;
		font-family: var(--font-hand);
		font-size: 1.35rem;
		font-weight: 700;
		line-height: 1.1;
		color: #b5473c;
	}

	@keyframes new-pieces-drop {
		from {
			translate: 0 -110%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.new-pieces {
			animation: none;
			transition: none;
		}
	}
</style>
