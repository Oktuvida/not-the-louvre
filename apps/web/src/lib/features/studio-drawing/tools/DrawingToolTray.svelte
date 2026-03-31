<script lang="ts">
	import { ImageUp, Palette, Trash2 } from 'lucide-svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import { drawingPalette, drawingTools } from '$lib/features/studio-drawing/state/drawing.svelte';

	let {
		isPublishing = false,
		onPublish,
		onClear
	}: {
		isPublishing?: boolean;
		onPublish?: () => void;
		onClear?: () => void;
	} = $props();
</script>

<div class="mb-6 rotate-2 rounded-2xl border-4 border-[#5d4e37] bg-[#8b7355] p-6 shadow-2xl">
	<div class="mb-4 flex items-center gap-2">
		<Palette size={20} color="#fdfbf7" />
		<span class="text-sm font-semibold text-[#fdfbf7]" style="font-family: 'Baloo 2', sans-serif;"
			>COLORS</span
		>
	</div>
	<div class="grid grid-cols-2 gap-3">
		{#each drawingPalette as color (color)}
			<button
				type="button"
				class={`h-12 w-12 rounded-full border-4 shadow-lg transition-all hover:scale-110 ${drawingTools.activeColor === color ? 'scale-110 border-[#f4c430] shadow-xl' : 'border-[#2d2420]'}`}
				style={`background-color:${color}`}
				onclick={() => {
					drawingTools.activeColor = color;
				}}
				aria-label={`Select color ${color}`}
			></button>
		{/each}
	</div>

	<div class="mt-6 border-t-2 border-[#5d4e37] pt-4">
		<label
			class="mb-2 block text-sm font-semibold text-[#fdfbf7]"
			for="brush-size"
			style="font-family: 'Baloo 2', sans-serif;">BRUSH SIZE</label
		>
		<input
			id="brush-size"
			class="w-full accent-[#d4956c]"
			type="range"
			min="1"
			max="20"
			bind:value={drawingTools.brushSize}
		/>
		<div class="mt-1 text-center font-bold text-[#fdfbf7]">{drawingTools.brushSize}px</div>
	</div>
</div>

<div class="-rotate-1 space-y-3 rounded-2xl border-4 border-[#2d2420] bg-[#d4956c] p-4 shadow-2xl">
	<GameButton
		type="button"
		variant="danger"
		size="sm"
		className="w-full"
		onclick={onClear}
		disabled={isPublishing}
	>
		<Trash2 size={20} />
		<span>Clear</span>
	</GameButton>

	<GameButton
		type="button"
		variant="secondary"
		size="sm"
		className="w-full"
		onclick={onPublish}
		disabled={isPublishing}
	>
		<ImageUp size={20} />
		<span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
	</GameButton>
</div>
