<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import ArtworkSafetyActions from '$lib/features/artwork-presentation/components/ArtworkSafetyActions.svelte';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import { resolve } from '$app/paths';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import StudioPanel from '$lib/features/shared-ui/components/StudioPanel.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';

	let {
		artwork,
		adultContentEnabled = false,
		checkTextContent = defaultCheckTextContent,
		onAdultContentToggle,
		viewer = null,
		onArtworkChange,
		onArtworkPatch,
		onClose
	}: {
		artwork: Artwork | null;
		adultContentEnabled?: boolean;
		checkTextContent?: TextContentChecker;
		onAdultContentToggle?: (enabled: boolean) => Promise<void> | void;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
		onArtworkChange?: (artwork: Artwork) => void;
		onArtworkPatch?: (
			artworkId: string,
			patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
		) => void;
		onClose?: () => void;
	} = $props();

	let commentBody = $state('');
	let actionError = $state<string | null>(null);
	let isUpdatingAdultContentPreference = $state(false);
	let isSubmittingComment = $state(false);
	let isSubmittingVote = $state(false);
	let commentInput: HTMLInputElement | undefined = $state();

	const isSensitiveBlurred = $derived(Boolean(artwork?.isNsfw) && !adultContentEnabled);
	const forkAttribution = $derived.by(() => {
		if (!artwork?.lineage?.isFork) return null;
		if (artwork.lineage.parentStatus !== 'available' || !artwork.lineage.parent) {
			return 'Forked artwork';
		}

		return `Forked from ${artwork.lineage.parent.title} by ${artwork.lineage.parent.author.nickname}`;
	});

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

	const patchArtwork = (patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>) => {
		if (!artwork) return;

		const nextArtwork = { ...artwork, ...patch };
		onArtworkPatch?.(artwork.id, patch);
		syncArtwork(nextArtwork);
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

	const goToFork = async () => {
		if (!artwork || !requireViewer()) return;

		await goto(resolve(`/draw?fork=${artwork.id}`));
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
			commentInput?.focus();
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Comment failed';
		} finally {
			isSubmittingComment = false;
		}
	};
</script>

