<script lang="ts">
	import UndevelopedNote from '#lib/features/gallery-exploration/components/UndevelopedNote.svelte';
	import { createDevelopingPhoto } from '#lib/features/gallery-exploration/components/developing-photo.svelte.js';

	/*
	 * The photo a spin landed on in the Mystery Room. The reel brings it up
	 * itself, so it cannot use <NsfwImage> and its own fade, but a photo that
	 * did not come is handled the same way here: the polaroid stays empty with
	 * a pencilled note and asks again by itself.
	 */
	let {
		alt,
		blurred,
		src
	}: {
		alt: string;
		blurred: boolean;
		src: string;
	} = $props();

	const photo = createDevelopingPhoto(() => src);
</script>

{#key photo.attempt}
	<img
		src={photo.requestedSrc}
		{alt}
		class="reel-frame-image"
		class:nsfw-blurred={blurred}
		class:is-undeveloped={photo.undeveloped}
		width="768"
		height="768"
		decoding="async"
		onload={photo.developed}
		onerror={(event) => photo.failed(event.currentTarget)}
	/>
{/key}
{#if photo.undeveloped}
	<UndevelopedNote />
{:else if blurred}
	<div class="nsfw-overlay">
		<span class="nsfw-badge">18+</span>
	</div>
{/if}

<style>
	.reel-frame-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* Not drawn, so the browser paints no broken picture in the frame; it keeps
	 * its name for a screen reader, and comes back when a new try lands. */
	.reel-frame-image.is-undeveloped {
		opacity: 0;
	}

	/* The one censoring treatment, defined in routes/layout.css: the reel reads
	 * the same two properties instead of carrying its own blur radius and scrim
	 * alpha. */
	.nsfw-blurred {
		scale: 1.04;
		filter: blur(var(--nsfw-blur, 20px)) saturate(0);
	}

	.nsfw-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--nsfw-scrim, rgba(45, 36, 32, 0.68));
	}

	.nsfw-badge {
		display: inline-block;
		padding: 4px 12px;
		border: 2px solid var(--color-paper-bright);
		border-radius: 9999px;
		font-size: 12px;
		font-weight: 900;
		color: var(--color-paper-bright);
	}
</style>
