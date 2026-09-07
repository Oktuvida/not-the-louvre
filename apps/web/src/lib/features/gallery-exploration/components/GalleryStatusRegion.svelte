<script lang="ts">
	import { X } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';

	/*
	 * One place for the gallery's transient outcomes.
	 *
	 * Failures used to be a red block inserted above the grid: it pushed the
	 * whole room down the moment a refresh or an 18+ toggle failed, and no
	 * screen reader ever heard about it. This region is fixed, so it costs no
	 * layout, and it is always in the DOM — a live region that mounts together
	 * with its message is announced unreliably.
	 *
	 * `tone` drives the politeness: a failure is the assertive `role="alert"`
	 * the panel used to raise on its own, because a vote that silently did not
	 * land is worth interrupting for; anything else waits its turn.
	 */
	let {
		message = null,
		onDismiss,
		testId = 'gallery-status-region',
		tone = 'error'
	}: {
		message?: string | null;
		onDismiss?: () => void;
		testId?: string;
		tone?: 'error' | 'info';
	} = $props();

	/** Long enough to read a sentence, short enough not to become furniture. */
	const AUTO_DISMISS_MS = 8000;

	const flyParams = $derived(
		prefersReducedMotion.current ? { duration: 0, y: 0 } : { duration: 200, y: 12 }
	);

	$effect(() => {
		if (!message || !onDismiss) return;

		const timer = setTimeout(() => onDismiss(), AUTO_DISMISS_MS);
		return () => clearTimeout(timer);
	});
</script>

<!--
	The offsets clear the ambient audio tab, which is `position: fixed` in the
	bottom-right corner of every route (9.5rem x 3.6rem on phones, 17rem x 5.2rem
	from `md` up) and hit-tests over its whole box. Outranking it is not enough:
	a notice underneath it is unreadable even when it paints on top.
-->
<div
	aria-live={tone === 'error' ? 'assertive' : 'polite'}
	class="pointer-events-none fixed inset-x-0 bottom-[5rem] z-(--z-status) flex justify-center px-4 md:inset-x-auto md:right-8 md:bottom-[7.5rem] md:justify-end"
	data-testid={testId}
	role={tone === 'error' ? 'alert' : 'status'}
>
	{#if message}
		<div
			class={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border-4 border-ink-warm px-4 py-3 shadow-[3px_4px_0_rgba(45,36,32,0.35)] ${tone === 'error' ? 'bg-[#f7d8c7] text-[#7a2e1c]' : 'bg-paper-bright text-ink-warm'}`}
			transition:fly={flyParams}
		>
			<p class="text-sm font-semibold">{message}</p>
			{#if onDismiss}
				<button
					aria-label="Dismiss message"
					class="shrink-0 rounded-full p-1 transition hover:bg-[rgba(45,36,32,0.12)]"
					onclick={() => onDismiss?.()}
					type="button"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	{/if}
</div>
