<script lang="ts">
	import { resolve } from '$app/paths';
	import { apiErrorMessage, requestJson } from '#lib/client/api.js';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import WashiTape from '#lib/features/shared-ui/components/WashiTape.svelte';
	import {
		ARTWORK_REPORT_REASONS,
		ARTWORK_REPORT_REASON_LABELS,
		type ArtworkReportReason
	} from '#lib/shared/content/report-reasons.js';
	import type { Viewer } from '#lib/shared/viewer.js';

	type ArtworkPatch = Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>;

	// Same list the API validates against, in the same order, so a reason added
	// to the vocabulary shows up here instead of failing as a runtime 400.
	const reportReasons = ARTWORK_REPORT_REASONS.map((value) => ({
		label: ARTWORK_REPORT_REASON_LABELS[value],
		value
	}));

	let {
		artwork,
		compact = false,
		request = fetch,
		viewer = null,
		onArtworkPatch
	}: {
		artwork: Artwork;
		compact?: boolean;
		request?: typeof fetch;
		viewer?: Viewer | null;
		onArtworkPatch?: (patch: ArtworkPatch) => void;
	} = $props();

	let isBusy = $state(false);
	let isReportMenuOpen = $state(false);
	let isModMenuOpen = $state(false);
	let statusMessage = $state<string | null>(null);
	let statusTone = $state<'error' | 'success'>('success');

	const canReport = $derived(Boolean(viewer));
	const canModerate = $derived(viewer?.role === 'admin' || viewer?.role === 'moderator');

	const setStatus = (tone: 'error' | 'success', message: string) => {
		statusTone = tone;
		statusMessage = message;
	};

	const stopEvent = (event: Event) => {
		event.preventDefault();
		event.stopPropagation();
	};

	const toggleReportMenu = (event: Event) => {
		stopEvent(event);
		isReportMenuOpen = !isReportMenuOpen;
		isModMenuOpen = false;
		statusMessage = null;
	};

	const toggleModMenu = (event: Event) => {
		stopEvent(event);
		isModMenuOpen = !isModMenuOpen;
		isReportMenuOpen = false;
		statusMessage = null;
	};

	const handleReportReasonClick = (event: Event, reason: ArtworkReportReason) => {
		stopEvent(event);
		void submitReport(reason);
	};

	const submitReport = async (reason: ArtworkReportReason) => {
		if (!canReport || isBusy) {
			return;
		}

		isBusy = true;

		try {
			await requestJson(`/api/artworks/${artwork.id}/reports`, {
				fetch: request,
				json: { reason },
				method: 'POST'
			});

			isReportMenuOpen = false;
			setStatus('success', 'Report submitted.');
		} catch (error) {
			setStatus('error', apiErrorMessage(error, 'Report failed'));
		} finally {
			isBusy = false;
		}
	};

	type ModerationAction = 'clear_nsfw' | 'hide' | 'mark_nsfw' | 'unhide';

	const MODERATION_SUCCESS_COPY: Record<ModerationAction, string> = {
		clear_nsfw: 'NSFW cleared.',
		hide: 'Artwork hidden.',
		mark_nsfw: 'Marked NSFW and hidden.',
		unhide: 'Artwork visible again.'
	};

	const moderateArtwork = async (action: ModerationAction) => {
		if (!canModerate || isBusy) {
			return;
		}

		isBusy = true;

		try {
			const payload = await requestJson<{
				artwork?: { isHidden?: boolean; isNsfw?: boolean };
			} | null>(`/api/artworks/${artwork.id}/moderation`, {
				fetch: request,
				json: { action },
				method: 'PATCH'
			});

			const patch = {
				isHidden: payload?.artwork?.isHidden ?? artwork.isHidden,
				isNsfw: payload?.artwork?.isNsfw ?? artwork.isNsfw
			} satisfies ArtworkPatch;

			onArtworkPatch?.(patch);
			isModMenuOpen = false;
			setStatus('success', MODERATION_SUCCESS_COPY[action]);
		} catch (error) {
			setStatus('error', apiErrorMessage(error, 'Moderation failed'));
		} finally {
			isBusy = false;
		}
	};
