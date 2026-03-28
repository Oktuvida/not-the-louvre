<script lang="ts">
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
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#fdfbf7"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><circle cx="13.5" cy="6.5" r=".5" fill="#fdfbf7" /><circle
				cx="17.5"
				cy="10.5"
				r=".5"
				fill="#fdfbf7"
			/><circle cx="8.5" cy="7.5" r=".5" fill="#fdfbf7" /><circle
				cx="6.5"
				cy="12.5"
				r=".5"
				fill="#fdfbf7"
			/><path
				d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
			/></svg
		>
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
	<button
		type="button"
		class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#2d2420] bg-[#c84f4f] px-4 py-3 font-semibold text-[#fdfbf7] shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
		style="font-family: 'Baloo 2', sans-serif;"
		onclick={onClear}
		disabled={isPublishing}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
				d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
			/></svg
		>
		Clear
	</button>

	<button
		type="button"
		class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#2d2420] bg-[#8b9d91] px-4 py-3 font-semibold text-[#fdfbf7] shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
		style="font-family: 'Baloo 2', sans-serif;"
		onclick={onPublish}
		disabled={isPublishing}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V15" /><path
				d="M18 18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"
			/><path d="M7 15h0" /></svg
		>
		{isPublishing ? 'Publishing...' : 'Publish'}
	</button>
</div>
