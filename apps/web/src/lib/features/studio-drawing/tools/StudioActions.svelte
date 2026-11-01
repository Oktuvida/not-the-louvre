<script lang="ts">
	import { ImageUp, Trash2 } from 'lucide-svelte';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';

	/*
	 * Publish and Clear, out of the tray so each screen's layout can put them
	 * where a finished drawing is handed in. Clear sits a thumb away from
	 * Publish, so it asks twice: the first press only arms it for a moment.
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

	<button
		type="button"
		class="clear-page focus-ring"
		class:clear-page-armed={clearArmed}
		disabled={isPublishing}
		onclick={pressClear}
	>
		<Trash2 size={18} aria-hidden="true" />
		<span>{clearArmed ? 'Tap again to clear' : 'Clear page'}</span>
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

	/* Smaller and quieter than Publish on purpose: it is the one that throws work away. */
	.clear-page {
		display: inline-flex;
		align-self: var(--actions-clear-align, center);
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 14px;
		border: 2px solid rgba(168, 64, 58, 0.55);
		border-radius: 12px;
		background: rgba(253, 251, 247, 0.72);
		color: var(--color-danger-deep);
		font-family: var(--font-display);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.clear-page-armed {
		border-color: var(--color-danger-deep);
		background: var(--color-danger-deep);
		color: var(--color-paper-bright);
	}

	.clear-page:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
</style>
