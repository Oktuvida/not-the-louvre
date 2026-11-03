<script lang="ts">
	import { ImageUp, Scissors } from 'lucide-svelte';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';

	/*
	 * Publish, and tearing the page out, out of the tray so each screen's layout
	 * can put them where a finished drawing is handed in. Tearing out sits a
	 * thumb away from Publish, so it asks twice: the first press only arms it
	 * for a moment.
	 */
	let {
		confirmClearForMs = 4000,
		isPublishing = false,
		onClear,
		onPublish
	}: {
		/** How long a first press on Clear waits for the second. */
		confirmClearForMs?: number;
		isPublishing?: boolean;
		onClear?: () => void;
		onPublish?: () => void;
	} = $props();

	let clearArmed = $state(false);
	let disarmTimer: ReturnType<typeof setTimeout> | undefined;

	const pressClear = () => {
		clearTimeout(disarmTimer);
		if (!clearArmed) {
			clearArmed = true;
			disarmTimer = setTimeout(() => (clearArmed = false), confirmClearForMs);
			return;
		}

		clearArmed = false;
		onClear?.();
	};

	$effect(() => () => clearTimeout(disarmTimer));
</script>

<div class="studio-actions-buttons">
	<GameButton
		type="button"
		variant="secondary"
		size="sm"
		className="studio-publish"
		onclick={onPublish}
		disabled={isPublishing}
	>
		<ImageUp size={20} />
		<span>{isPublishing ? 'Publishing…' : 'Publish'}</span>
	</GameButton>

	<!-- A strip of the page's own paper along a perforated line, lettered in
	     red pencil. -->
	<button
		type="button"
		class="tear-strip focus-ring"
		class:tear-strip-armed={clearArmed}
		disabled={isPublishing}
		onclick={pressClear}
	>
		<span class="tear-perforation" aria-hidden="true"></span>
		<span class="tear-words">
			<Scissors size={17} aria-hidden="true" />
			<span>{clearArmed ? 'Sure? Tap again' : 'Tear out this page'}</span>
		</span>
	</button>
</div>

<style>
	.studio-actions-buttons {
		display: flex;
		flex-direction: var(--actions-direction, column);
		align-items: var(--actions-align, stretch);
		gap: var(--actions-gap, 0.875rem);
	}

	.studio-actions-buttons :global(.studio-publish) {
		flex: var(--actions-publish-flex, 0 0 auto);
	}

	.tear-strip {
		position: relative;
		display: flex;
		align-self: var(--actions-clear-align, center);
		flex-direction: column;
		justify-content: center;
		min-height: 44px;
		padding: 0.35rem 0.9rem 0.45rem;
		border: 0;
		background: linear-gradient(178deg, #fffdf8, #f6f0e4);
		box-shadow:
			0 1px 1px rgb(40 25 10 / 0.2),
			0 4px 8px rgb(40 25 10 / 0.22);
		rotate: -0.8deg;
		color: #a8362b;
		cursor: pointer;
		transition:
			translate var(--duration-fast) ease,
			rotate var(--duration-fast) ease;
	}

	.tear-strip:hover {
		translate: 0 -1px;
		rotate: -1.4deg;
	}

	/* The perforation it would tear along. */
	.tear-perforation {
		display: block;
		height: 2px;
		margin-bottom: 0.3rem;
		background: repeating-linear-gradient(90deg, #8a7f74 0 6px, transparent 6px 10px);
		opacity: 0.75;
	}

	.tear-words {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-family: var(--font-hand);
		font-size: 1.2rem;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
	}

	/* Armed: the line has started to give, and the words are pressed harder. */
	.tear-strip-armed {
		background: linear-gradient(178deg, #fff6f2, #f8e6df);
		rotate: -2.4deg;
	}

	.tear-strip-armed .tear-perforation {
		background: repeating-linear-gradient(90deg, #a8362b 0 6px, transparent 6px 10px);
		clip-path: polygon(0 0, 62% 0, 66% 100%, 0 100%);
	}

	.tear-strip:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
</style>
