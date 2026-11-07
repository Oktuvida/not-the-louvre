<script lang="ts">
	import { Flag } from 'lucide-svelte';
	import { ApiError, apiErrorMessage, requestJson } from '#lib/client/api.js';
	import WashiTape from '#lib/features/shared-ui/components/WashiTape.svelte';
	import {
		ARTWORK_REPORT_REASONS,
		ARTWORK_REPORT_REASON_LABELS,
		type ArtworkReportReason
	} from '#lib/shared/content/report-reasons.js';
	import type { Wish } from '#lib/shared/content/wishes.js';

	/*
	 * A flag of washi tape beside a slip, like the one on a postcard: the reasons
	 * are the same list the API validates, so a reason added there shows up here.
	 */
	let {
		onReported,
		request = fetch,
		wish
	}: {
		onReported?: () => void;
		request?: typeof fetch;
		wish: Wish;
	} = $props();

	let isOpen = $state(false);
	let isBusy = $state(false);
	let note = $state<string | null>(null);
	let noteTone = $state<'error' | 'success'>('success');

	const report = async (reason: ArtworkReportReason) => {
		if (isBusy) return;
		isBusy = true;

		try {
			await requestJson(`/api/wishes/${wish.id}/reports`, {
				fetch: request,
				json: { reason },
				method: 'POST'
			});
			isOpen = false;
			noteTone = 'success';
			note = 'Thanks. A moderator will read it.';
			onReported?.();
		} catch (error) {
			isOpen = false;
			noteTone = 'error';
			note =
				error instanceof ApiError && error.code === 'DUPLICATE_REPORT'
					? 'You already reported this one.'
					: apiErrorMessage(error, 'The report did not go through.');
		} finally {
			isBusy = false;
		}
	};
</script>

<div class="wish-report">
	<WashiTape
		class="wish-report-flag"
		rotate="-3deg"
		aria-expanded={isOpen}
		aria-label={`Report this slip: ${wish.text}`}
		disabled={isBusy}
		onclick={() => {
			isOpen = !isOpen;
			note = null;
		}}
	>
		<Flag size={16} aria-hidden="true" />
	</WashiTape>

	<div class="wish-report-menu" hidden={!isOpen}>
		{#each ARTWORK_REPORT_REASONS as reason (reason)}
			<button
				type="button"
				class="wish-report-reason focus-ring"
				disabled={isBusy}
				onclick={() => report(reason)}
			>
				{ARTWORK_REPORT_REASON_LABELS[reason]}
			</button>
		{/each}
	</div>

	{#if note}
		<p class="wish-report-note" data-tone={noteTone} role="status">{note}</p>
	{/if}
</div>

<style>
	.wish-report {
		position: relative;
		flex: none;
	}

	.wish-report :global(.wish-report-flag) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.2rem;
		height: 2rem;
		padding: 0;
	}

	/* A paper scrap, like the postcard's report menu. */
	.wish-report-menu {
		position: absolute;
		top: var(--report-top, calc(100% + 0.4rem));
		right: 0;
		bottom: var(--report-bottom, auto);
		z-index: 30;
		display: grid;
		gap: 0.2rem;
		min-width: 11rem;
		padding: 0.55rem;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-hairline);
		background: var(--color-paper-bright);
		box-shadow:
			3px 4px 12px rgb(0 0 0 / 0.24),
			1px 1px 3px rgb(0 0 0 / 0.12);
		rotate: -0.8deg;
	}

	.wish-report-menu[hidden] {
		display: none;
	}

	.wish-report-reason {
		--focus-ring-offset: -1px;
		width: 100%;
		padding: 0.38rem 0.5rem;
		border: 0;
		border-radius: var(--radius-hairline);
		background: transparent;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-align: left;
		text-transform: uppercase;
		color: var(--color-ink);
		cursor: pointer;
	}

	.wish-report-reason:hover {
		background: rgb(212 131 74 / 0.16);
	}

	.wish-report-reason:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.wish-report-note {
		position: absolute;
		top: var(--report-top, calc(100% + 0.3rem));
		right: 0;
		bottom: var(--report-bottom, auto);
		z-index: 30;
		width: max-content;
		max-width: 16rem;
		margin: 0;
		padding: 2px 9px;
		background: rgb(253 251 247 / 0.95);
		box-shadow: 1px 2px 5px rgb(45 36 32 / 0.2);
		rotate: -1deg;
		font-family: var(--font-hand);
		font-size: 1rem;
		font-weight: 700;
		color: #355a3d;
	}

	.wish-report-note[data-tone='error'] {
		color: var(--color-rust);
	}
</style>
