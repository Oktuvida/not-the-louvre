<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'paper' | 'wood' | 'accent';

	let {
		tone = 'paper',
		className = '',
		children
	}: {
		tone?: Tone;
		className?: string;
		children: Snippet;
	} = $props();

	const tones: Record<Tone, string> = {
		paper: 'bg-[var(--color-panel)] text-[var(--color-ink)] border-[var(--color-ink)]',
		wood: 'bg-[#7d5d47] text-[var(--color-paper)] border-[#533b2d]',
		accent: 'bg-[rgb(217,176,123,0.88)] text-[var(--color-ink)] border-[var(--color-ink)]'
	};
</script>

<section
	class={`paper-noise relative overflow-hidden rounded-[1.75rem] border-4 shadow-[var(--shadow-strong)] ${tones[tone]} ${className}`}
>
	<div class="relative z-10">{@render children()}</div>
</section>
