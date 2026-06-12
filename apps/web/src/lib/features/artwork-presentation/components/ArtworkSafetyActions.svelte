<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

	type ViewerRole = 'admin' | 'moderator' | 'user';
	type ArtworkReportReason =
		| 'copyright'
		| 'harassment'
		| 'hate'
		| 'misinformation'
		| 'other'
		| 'sexual_content'
		| 'spam'
		| 'violence';
	type ArtworkPatch = Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>;

	const reportReasons: Array<{ label: string; value: ArtworkReportReason }> = [
		{ label: 'Spam', value: 'spam' },
		{ label: 'Harassment', value: 'harassment' },
		{ label: 'Hate', value: 'hate' },
		{ label: 'Sexual content', value: 'sexual_content' },
		{ label: 'Violence', value: 'violence' },
		{ label: 'Misinformation', value: 'misinformation' },
		{ label: 'Copyright', value: 'copyright' },
		{ label: 'Other', value: 'other' }
	];

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
		viewer?: { id: string; role: ViewerRole } | null;
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

	const parseResponse = async (response: Response) => {
		const raw = await response.text();

		if (!raw) {
			return null;
		}

		try {
			return JSON.parse(raw);
		} catch {
			return raw;
		}
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
			const response = await request(`/api/artworks/${artwork.id}/reports`, {
				body: JSON.stringify({ reason }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			});
			const payload = await parseResponse(response);

			if (!response.ok) {
				throw new Error(
					typeof payload === 'object' && payload && 'message' in payload
						? String(payload.message)
						: 'Report failed'
				);
			}

			isReportMenuOpen = false;
			setStatus('success', 'Report submitted.');
		} catch (error) {
			setStatus('error', error instanceof Error ? error.message : 'Report failed');
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
			const response = await request(`/api/artworks/${artwork.id}/moderation`, {
				body: JSON.stringify({ action }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});
			const payload = (await parseResponse(response)) as
				| { artwork?: { isHidden?: boolean; isNsfw?: boolean }; message?: string }
				| string;

			if (!response.ok) {
				throw new Error(
					typeof payload === 'object' && payload && 'message' in payload
						? String(payload.message)
						: 'Moderation failed'
				);
			}

			const patch = {
				isHidden:
					typeof payload === 'object' && payload?.artwork?.isHidden !== undefined
						? payload.artwork.isHidden
						: artwork.isHidden,
				isNsfw:
					typeof payload === 'object' && payload?.artwork?.isNsfw !== undefined
						? payload.artwork.isNsfw
						: artwork.isNsfw
			} satisfies ArtworkPatch;

			onArtworkPatch?.(patch);
			isModMenuOpen = false;
			setStatus('success', MODERATION_SUCCESS_COPY[action]);
		} catch (error) {
			setStatus('error', error instanceof Error ? error.message : 'Moderation failed');
		} finally {
			isBusy = false;
		}
	};
</script>

<div class:compact class="safety-actions" role="group" aria-label="Artwork safety actions">
	<div class="action-row">
		{#if canReport}
			<div class="report-group">
				<button
					type="button"
					class="action-button report"
					class:icon-only={compact}
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
							/>
							<path
								fill="currentColor"
								d="M8 7h9.38a1.5 1.5 0 0 1 1.34.83l.94 1.87a1.5 1.5 0 0 1-.02 1.38l-.91 1.73a1.5 1.5 0 0 1-1.33.79H8z"
							/>
						</svg>
					{:else}
						Report
					{/if}
				</button>

				<div
					class="report-menu"
					class:report-menu-compact={compact}
					aria-hidden={!isReportMenuOpen}
					hidden={!isReportMenuOpen}
				>
					{#each reportReasons as reason (reason.value)}
						<button
							type="button"
							class="reason-button"
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
				<button
					type="button"
					class="action-button mod"
					aria-expanded={isModMenuOpen}
					aria-label="Moderation menu"
					disabled={isBusy}
					onclick={toggleModMenu}
				>
					Mod
				</button>

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
							class="reason-button"
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
							class="reason-button"
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
							class="reason-button"
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
							class="reason-button"
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
						class="reason-button mod-ops-link"
						href={resolve('/admin')}
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

	/* washi-tape chips, same species as the postcard flip tape */
	.action-button {
		border: 0;
		padding: 8px 13px;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #5d4e37;
		cursor: pointer;
		background: repeating-linear-gradient(
			-45deg,
			rgba(238, 228, 205, 0.94) 0 9px,
			rgba(248, 240, 222, 0.94) 9px 18px
		);
		box-shadow: 0 2px 5px rgba(45, 36, 32, 0.28);
		/* torn tape ends — drop this line if it ghosts */
		clip-path: polygon(
			3% 0%,
			97% 2%,
			100% 26%,
			98% 52%,
			100% 78%,
			96% 100%,
			4% 98%,
			0% 70%,
			2% 44%,
			0% 22%
		);
		transition: translate 140ms ease;
	}

	.action-button:hover {
		translate: 0 -2px;
	}

	.action-button:focus-visible {
		outline: 3px solid #4ecdc4;
		outline-offset: 2px;
	}

	.action-button.report {
		rotate: -2deg;
	}

	.action-button.icon-only {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.2rem;
		height: 2rem;
		padding: 0;
	}

	.action-button.icon-only :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.action-button.mod {
		rotate: 2deg;
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
		border: 1px solid #d6cfc5;
		border-radius: 2px;
		background: #fdfbf7;
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
		width: 100%;
		border: 0;
		border-radius: 2px;
		background: transparent;
		padding: 0.38rem 0.5rem;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		text-align: left;
		color: #2f241c;
		cursor: pointer;
		box-shadow: none;
	}

	.reason-button:hover {
		background: rgba(212, 131, 74, 0.16);
	}

	.reason-button:focus-visible {
		outline: 3px solid #4ecdc4;
		outline-offset: -1px;
	}

	.action-button:disabled,
	.reason-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.mod-heading {
		margin: 0;
		padding: 0 0.5rem;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	/* the artwork's paperwork status, pencilled in by the mod on duty */
	.mod-status {
		margin: 0 0 0.25rem;
		padding: 0 0.5rem;
		font-family: 'Caveat', cursive;
		font-size: 1.02rem;
		font-weight: 600;
		color: #5d4e37;
		rotate: -0.6deg;
	}

	.mod-ops-link {
		display: block;
		margin-top: 0.2rem;
		border-top: 1px dashed rgba(141, 110, 78, 0.4);
		padding-top: 0.45rem;
		text-decoration: none;
		color: #6b5a45;
	}

	/* a slip of paper so the confirmation reads over any artwork */
	.status {
		margin: 0;
		justify-self: start;
		padding: 2px 9px;
		background: rgba(253, 251, 247, 0.95);
		box-shadow: 1px 2px 5px rgba(45, 36, 32, 0.2);
		rotate: -1deg;
		font-family: 'Caveat', cursive;
		font-size: 0.98rem;
		font-weight: 700;
		color: #2d2420;
	}

	.safety-actions.compact .status {
		justify-self: end;
	}

	.status[data-tone='error'] {
		color: #8f3720;
	}

	.status[data-tone='success'] {
		color: #355a3d;
	}
</style>