{#if artwork}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/65 px-3 py-3 backdrop-blur-sm md:px-4 md:py-8"
		role="dialog"
		aria-modal="true"
		aria-label={`Artwork details for ${artwork.title}`}
		tabindex="-1"
		onclick={onClose}
		onkeydown={(event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose?.();
			}
		}}
	>
		<div
			class="relative w-full max-w-4xl"
			role="presentation"
			onclick={(event: MouseEvent) => event.stopPropagation()}
			onkeydown={(event: KeyboardEvent) => {
				if (event.key === 'Escape') {
					event.stopPropagation();
				}
			}}
		>
			<StudioPanel
				tone="paper"
				className="relative max-h-[calc(100dvh-1.5rem)] overflow-y-auto px-4 py-4 md:max-h-[calc(100dvh-4rem)] md:px-8 md:py-8"
			>
				<div
					class="grid min-h-0 gap-4 md:max-h-[min(86vh,52rem)] md:grid-cols-[minmax(0,1.1fr)_minmax(19rem,24rem)] md:gap-6"
				>
					<div class="flex min-h-0 flex-col gap-4">
						<div class="relative">
							{#if viewer}
								<div class="absolute top-2 right-2 z-20 md:top-3 md:right-3">
									<ArtworkSafetyActions {artwork} compact {viewer} onArtworkPatch={patchArtwork} />
								</div>
							{/if}
							<div class="border-4 border-[#2d2420] bg-white p-2.5 shadow-lg md:p-4">
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
									class="absolute -top-2 -right-2 animate-[bob_1.8s_ease-in-out_infinite] text-5xl md:-top-4 md:-right-4 md:text-6xl"
								>
									{{ 1: '🥇', 2: '🥈', 3: '🥉' }[artwork.rank as 1 | 2 | 3]}
								</div>
							{/if}
						</div>
						<div
							class="rounded-[1.4rem] border-3 border-[#2d2420] bg-[#f8f2e8]/95 p-3 shadow-[0_10px_24px_rgba(45,36,32,0.16)]"
						>
							<div class="grid gap-2">
								{#if viewer}
									<div class="grid grid-cols-2 gap-2">
										<GameButton
											variant="secondary"
											size="sm"
											className="w-full justify-center"
											onclick={() => submitVote('up')}>👍 {artwork.upvotes}</GameButton
										>
										<GameButton
											variant="danger"
											size="sm"
											className="w-full justify-center"
											onclick={() => submitVote('down')}>👎 {artwork.downvotes}</GameButton
										>
									</div>
									<div class="grid grid-cols-2 gap-2">
										<GameButton
											variant="accent"
											size="sm"
											className="w-full justify-center"
											onclick={goToFork}>📄 Fork</GameButton
										>
										<GameButton
											variant="ghost"
											size="sm"
											className="w-full justify-center"
											onclick={onClose}>Close</GameButton
										>
									</div>
								{:else}
									<p class="text-sm text-[#5d4e37]">Sign in to vote, fork, or leave a comment.</p>
								{/if}
							</div>
							{#if actionError}
								<p class="mt-3 text-sm text-[#8f3720]">{actionError}</p>
							{/if}
						</div>
					</div>
					<div
						class="flex min-h-0 flex-col rounded-[1.5rem] border-3 border-[#2d2420] bg-[#fff9ef]/96 p-4 shadow-[0_16px_34px_rgba(45,36,32,0.18)] md:rounded-[1.75rem] md:p-5"
					>
						<h2
							class="font-display text-2xl leading-tight tracking-[0.06em] text-[var(--color-ink)] uppercase [text-shadow:2px_2px_0px_#e8b896] sm:text-3xl md:text-4xl"
						>
							{artwork.title}
						</h2>
						{#if forkAttribution}
							<p class="mt-2 text-xs font-semibold tracking-[0.08em] text-[#8a6a42] uppercase">
								{forkAttribution}
							</p>
						{/if}
						<div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex min-w-0 items-center gap-3">
								{#if artwork.artistAvatar}
									<WaxSealAvatar
										alt={artwork.artist}
										seed={artwork.id}
										size="md"
										src={artwork.artistAvatar}
									/>
								{/if}
								<p class="min-w-0 text-lg break-words text-[var(--color-muted)] italic sm:text-xl">
									by {artwork.artist}
								</p>
							</div>
							<p class="text-sm font-semibold tracking-[0.08em] text-[#6b625a] sm:shrink-0">
								{artwork.forkCount ?? 0} forks
							</p>
						</div>
						<div
							class="mt-5 flex max-h-[min(55dvh,30rem)] min-h-0 flex-1 flex-col overflow-hidden rounded-[1.3rem] border-2 border-[#c9b69c] bg-[#f4ecdf] md:mt-6 md:max-h-[24rem]"
						>
							{#if artwork.comments.length > 0}
								<div class="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-4">
									<div class="space-y-3">
										{#each artwork.comments as comment (comment.id)}
											<div
												class="rounded-2xl border border-[#d2c3ab] bg-[#fffaf2] px-3 py-2 shadow-[0_6px_14px_rgba(45,36,32,0.06)]"
											>
												<p class="text-xs font-black tracking-[0.08em] text-[#5d4e37]">
													{comment.author}
												</p>
												<p class="mt-1 text-sm leading-snug text-[#4d4339]">{comment.text}</p>
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<div
									class="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-[#7b6d5f]"
								>
									No comments yet.
								</div>
							{/if}
							{#if viewer}
								<form
									class="border-t border-[#d7c8b1] bg-[#fbf5ea] p-3"
									onsubmit={(event) => {
										event.preventDefault();
										submitComment();
									}}
								>
									<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
										<input
											bind:this={commentInput}
											bind:value={commentBody}
											type="text"
											placeholder="Write a comment"
											class="min-w-0 flex-1 rounded-full border-2 border-[#c8af95] bg-white px-4 py-2.5 text-sm transition outline-none focus:border-[#4ecdc4]"
										/>
										<button
											type="submit"
											class="rounded-full border-2 border-[#2d2420] bg-[#f4c430] px-4 py-2 text-xs font-black tracking-[0.16em] text-[#2d2420] uppercase transition hover:-translate-y-0.5 disabled:opacity-60 sm:shrink-0"
											disabled={isSubmittingComment}
											aria-label="Send comment"
										>
											Send
										</button>
									</div>
								</form>
							{/if}
						</div>
					</div>
				</div>
			</StudioPanel>
		</div>
	</div>
{/if}