</script>

<div class:compact class="safety-actions" role="group" aria-label="Artwork safety actions">
	<div class="action-row">
		{#if canReport}
			<div class="report-group">
				<WashiTape
					class={compact ? 'action-button report icon-only' : 'action-button report'}
					rotate="-2deg"
					aria-expanded={isReportMenuOpen}
					aria-label="Report artwork"
					disabled={isBusy}
					onclick={toggleReportMenu}
				>
					{#if compact}
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="currentColor"
								d="M6 3a1 1 0 0 1 1 1v1h8.6l.2-.4A1.8 1.8 0 0 1 17.4 3H20a1 1 0 1 1 0 2h-2.6a.2.2 0 0 0-.18.11l-.48.95a1 1 0 0 1-.9.54H7v13a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Z"
							></path>
							<path
								fill="currentColor"
								d="M8 7h9.38a1.5 1.5 0 0 1 1.34.83l.94 1.87a1.5 1.5 0 0 1-.02 1.38l-.91 1.73a1.5 1.5 0 0 1-1.33.79H8z"
							></path>
						</svg>
					{:else}
						Report
					{/if}
				</WashiTape>

				<div
					class="report-menu"
					class:report-menu-compact={compact}
					aria-hidden={!isReportMenuOpen}
					hidden={!isReportMenuOpen}
				>
					{#each reportReasons as reason (reason.value)}
						<button
							type="button"
							class="reason-button focus-ring"
							disabled={isBusy}
							onclick={(event) => handleReportReasonClick(event, reason.value)}
						>
							{reason.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if canModerate}
			<div class="mod-group">
				<WashiTape
					class="action-button mod"
					rotate="2deg"
					aria-expanded={isModMenuOpen}
					aria-label="Moderation menu"
					disabled={isBusy}
					onclick={toggleModMenu}
				>
					Mod
				</WashiTape>

				<div
					class="mod-menu"
					class:mod-menu-compact={compact}
					aria-hidden={!isModMenuOpen}
					hidden={!isModMenuOpen}
				>
					<p class="mod-heading">Moderation</p>
					<p class="mod-status">
						Status: {artwork.isHidden ? 'Hidden' : 'Visible'} · {artwork.isNsfw
							? 'NSFW'
							: 'Not NSFW'}
					</p>
					{#if artwork.isHidden}
						<button
							type="button"
							class="reason-button focus-ring"
							aria-label="Unhide artwork"
							disabled={isBusy}
							onclick={(event) => {
								stopEvent(event);
								moderateArtwork('unhide');
							}}
						>
							Unhide
						</button>
					{:else}
						<button
							type="button"
							class="reason-button focus-ring"
							aria-label="Hide artwork"
							disabled={isBusy}
							onclick={(event) => {
								stopEvent(event);
								moderateArtwork('hide');
							}}
						>
							Hide
						</button>
					{/if}
					{#if artwork.isNsfw}
						<button
							type="button"
							class="reason-button focus-ring"
							aria-label="Clear artwork NSFW"
							disabled={isBusy}
							onclick={(event) => {
								stopEvent(event);
								moderateArtwork('clear_nsfw');
							}}
						>
							Clear NSFW
						</button>
					{:else}
						<button
							type="button"
							class="reason-button focus-ring"
							aria-label="Mark artwork NSFW"
							disabled={isBusy}
							onclick={(event) => {
								stopEvent(event);
								moderateArtwork('mark_nsfw');
							}}
						>
							Mark NSFW + hide
						</button>
					{/if}
					<a
						class="reason-button mod-ops-link focus-ring"
						href={resolve('admin')}
						onclick={(event) => event.stopPropagation()}
					>
						Open in Ops ↗
					</a>
				</div>
			</div>
		{/if}
	</div>

	{#if statusMessage}
		<p class="status" data-tone={statusTone}>{statusMessage}</p>
	{/if}
</div>

<style>
	.safety-actions {
		display: grid;
		gap: 0.5rem;
		position: relative;
	}

	.safety-actions.compact {
		gap: 0.4rem;
	}

	.action-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.report-group,
	.mod-group {
		position: relative;
	}

	/*
	 * The chips are `<WashiTape>` now — same strip as the auth and avatar close
	 * buttons — so only the chip lettering and the moderation variant's darker
	 * stripes live here. `:global()` under `.action-row` is what reaches a child
	 * component's root without leaking the rules out of this component.
	 */
	.action-row :global(.action-button) {
		padding: 8px 13px;
		font-family: var(--font-display);
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.action-row :global(.action-button.icon-only) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.2rem;
		height: 2rem;
		padding: 0;
	}

	.action-row :global(.action-button.icon-only svg) {
		width: 1rem;
		height: 1rem;
	}

	/* Darker tape so the moderator strip reads apart from the report strip. */
	.action-row :global(.action-button.mod) {
		background: repeating-linear-gradient(
			-45deg,
			rgba(224, 207, 180, 0.94) 0 9px,
			rgba(236, 222, 198, 0.94) 9px 18px
		);
	}

	/* dropdowns are paper scraps pinned over the artwork */
	.report-menu,
	.mod-menu {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.5rem);
		left: 0;
		min-width: 11rem;
		display: grid;
		gap: 0.2rem;
		padding: 0.55rem;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-hairline);
		background: var(--color-paper-bright);
		box-shadow:
			3px 4px 12px rgba(0, 0, 0, 0.24),
			1px 1px 3px rgba(0, 0, 0, 0.12);
		rotate: -0.8deg;
	}

	.mod-menu {
		min-width: 12.5rem;
		rotate: 0.6deg;
	}

	/* `display: grid` above would defeat the `hidden` attribute (its UA rule
	 * loses the cascade); without this, the closed menus still intercept
	 * clicks wherever Tailwind's preflight isn't loaded. */
	.report-menu[hidden],
	.mod-menu[hidden] {
		display: none;
	}

	.report-menu.report-menu-compact,
	.mod-menu.mod-menu-compact {
		left: auto;
		right: 0;
	}

	.reason-button {
		/* Negative: the ring is drawn inside the row because the menu that holds
		   these buttons clips its overflow. */
		--focus-ring-offset: -1px;
		width: 100%;
		border: 0;
		border-radius: var(--radius-hairline);
		background: transparent;
		padding: 0.38rem 0.5rem;
		font-family: var(--font-display);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		text-align: left;
		color: var(--color-ink);
		cursor: pointer;
		box-shadow: none;
	}

	.reason-button:hover {
		background: rgba(212, 131, 74, 0.16);
	}

	.action-row :global(.action-button:disabled),
	.reason-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.mod-heading {
		margin: 0;
		padding: 0 0.5rem;
		font-family: var(--font-display);
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
	}

	/* the artwork's paperwork status, pencilled in by the mod on duty */
	.mod-status {
		margin: 0 0 0.25rem;
		padding: 0 0.5rem;
		font-family: var(--font-hand);
		font-size: 1.02rem;
		font-weight: 600;
		color: var(--color-olive);
		rotate: -0.6deg;
	}

	.mod-ops-link {
		display: block;
		margin-top: 0.2rem;
		border-top: 1px dashed rgba(141, 110, 78, 0.4);
		padding-top: 0.45rem;
		text-decoration: none;
		color: var(--color-bark);
	}

	/* a slip of paper so the confirmation reads over any artwork */
	.status {
		margin: 0;
		justify-self: start;
		padding: 2px 9px;
		background: rgba(253, 251, 247, 0.95);
		box-shadow: 1px 2px 5px rgba(45, 36, 32, 0.2);
		rotate: -1deg;
		font-family: var(--font-hand);
		font-size: 0.98rem;
		font-weight: 700;
		color: var(--color-ink-warm);
	}

	.safety-actions.compact .status {
		justify-self: end;
	}

	.status[data-tone='error'] {
		color: var(--color-rust);
	}

	.status[data-tone='success'] {
		color: #355a3d;
	}
</style>
