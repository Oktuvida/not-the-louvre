<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';

	/*
	 * One place for the gallery's transient outcomes: a note from the museum
	 * guard, taped to the wall in the corner. It is for trouble in the
	 * background that is nobody's fault — a refresh that did not reach the
	 * server, a piece that would not open. A field the visitor got wrong is
	 * marked on the field, and an action that did not save is stamped on the
	 * thing it was done to; neither comes here.
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
	 *
	 * The note peels off the wall by itself after a while, or as soon as it is
	 * tapped anywhere: the whole note is its own dismiss button.
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

	const dropParams = $derived(
		prefersReducedMotion.current ? { duration: 0, y: 0 } : { duration: 220, y: -10 }
	);
	const peelDuration = $derived(prefersReducedMotion.current ? 0 : 320);

	/* Lifted by its bottom edge and folded up off the wall, the way a sticky
	 * note comes away: it hinges on the glue band along its top. */
	const peel = (_node: Element, { duration }: { duration: number }) => ({
		css: (t: number) =>
			`transform-origin: 50% 0; transform: perspective(32rem) rotateX(${(1 - t) * 78}deg) translateY(${(1 - t) * -0.75}rem); opacity: ${t};`,
		duration,
		easing: cubicIn
	});

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
			class="guard-note sticky-note pointer-events-auto"
			class:guard-note-info={tone === 'info'}
			in:fly={dropParams}
			out:peel={{ duration: peelDuration }}
		>
			<span class="tape guard-note-tape" aria-hidden="true"></span>
			<p class="guard-note-words">{message}</p>
			<p class="guard-note-sign" aria-hidden="true">
				<svg viewBox="0 0 34 20">
					<path d="M3 15 C 8 5, 26 5, 31 15 Z M2 15 H32 M14 8 L17 5 L20 8"></path>
				</svg>
				the guard
			</p>
			{#if onDismiss}
				<button
					aria-label="Dismiss message"
					class="guard-note-peel focus-ring"
					onclick={() => onDismiss?.()}
					type="button"
				></button>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* A yellow sticky note, handwritten, taped to the wall a little crooked. */
	.guard-note {
		--note-paper: linear-gradient(170deg, #f8e48f 0%, #f3d96f 60%, #ecce5c 100%);
		width: min(16rem, calc(100vw - 2rem));
		padding: 1.1rem 1rem 0.75rem;
		rotate: 1.5deg;
		color: var(--color-note-ink);
	}

	.guard-note-info {
		--note-paper: linear-gradient(170deg, #fdfbf3 0%, #f5efdf 60%, #ece3cc 100%);
		rotate: -1deg;
	}

	.guard-note-tape {
		position: absolute;
		top: -0.6rem;
		left: 50%;
		z-index: 3;
		width: 4rem;
		height: 1.2rem;
		translate: -50% 0;
		rotate: -4deg;
		pointer-events: none;
	}

	.guard-note-words {
		position: relative;
		z-index: 2;
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.25rem;
		font-weight: 600;
		line-height: 1.15;
		text-wrap: pretty;
	}

	.guard-note-sign {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.3rem;
		margin: 0.4rem 0 0;
		font-family: var(--font-hand);
		font-size: 1.05rem;
		color: var(--color-bark);
	}

	.guard-note-sign svg {
		width: 1.4rem;
		height: 0.85rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* The whole note is the button that peels it off. */
	.guard-note-peel {
		position: absolute;
		inset: 0;
		z-index: 4;
		border: 0;
		background: none;
		cursor: pointer;
	}
</style>
