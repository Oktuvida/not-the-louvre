<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'accent' | 'danger';

	let {
		type = 'button',
		variant = 'primary',
		disabled = false,
		className = '',
		children,
		onclick
	}: {
		type?: 'button' | 'submit' | 'reset';
		variant?: Variant;
		disabled?: boolean;
		className?: string;
		children: Snippet;
		onclick?: () => void;
	} = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-[var(--color-primary)] text-[var(--color-ink)]',
		secondary: 'bg-[var(--color-secondary)] text-[var(--color-paper)]',
		accent: 'bg-[var(--color-accent)] text-[var(--color-ink)]',
		danger: 'bg-[var(--color-danger)] text-[var(--color-paper)]'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	class={`font-display inline-flex items-center justify-center rounded-[1.1rem] border-4 border-[var(--color-ink)] px-5 py-3 text-base tracking-[0.08em] uppercase shadow-[var(--shadow-card)] transition duration-200 ${disabled ? 'cursor-not-allowed opacity-55' : 'hover:-translate-y-1 hover:rotate-[1deg]'} ${variants[variant]} ${className}`}
>
	{@render children()}
</button>
