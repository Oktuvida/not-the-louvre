<script lang="ts">
	import type { Snippet } from 'svelte';
	import { hashString } from '#lib/features/artwork-presentation/model/frame.js';

	let {
		children,
		attachment = 'tape',
		className = '',
		color,
		label = 'Curator note',
		seedKey,
		text
	}: {
		children?: Snippet;
		attachment?: 'pin' | 'tape';
		className?: string;
		color: string;
		label?: string;
		seedKey: string;
		text: string;
	} = $props();

	// Each room's note is its own pad of paper, light at the top and deeper
	// where the paper curls.
	const ROOM_PAPER: Record<string, string> = {
		'hall-of-fame': 'linear-gradient(172deg, #fff3a8 0%, #fbe57e 60%, #f2d65e 100%)',
		'hot-wall': 'linear-gradient(172deg, #ffd6de 0%, #f8b9c7 55%, #f0a5b6 100%)',
		'wet-paint': 'linear-gradient(172deg, #ffe3c2 0%, #fbcf9c 55%, #f5bb7e 100%)',
		mystery: 'linear-gradient(172deg, #d6ecff 0%, #b9dbfb 60%, #a3cdf5 100%)',
		'your-studio': 'linear-gradient(172deg, #dcf2d4 0%, #c3e6bb 60%, #a9d6a0 100%)'
	};

	const seed = $derived(hashString(seedKey));
	const rotation = $derived((seed % 9) - 4);
	const tapeVariant = $derived(seed % 3);
	const curlSide = $derived(seed % 2 === 0 ? 'right' : 'left');
	const paper = $derived(ROOM_PAPER[seedKey] ?? color);
</script>

<div
	class={`relative inline-block ${className}`}
	style={`transform: rotate(${rotation}deg); z-index: 25;`}
>
	<div
		class={`sticky-note w-[17.5rem] px-4 pt-[1.2rem] pb-5 text-note-ink ${curlSide === 'left' ? 'sticky-note-curl-left' : ''}`}
		style={`--note-paper: ${paper};`}
	>
		{#if attachment === 'tape'}
			<span
				class={`tape pointer-events-none absolute z-3 h-[1.375rem] w-[4.5rem] ${tapeVariant === 0 ? 'top-[-0.625rem] left-1/2 -translate-x-1/2 -rotate-2' : tapeVariant === 1 ? 'tape-washi top-[-0.5rem] left-[0.375rem] -rotate-[8deg]' : 'top-[-0.5rem] right-[0.5rem] rotate-[6deg]'}`}
				aria-hidden="true"
			></span>
		{:else}
			<span
				class="push-pin absolute top-[-0.875rem] left-1/2 z-4 -translate-x-1/2"
				aria-hidden="true"
			></span>
		{/if}

		<p
			class="mb-1 font-display text-[0.75rem] font-bold tracking-[0.1em] text-[rgba(45,36,32,0.62)] uppercase"
		>
			{label}
		</p>
		<p class="relative z-2 text-[1.1rem] leading-[1.35]" style="font-family: var(--font-hand);">
			{text}
		</p>
		{#if children}
			<div class="relative z-2 mt-3">
				{@render children()}
			</div>
		{/if}
	</div>
</div>
