<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'accent' | 'ghost';
	type AppHref = '/' | '/draw' | '/gallery' | `/gallery/${string}`;

	let {
		href,
		variant = 'primary',
		className = '',
		children
	}: {
		href: AppHref;
		variant?: Variant;
		className?: string;
		children: Snippet;
	} = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-[var(--color-primary)] text-[var(--color-ink)]',
		secondary: 'bg-[var(--color-secondary)] text-[var(--color-paper)]',
		accent: 'bg-[var(--color-accent)] text-[var(--color-ink)]',
		ghost: 'bg-[rgb(255,255,255,0.62)] text-[var(--color-ink)]'
	};

	const classes = $derived(
		`font-display inline-flex items-center justify-center rounded-[1.1rem] border-4 border-[var(--color-ink)] px-6 py-3 text-base tracking-[0.08em] uppercase shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:rotate-[-1deg] ${variants[variant]} ${className}`
	);
</script>

{#if href === '/'}
	<a href={resolve('/')} class={classes}>
		{@render children()}
	</a>
{:else if href === '/draw'}
	<a href={resolve('/draw')} class={classes}>
		{@render children()}
	</a>
{:else if href === '/gallery'}
	<a href={resolve('/gallery')} class={classes}>
		{@render children()}
	</a>
{:else}
	<a href={resolve('/gallery/[room]', { room: href.replace('/gallery/', '') })} class={classes}>
		{@render children()}
	</a>
{/if}
