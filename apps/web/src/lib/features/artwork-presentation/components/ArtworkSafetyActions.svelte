<script lang="ts">
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
		viewer = null,
		onArtworkPatch
	}: {
		artwork: Artwork;
		compact?: boolean;
		viewer?: { id: string; role: ViewerRole } | null;
		onArtworkPatch?: (patch: ArtworkPatch) => void;
	} = $props();

	let isBusy = $state(false);
	let isReportMenuOpen = $state(false);
	let statusMessage = $state<string | null>(null);
	let statusTone = $state<'error' | 'success'>('success');

	const canReport = $derived(Boolean(viewer));
	const canModerate = $derived(viewer?.role === 'admin');

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

	const submitReport = async (reason: ArtworkReportReason) => {
		if (!canReport || isBusy) {
			return;
		}

		isBusy = true;

		try {
			const response = await fetch(`/api/artworks/${artwork.id}/reports`, {
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

	const moderateArtwork = async (action: 'hide' | 'mark_nsfw') => {
		if (!canModerate || isBusy) {
			return;
		}

		isBusy = true;

		try {
			const response = await fetch(`/api/artworks/${artwork.id}/moderation`, {
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
			setStatus('success', action === 'hide' ? 'Artwork hidden.' : 'Artwork marked NSFW.');
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
					aria-expanded={isReportMenuOpen}
					aria-label="Report artwork"
					disabled={isBusy}
					onclick={(event) => {
						stopEvent(event);
						isReportMenuOpen = !isReportMenuOpen;
						statusMessage = null;
					}}
				>
					Report
				</button>

				{#if isReportMenuOpen}
					<div class="report-menu">
						{#each reportReasons as reason (reason.value)}
							<button
								type="button"
								class="reason-button"
								disabled={isBusy}
								onclick={(event) => {
									stopEvent(event);
									submitReport(reason.value);
								}}
							>
								{reason.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		{#if canModerate}
			<button
				type="button"
				class="action-button admin"
				aria-label="Hide artwork"
				disabled={isBusy}
				onclick={(event) => {
					stopEvent(event);
					moderateArtwork('hide');
				}}
			>
				Hide
			</button>
			<button
				type="button"
				class="action-button admin"
				aria-label="Mark artwork NSFW"
				disabled={isBusy}
				onclick={(event) => {
					stopEvent(event);
					moderateArtwork('mark_nsfw');
				}}
			>
				NSFW
			</button>
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
		gap: 0.45rem;
		align-items: center;
	}

	.report-group {
		position: relative;
	}

	.action-button,
	.reason-button {
		border: 2px solid #2d2420;
		border-radius: 999px;
		background: rgba(253, 251, 247, 0.96);
		color: #2d2420;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		padding: 0.45rem 0.7rem;
		box-shadow: 0 6px 14px rgba(45, 36, 32, 0.14);
	}

	.action-button.report {
		background: rgba(248, 240, 225, 0.98);
	}

	.action-button.admin {
		background: rgba(228, 214, 195, 0.98);
	}

	.reason-button {
		width: 100%;
		border-radius: 0.85rem;
		text-align: left;
		box-shadow: none;
	}

	.action-button:disabled,
	.reason-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.report-menu {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.45rem);
		left: 0;
		min-width: 11rem;
		display: grid;
		gap: 0.35rem;
		padding: 0.45rem;
		border: 2px solid #2d2420;
		border-radius: 1rem;
		background: rgba(255, 249, 239, 0.98);
		box-shadow: 0 14px 30px rgba(45, 36, 32, 0.22);
	}

	.status {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 700;
		color: #2d2420;
	}

	.status[data-tone='error'] {
		color: #8f3720;
	}

	.status[data-tone='success'] {
		color: #355a3d;
	}
</style>
