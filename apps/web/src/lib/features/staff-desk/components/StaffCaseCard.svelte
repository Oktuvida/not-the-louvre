<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { hungAgo } from '#lib/features/gallery-exploration/model/hung-ago.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import WishSlip from '#lib/features/shared-ui/components/WishSlip.svelte';
	import { ARTWORK_REPORT_REASON_LABELS } from '#lib/shared/content/report-reasons.js';
	import { countLabel, type CaseAction, type StaffCase } from '../model';

	/*
	 * One case on the desk: the thing itself, why it was reported, and what can be
	 * done about it. Deleting cannot be undone, so it takes a second press.
	 */
	let {
		busy = false,
		confirmDeleteForMs = 4000,
		item,
		onDecide
	}: {
		busy?: boolean;
		/** How long a first press on Delete waits for the second. */
		confirmDeleteForMs?: number;
		item: StaffCase;
		onDecide: (action: CaseAction) => void;
	} = $props();

	const KIND_LABELS = { artwork: 'Artwork', comment: 'Comment', wish: 'Slip' } as const;

	let deleteArmed = $state(false);
	let disarmTimer: ReturnType<typeof setTimeout> | undefined;

	const hung = $derived(hungAgo(new Date(item.createdAt).getTime(), Date.now()));
	const title = $derived(
		item.targetType === 'artwork'
			? item.artworkTitle
			: item.targetType === 'comment'
				? `On ${item.artworkTitle}`
				: 'From the mailbox'
	);
	const byline = $derived.by(() => {
		if (item.targetType === 'artwork') return `by ${item.authorNickname}, ${hung}`;
		const when = hung === 'just hung' ? 'just now' : hung.replace('hung ', '');
		return `${item.targetType === 'comment' ? 'said' : 'left'} by ${item.authorNickname}, ${when}`;
	});

	const pressDelete = () => {
		clearTimeout(disarmTimer);
		if (!deleteArmed) {
			deleteArmed = true;
			disarmTimer = setTimeout(() => (deleteArmed = false), confirmDeleteForMs);
			return;
		}
		deleteArmed = false;
		onDecide('delete');
	};

	onDestroy(() => clearTimeout(disarmTimer));
</script>

