<script lang="ts">
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade } from 'svelte/transition';
	import { PAGE_FADE_DURATION_MS } from '$lib/features/shared-ui/page-fade';

	/*
	 * The full-bleed grey veil that covers a page while the next one is fetched.
	 *
	 * It used to exist three times — a GSAP tween on the home page, a second copy
	 * of that tween typed out again in the studio, and a Svelte transition in the
	 * gallery — with two z-indexes, two easings and three ideas of when the fade
	 * is "done". Since navigation is chained off that moment, every divergence
	 * was a stall or a flash between pages, and only the gallery copy honoured
	 * `prefers-reduced-motion`. This is the one implementation.
	 */
	let {
		delayMs = 0,
		direction = 'in',
		durationMs = PAGE_FADE_DURATION_MS,
		onComplete,
		visible = false
	}: {
		/** Hold before the fade starts — the camera keeps moving underneath it. */
		delayMs?: number;
		/** `in` drops the veil over the page; `out` lifts an already opaque one. */
		direction?: 'in' | 'out';
		durationMs?: number;
		/** Fires exactly once, when the veil has finished dropping or lifting. */
		onComplete?: () => void;
		visible?: boolean;
	} = $props();

	/**
	 * The scrim can outlive its own transition events, so the completion callback
	 * gets a deadline: `durationMs` plus this, then it fires anyway.
	 */
	const SAFETY_SLACK_MS = 250;

	/*
	 * One layer for every page-to-page veil. The studio's copy used to sit at
	 * z-9999 and the other two at z-100; nothing in the app renders above
	 * z-30, so the high one only meant the three could not be told apart.
	 */
	const SCRIM_CLASS = 'pointer-events-none fixed inset-0 z-(--z-nav-fade) bg-scrim';

	// The single place in the app that has to know about the motion preference
	// for this effect: the two GSAP copies forced 400ms of scrim on visitors who
	// had asked for none.
	const delay = $derived(prefersReducedMotion.current ? 0 : delayMs);
	const duration = $derived(prefersReducedMotion.current ? 0 : durationMs);

	let completed = false;
	let hasShown = false;
	let safetyHandle: ReturnType<typeof setTimeout> | null = null;

	const clearSafetyNet = () => {
		if (safetyHandle === null) return;

		clearTimeout(safetyHandle);
		safetyHandle = null;
	};

	/** Navigation hangs off this, so it runs once or not at all. */
	const complete = () => {
		clearSafetyNet();

		if (completed) return;
		completed = true;
		onComplete?.();
	};

	/*
	 * `onintroend`/`onoutroend` are the primary signal; this is the net under
	 * them, for the case where the transition event never arrives while the page
	 * is still mounted (a throttled background tab, a transition cancelled by a
	 * re-render). It is deliberately NOT an `onDestroy` fallback: an unmount
	 * means the visitor already went somewhere else, and completing then would
	 * drag them to this fade's destination instead — the exact bug the studio's
	 * `exitFadeTween?.kill()` teardown was written to stop, and one both page
	 * specs pin down.
	 */
	$effect(() => {
		if (visible) {
			hasShown = true;
		}

		const isFading = direction === 'in' ? visible : hasShown && !visible;
		if (!isFading || completed || !onComplete) return;

		safetyHandle = setTimeout(complete, delay + duration + SAFETY_SLACK_MS);

		return clearSafetyNet;
	});
</script>

<!--
	Local transitions on the block that owns the element: `visible` has to sit in
	this condition, because a transition nested one block deeper would not play
	when the outer block is destroyed.
-->
{#if direction === 'in' && visible}
	<div
		class={SCRIM_CLASS}
		data-testid="page-fade-overlay"
		in:fade={{ delay, duration }}
		onintroend={complete}
	></div>
{:else if direction === 'out' && visible}
	<!--
		A second block rather than `in:` and `out:` on one element: an outro would
		also play when the page unmounts, and its `onoutroend` would then navigate
		a visitor who has already gone somewhere else.
	-->
	<div
		class={SCRIM_CLASS}
		data-testid="page-fade-overlay"
		out:fade={{ delay, duration }}
		onoutroend={complete}
	></div>
{/if}
