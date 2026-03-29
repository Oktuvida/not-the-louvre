<script lang="ts">
	import { hashString } from '$lib/features/artwork-presentation/model/frame';

	let {
		attachment = 'tape',
		className = '',
		color,
		label = 'Curator note',
		seedKey,
		text
	}: {
		attachment?: 'pin' | 'tape';
		className?: string;
		color: string;
		label?: string;
		seedKey: string;
		text: string;
	} = $props();

	const seed = $derived(hashString(seedKey));
	const rotation = $derived((seed % 9) - 4);
	const tapeVariant = $derived(seed % 3);
	const curlSide = $derived(seed % 2 === 0 ? 'right' : 'left');
	const gradient = $derived(
		seedKey === 'hall-of-fame'
			? 'linear-gradient(160deg, #fef49c 0%, #f7e67a 100%)'
			: seedKey === 'hot-wall'
				? 'linear-gradient(160deg, #ffcdd2 0%, #f7929e 100%)'
				: seedKey === 'mystery'
					? 'linear-gradient(160deg, #bbdefb 0%, #8bb8d0 100%)'
					: seedKey === 'your-studio'
						? 'linear-gradient(160deg, #c8e6c9 0%, #a5d6a7 100%)'
						: color
	);
</script>

<div
	class={`relative inline-block ${className}`}
	style={`transform: rotate(${rotation}deg); z-index: 25;`}
>
	<div
		class="relative w-[280px] px-4 pt-[1.2rem] pb-4 text-[#3d3530] shadow-[2px_3px_8px_rgba(0,0,0,0.18)]"
		style={`background:${gradient};`}
	>
		{#if attachment === 'tape'}
			<div
				class={`pointer-events-none absolute z-[3] h-[18px] w-[52px] border border-[rgba(200,190,170,0.3)] bg-[rgba(255,255,240,0.55)] ${tapeVariant === 0 ? 'top-[-8px] left-1/2 -translate-x-1/2 -rotate-2' : tapeVariant === 1 ? 'top-[-6px] left-[10px] rotate-[10deg]' : 'top-[-6px] right-[10px] -rotate-[6deg]'}`}
			></div>
		{:else}
			<div
				class="pointer-events-none absolute top-[-5px] left-1/2 z-[4] h-[14px] w-[14px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_4px_4px,#e74c3c,#c0392b)] shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.3)]"
			></div>
		{/if}

		{#if curlSide === 'right'}
			<div
				class="pointer-events-none absolute right-0 bottom-0 h-[22px] w-[22px] bg-[linear-gradient(225deg,#b8956e_0%,#b8956e_45%,transparent_46%)]"
			></div>
			<div
				class="pointer-events-none absolute right-[-2px] bottom-[-2px] h-6 w-6 bg-[linear-gradient(225deg,transparent_42%,rgba(0,0,0,0.08)_44%,#e8d86c_45%)]"
			></div>
		{:else}
			<div
				class="pointer-events-none absolute bottom-0 left-0 h-[22px] w-[22px] bg-[linear-gradient(315deg,#b8956e_0%,#b8956e_45%,transparent_46%)]"
			></div>
			<div
				class="pointer-events-none absolute bottom-[-2px] left-[-2px] h-6 w-6 bg-[linear-gradient(315deg,transparent_42%,rgba(0,0,0,0.08)_44%,#e8d86c_45%)]"
			></div>
		{/if}

		<p
			class="mb-1 font-['Fredoka'] text-[0.7rem] font-bold tracking-[0.1em] text-[rgba(45,36,32,0.5)] uppercase"
		>
			{label}
		</p>
		<p class="relative z-[2] text-[1.1rem] leading-[1.35]" style="font-family: 'Caveat', cursive;">
			{text}
		</p>
	</div>
</div>
