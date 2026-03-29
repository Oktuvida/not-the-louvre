<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import { resolve } from '$app/paths';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import StudioPanel from '$lib/features/shared-ui/components/StudioPanel.svelte';

	let {
		artwork,
		adultContentEnabled = false,
		checkTextContent = defaultCheckTextContent,
		onAdultContentToggle,
		viewer = null,
		onArtworkChange,
		onClose
	}: {
		artwork: Artwork | null;
		adultContentEnabled?: boolean;
		checkTextContent?: TextContentChecker;
		onAdultContentToggle?: (enabled: boolean) => Promise<void> | void;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
		onArtworkChange?: (artwork: Artwork) => void;
		onClose?: () => void;
	} = $props();

	let commentBody = $state('');
	let actionError = $state<string | null>(null);
	let isUpdatingAdultContentPreference = $state(false);
	let isSubmittingComment = $state(false);
	let isSubmittingVote = $state(false);

	const isSensitiveBlurred = $derived(Boolean(artwork?.isNsfw) && !adultContentEnabled);

	const requireViewer = () => {
		if (!viewer) {
			actionError = 'Sign in to interact with artworks.';
			return false;
		}

		return true;
	};

	const syncArtwork = (nextArtwork: Artwork) => {
		onArtworkChange?.(nextArtwork);
	};

	const updateAdultContentVisibility = async (enabled: boolean) => {
		if (!onAdultContentToggle || isUpdatingAdultContentPreference) return;

		isUpdatingAdultContentPreference = true;
		actionError = null;

		try {
			await onAdultContentToggle(enabled);
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : '18+ artwork preference could not be updated.';
		} finally {
			isUpdatingAdultContentPreference = false;
		}
	};

	const submitVote = async (value: 'down' | 'up') => {
		if (!artwork || isSubmittingVote || !requireViewer()) return;

		isSubmittingVote = true;
		actionError = null;

		try {
			const method = artwork.viewerVote === value ? 'DELETE' : 'POST';
			const response = await fetch(`/api/artworks/${artwork.id}/vote`, {
				body: method === 'POST' ? JSON.stringify({ value }) : undefined,
				headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
				method
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as { message?: string } | null;
				throw new Error(payload?.message ?? 'Vote failed');
			}

			const payload = (await response.json()) as { artwork: { score: number } };
			const currentVote = artwork.viewerVote;
			const nextVote = method === 'DELETE' ? null : value;
			const upvotes =
				artwork.upvotes + (currentVote === 'up' ? -1 : 0) + (nextVote === 'up' ? 1 : 0);
			const downvotes =
				artwork.downvotes + (currentVote === 'down' ? -1 : 0) + (nextVote === 'down' ? 1 : 0);

			syncArtwork({
				...artwork,
				downvotes,
				score: payload.artwork.score,
				upvotes,
				viewerVote: nextVote
			});
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Vote failed';
		} finally {
			isSubmittingVote = false;
		}
	};

	const submitComment = async () => {
		if (!artwork || isSubmittingComment || !requireViewer()) return;

		const body = commentBody.trim();
		if (!body) {
			actionError = 'Comment cannot be empty.';
			return;
		}

		const moderationResult = await checkTextContent(body, 'comment');
		if (moderationResult.status !== 'allowed') {
			actionError = moderationResult.message;
			return;
		}

		isSubmittingComment = true;
		actionError = null;

		try {
			const response = await fetch(`/api/artworks/${artwork.id}/comments`, {
				body: JSON.stringify({ body }),
				headers: { 'content-type': 'application/json' },
				method: 'POST'
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as { message?: string } | null;
				throw new Error(payload?.message ?? 'Comment failed');
			}

			const payload = (await response.json()) as {
				comment: {
					author: { nickname: string };
					body: string;
					createdAt?: string;
					id: string;
				};
			};

			syncArtwork({
				...artwork,
				commentCount: (artwork.commentCount ?? artwork.comments.length) + 1,
				comments: [
					...artwork.comments,
					{
						author: payload.comment.author.nickname,
						id: payload.comment.id,
						text: payload.comment.body,
						timestamp: payload.comment.createdAt
							? Date.parse(payload.comment.createdAt)
							: Date.now()
					}
				]
			});
			commentBody = '';
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Comment failed';
		} finally {
			isSubmittingComment = false;
		}
	};
</script>

{#if artwork}
	<button
		type="button"
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-sm"
		onclick={onClose}
		aria-label="Close artwork details"
	>
		<div
			class="w-full max-w-4xl"
			role="presentation"
			onclick={(event: MouseEvent) => event.stopPropagation()}
			onkeydown={(event: KeyboardEvent) => {
				if (event.key === 'Escape') {
					event.stopPropagation();
				}
			}}
		>
			<StudioPanel tone="paper" className="relative px-6 py-6 md:px-8 md:py-8">
				<div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
					<div class="relative">
						<div class="border-4 border-[#2d2420] bg-white p-4 shadow-lg">
							<div class="relative">
								<img
									class={`aspect-square w-full object-cover transition duration-200 ${isSensitiveBlurred ? 'scale-[1.04] blur-xl saturate-0' : ''}`}
									src={artwork.imageUrl}
									alt={artwork.title}
								/>
								{#if isSensitiveBlurred}
									<div
										class="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(45,36,32,0.72)] px-6 text-center text-[#fdfbf7]"
									>
										<span
											class="rounded-full border-2 border-[#fdfbf7] px-3 py-1 text-xs font-black"
											>18+</span
										>
										<p class="mt-3 text-lg font-bold uppercase">Sensitive artwork</p>
										<p class="mt-2 text-sm">Reveal 18+ artworks to view this piece in full.</p>
										{#if viewer}
											<button
												type="button"
												class="mt-4 rounded-[0.95rem] border-3 border-[#fdfbf7] bg-[#d68a49] px-4 py-2 text-sm font-black text-[#2d2420]"
												disabled={isUpdatingAdultContentPreference}
												onclick={() => updateAdultContentVisibility(true)}
											>
												Reveal 18+ artworks
											</button>
										{:else}
											<p class="mt-4 text-xs font-semibold">Sign in to reveal 18+ artworks.</p>
										{/if}
									</div>
								{/if}
							</div>
						</div>
						{#if artwork.rank && artwork.rank <= 3}
							<div
								class="absolute -top-4 -right-4 animate-[bob_1.8s_ease-in-out_infinite] text-6xl"
							>
								{{ 1: '🥇', 2: '🥈', 3: '🥉' }[artwork.rank as 1 | 2 | 3]}
							</div>
						{/if}
					</div>
					<div>
						<p class="font-display text-xs tracking-[0.35em] text-[var(--color-muted)] uppercase">
							Artwork details
						</p>
						<h2
							class="font-display mt-3 text-4xl tracking-[0.08em] text-[var(--color-ink)] uppercase [text-shadow:2px_2px_0px_#e8b896]"
						>
							{artwork.title}
						</h2>
						<div class="mt-3 flex items-center gap-3">
							{#if artwork.artistAvatar}
								<div
									class="h-12 w-12 overflow-hidden rounded-full border-[3px] border-[#2d2420] shadow-md"
								>
									<img src={artwork.artistAvatar} alt={artwork.artist} class="h-full w-full" />
								</div>
							{/if}
							<p class="text-xl text-[var(--color-muted)] italic">by {artwork.artist}</p>
						</div>
						<div
							class="mt-6 -rotate-1 rounded-xl border-4 border-[#2d2420] bg-[#f4c430] p-6 text-center shadow-lg"
						>
							<div class="font-display text-5xl font-black text-[#2d2420]">⭐ {artwork.score}</div>
							<p class="mt-2 text-sm font-semibold text-[#2d2420]">POWER SCORE</p>
						</div>
						<div class="mt-6 grid grid-cols-2 gap-4">
							<GameButton
								variant="secondary"
								className="w-full justify-center"
								onclick={() => submitVote('up')}>👍 {artwork.upvotes}</GameButton
							>
							<GameButton
								variant="danger"
								className="w-full justify-center"
								onclick={() => submitVote('down')}>👎 {artwork.downvotes}</GameButton
							>
							<GameButton
								variant="primary"
								className="w-full justify-center"
								onclick={submitComment}>💬 Comment</GameButton
							>
							<a
								href={resolve(`/draw?fork=${artwork.id}`)}
								class="font-display inline-flex w-full items-center justify-center rounded-[1.1rem] border-4 border-[var(--color-ink)] bg-[var(--color-accent)] px-6 py-3 text-base tracking-[0.08em] uppercase shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:rotate-[-1deg]"
							>
								📄 Fork
							</a>
						</div>
						<p class="mt-3 text-sm text-[#6b625a]">Forks: {artwork.forkCount ?? 0}</p>
						<label class="mt-4 block space-y-2">
							<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
								>Add a comment</span
							>
							<textarea
								bind:value={commentBody}
								rows="3"
								placeholder="Say something about this piece"
								class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
							></textarea>
						</label>
						{#if actionError}
							<p class="mt-2 text-sm text-[#8f3720]">{actionError}</p>
						{/if}
						{#if artwork.comments.length > 0}
							<div class="mt-6 space-y-3">
								<h3 class="font-display text-xl text-[#2d2420]">Comments</h3>
								{#each artwork.comments as comment (comment.id)}
									<div class="rotate-1 rounded-lg border-2 border-[#2d2420] bg-[#e5dfd5] p-4">
										<p class="text-sm font-semibold text-[#2d2420]">{comment.author}</p>
										<p class="mt-1 text-[#6b625a]">{comment.text}</p>
									</div>
								{/each}
							</div>
						{/if}
						<div class="mt-6 flex justify-end">
							<GameButton variant="danger" onclick={onClose}>Close</GameButton>
						</div>
					</div>
				</div>
			</StudioPanel>
		</div>
	</button>
{/if}