<article class="staff-case">
	<div class="case-thing">
		{#if item.targetType === 'wish'}
			<WishSlip text={item.contentSummary} byline={`from ${item.authorNickname}`} tilt={-1.2} />
		{:else}
			{#if item.targetType === 'artwork'}
				<span class="case-polaroid" class:case-polaroid-hidden={item.isHidden}>
					<img src={item.mediaUrl} alt={item.artworkTitle} />
				</span>
			{:else}
				<p class="case-said">{item.contentSummary}</p>
			{/if}
			<a
				class="case-postcard focus-ring"
				href={resolve('/artwork/[artworkId]', { artworkId: item.artworkId })}
			>
				Open the postcard <span aria-hidden="true">→</span>
			</a>
		{/if}
	</div>

	<div class="case-facts">
		<p class="case-kind">
			{KIND_LABELS[item.targetType]} · {countLabel(item.reportCount, 'report')}
		</p>
		<h3 class="case-title">{title}</h3>
		<p class="case-by">{byline}</p>
		<ul class="case-reasons">
			{#each item.reasons as { count, reason } (reason)}
				<li>{ARTWORK_REPORT_REASON_LABELS[reason]} · {count}</li>
			{/each}
		</ul>
		{#each item.notes as note, index (index)}
			<p class="case-note">“{note}”</p>
		{/each}
	</div>

	{#if item.isHidden}
		<span class="case-stamp">Hidden</span>
	{/if}

	<div class="case-actions">
		{#if item.isHidden}
			<GameButton
				variant="ghost"
				size="sm"
				disabled={busy}
				className="case-action"
				onclick={() => onDecide('unhide')}
			>
				Put back
			</GameButton>
			<GameButton
				variant="accent"
				size="sm"
				disabled={busy}
				className="case-action"
				onclick={() => onDecide('dismiss')}
			>
				Stay hidden
			</GameButton>
		{:else}
			<GameButton
				variant="ghost"
				size="sm"
				disabled={busy}
				className="case-action"
				onclick={() => onDecide('dismiss')}
			>
				Keep
			</GameButton>
			<GameButton
				variant="accent"
				size="sm"
				disabled={busy}
				className="case-action"
				onclick={() => onDecide('hide')}
			>
				Hide
			</GameButton>
		{/if}
		{#if item.targetType === 'artwork'}
			<GameButton
				variant="ghost"
				size="sm"
				disabled={busy}
				className="case-action"
				onclick={() => onDecide('mark_nsfw')}
			>
				Mark 18+
			</GameButton>
		{/if}
		<GameButton
			variant="danger"
			size="sm"
			disabled={busy}
			className="case-action"
			onclick={pressDelete}
		>
			{deleteArmed ? 'Press again' : 'Delete'}
		</GameButton>
	</div>
</article>

<style>
	.staff-case {
		position: relative;
		display: grid;
		grid-template-columns: 11.5rem minmax(0, 1fr) auto;
		gap: 1.7rem;
		align-items: center;
		padding: 1.15rem 1.5rem 1.15rem 1.35rem;
		background-color: #fbf8f2;
		background-image: radial-gradient(rgb(107 90 69 / 0.08) 1px, transparent 1px);
		background-size: 4px 4px;
		box-shadow:
			0 1px 1px rgb(40 25 10 / 0.25),
			0 0.5rem 1.1rem rgb(40 25 10 / 0.26);
	}

	.case-thing {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.case-polaroid {
		display: block;
		width: 9.6rem;
		padding: 0.45rem 0.45rem 1.25rem;
		background: #fff;
		rotate: -1.6deg;
		box-shadow:
			0 1px 2px rgb(40 25 10 / 0.3),
			0 0.3rem 0.7rem rgb(40 25 10 / 0.22);
	}

	.case-polaroid img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		background: #efe9dc;
	}

	.case-polaroid-hidden img {
		filter: grayscale(0.35) brightness(0.92);
	}

	.case-said {
		width: 100%;
		margin: 0;
		padding: 0.7rem 0.8rem;
		background: #fff;
		rotate: -0.8deg;
		overflow-wrap: anywhere;
		font-family: var(--font-hand);
		font-size: 1.32rem;
		line-height: 1.25;
		box-shadow:
			0 1px 2px rgb(40 25 10 / 0.28),
			0 0.25rem 0.55rem rgb(40 25 10 / 0.18);
	}

	.case-postcard {
		font-family: var(--font-hand);
		font-size: 1.05rem;
		color: #9c3b2e;
		white-space: nowrap;
	}

	.case-postcard:hover {
		text-decoration: underline;
	}

	.case-facts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.case-kind {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(45 36 32 / 0.62);
	}

	.case-title {
		margin: 0;
		overflow-wrap: anywhere;
		font-family: var(--font-display);
		font-size: 1.32rem;
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		color: var(--color-ink-warm);
	}

	.case-by {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.15rem;
		color: rgb(45 36 32 / 0.78);
	}

	.case-reasons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.case-reasons li {
		padding: 0.16rem 0.6rem;
		background: rgb(214 123 95 / 0.24);
		font-family: var(--font-display);
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #7a2f25;
	}

	.case-note {
		margin: 0;
		overflow-wrap: anywhere;
		font-family: var(--font-hand);
		font-size: 1.15rem;
		line-height: 1.2;
		color: rgb(45 36 32 / 0.78);
	}

	.case-stamp {
		position: absolute;
		top: 0.85rem;
		right: 12.6rem;
		padding: 0.1rem 0.55rem;
		border: 2.5px solid #b5473c;
		border-radius: 3px;
		rotate: -7deg;
		font-family: var(--font-display);
		font-size: 0.86rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #b5473c;
		mix-blend-mode: multiply;
	}

	.case-actions {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		width: 10.6rem;
	}

	.case-actions :global(.case-action) {
		width: 100%;
		min-width: 0;
	}

	@media (max-width: 39.99rem) {
		.staff-case {
			grid-template-columns: 8.2rem minmax(0, 1fr);
			gap: 0.85rem;
			padding: 0.95rem 0.85rem;
		}

		.case-polaroid {
			width: 7.6rem;
			padding: 0.3rem 0.3rem 0.85rem;
		}

		.case-said {
			padding: 0.5rem 0.55rem;
			font-size: 1.14rem;
		}

		.case-title {
			font-size: 1.04rem;
		}

		.case-note {
			font-size: 1.04rem;
		}

		.case-reasons li {
			padding-inline: 0.45rem;
			font-size: 0.66rem;
		}

		.case-stamp {
			top: 0.6rem;
			right: 0.6rem;
			font-size: 0.72rem;
		}

		.case-actions {
			grid-column: 1 / -1;
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			width: 100%;
		}
	}
</style>
