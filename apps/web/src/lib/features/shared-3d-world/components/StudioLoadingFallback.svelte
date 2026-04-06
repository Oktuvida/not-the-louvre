<script lang="ts">
	let { failed = false }: { failed?: boolean } = $props();
</script>

<div
	aria-live="polite"
	class="pointer-events-none absolute inset-4 flex items-end justify-start sm:inset-6"
	data-testid="studio-scene-fallback"
>
	<div
		class="max-w-[18rem] rounded-[1.8rem] border-4 border-[var(--color-ink)] bg-[linear-gradient(180deg,_rgba(251,247,240,0.92),_rgba(232,219,201,0.96))] px-5 py-4 text-[var(--color-ink)] shadow-[var(--shadow-card)] backdrop-blur-sm"
	>
		<p class="text-xs font-semibold tracking-[0.24em] text-[color:rgba(38,26,18,0.72)] uppercase">
			{failed ? 'Scene preview paused' : 'Scene preview loading'}
		</p>
		<div class="mt-3 flex items-center gap-4">
			<div
				class={`h-14 w-14 rounded-full border-4 border-[var(--color-ink)] bg-[var(--color-primary)] shadow-[var(--shadow-card)] ${failed ? '' : 'animate-[bob_2s_ease-in-out_infinite]'}`}
			></div>
			<div class="space-y-2">
				<p class="font-display text-lg tracking-[0.16em] uppercase">Loading Studio...</p>
				<p class="text-sm leading-5 text-[color:rgba(38,26,18,0.76)]">
					{failed
						? 'The gallery is still open while the 3D studio preview takes a break.'
						: 'The gallery is already open while the 3D studio preview finishes loading.'}
				</p>
			</div>
		</div>
		<div
			class="mt-4 h-3 overflow-hidden rounded-full border-2 border-[var(--color-ink)] bg-white/60"
		>
			<div
				class={`h-full w-full bg-[linear-gradient(90deg,_var(--color-primary),_var(--color-accent),_var(--color-primary))] bg-[length:200%_100%] ${failed ? 'opacity-70' : 'animate-[shimmer_1.4s_linear_infinite]'}`}
			></div>
		</div>
	</div>
</div>
