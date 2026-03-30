<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { drawArtworkFrame } from '$lib/features/artwork-presentation/canvas/artwork-frame-canvas';
	import type { ArtworkFrameDescriptor } from '$lib/features/artwork-presentation/model/frame';

	let {
		children,
		frame,
		className = '',
		openingClass = '',
		testId
	}: {
		children?: Snippet;
		frame: ArtworkFrameDescriptor;
		className?: string;
		openingClass?: string;
		testId?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let host = $state<HTMLDivElement | null>(null);
	let openingStyle = $state('left:0%;top:0%;width:100%;height:100%;');

	const renderFrame = () => {
		if (!canvas || !host) {
			return;
		}

		const bounds = host.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.round(bounds.width * ratio));
		const height = Math.max(1, Math.round(bounds.height * ratio));

		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext('2d');

		if (!context) {
			return;
		}

		const opening = drawArtworkFrame(context, width, height, frame.preset.renderOptions);
		openingStyle = [
			`left:${(opening.x / width) * 100}%`,
			`top:${(opening.y / height) * 100}%`,
			`width:${(opening.w / width) * 100}%`,
			`height:${(opening.h / height) * 100}%`
		].join(';');
	};

	onMount(() => {
		renderFrame();

		window.addEventListener('resize', renderFrame);

		return () => {
			window.removeEventListener('resize', renderFrame);
		};
	});

	$effect(() => {
		renderFrame();
	});
</script>

<div
	bind:this={host}
	class={`frame-root ${className}`}
	data-testid={testId}
	data-frame-preset={frame.preset.id}
	data-frame-tier={frame.tier}
	data-premium-marker={frame.isPremium ? 'true' : 'false'}
>
	<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>

	<div class={`artwork-opening ${openingClass}`} style={openingStyle}>
		{@render children?.()}
	</div>
</div>

<style>
	.frame-root {
		position: relative;
		display: block;
	}

	.artwork-opening {
		position: absolute;
		overflow: hidden;
	}
</style>
