<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { Download, GitFork } from 'lucide-svelte';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import ArtworkSafetyActions from '$lib/features/artwork-presentation/components/ArtworkSafetyActions.svelte';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import { resolve } from '$app/paths';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';

	let {
		artwork,
		adultContentEnabled = false,
		checkTextContent = defaultCheckTextContent,
		isHydrating = false,
		onAdultContentToggle,
		viewer = null,
		onArtworkChange,
		onArtworkPatch,
		onClose,
		revealedArtworkIds
	}: {
		artwork: Artwork | null;
		adultContentEnabled?: boolean;
		checkTextContent?: TextContentChecker;
		isHydrating?: boolean;
		onAdultContentToggle?: (enabled: boolean) => Promise<void> | void;
		viewer?: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
		onArtworkChange?: (artwork: Artwork) => void;
		onArtworkPatch?: (
			artworkId: string,
			patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
		) => void;
		onClose?: () => void;
		revealedArtworkIds?: import('svelte/store').Writable<Set<string>>;
	} = $props();

	let commentBody = $state('');
	let actionError = $state<string | null>(null);
	let avatarPreviewArtworkId = $state<string | null>(null);
	let isUpdatingAdultContentPreference = $state(false);
	let isSubmittingComment = $state(false);
	let isSubmittingVote = $state(false);
	let isDownloading = $state(false);
	let commentInput: HTMLInputElement | undefined = $state();
	let dialogElement: HTMLDivElement | undefined = $state();

	// --- Postcard flip + tilt ---
	let isFlipped = $state(false);
	let isLifting = $state(false);
	let tiltX = $state(0);
	let tiltY = $state(0);
	let liftTimer: ReturnType<typeof setTimeout> | undefined;
	let tiltFrame = 0;

	const FLIP_DURATION_MS = 650;
	const hoverCapable = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

	const transitionDuration = $derived(prefersReducedMotion.current ? 0 : 180);
	const flipDuration = $derived(prefersReducedMotion.current ? 0 : FLIP_DURATION_MS);
	const openArtworkId = $derived(artwork?.id ?? null);

	const MONTH_STAMPS = [
		'JAN',
		'FEB',
		'MAR',
		'APR',
		'MAY',
		'JUN',
		'JUL',
		'AUG',
		'SEP',
		'OCT',
		'NOV',
		'DEC'
	] as const;
	const postmark = $derived.by(() => {
		if (!artwork) return null;
		const date = new Date(artwork.timestamp);
		return {
			day: `${MONTH_STAMPS[date.getMonth()]} ${date.getDate()}`,
			year: `${date.getFullYear()}`
		};
	});
	const artworkDate = $derived(
		artwork
			? new Date(artwork.timestamp).toLocaleDateString('en-US', {
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				})
			: null
	);

	const toggleFlip = () => {
		isFlipped = !isFlipped;

		if (prefersReducedMotion.current) return;
		isLifting = true;
		clearTimeout(liftTimer);
		liftTimer = setTimeout(() => {
			isLifting = false;
		}, FLIP_DURATION_MS);
	};

	const handleTiltMove = (event: PointerEvent) => {
		if (!hoverCapable || prefersReducedMotion.current) return;

		const target = event.currentTarget as HTMLElement;
		const bounds = target.getBoundingClientRect();
		const relativeX = (event.clientX - bounds.left) / bounds.width - 0.5;
		const relativeY = (event.clientY - bounds.top) / bounds.height - 0.5;

		cancelAnimationFrame(tiltFrame);
		tiltFrame = requestAnimationFrame(() => {
			tiltX = -relativeY * 5;
			tiltY = relativeX * 6;
		});
	};

	const resetTilt = () => {
		cancelAnimationFrame(tiltFrame);
		tiltX = 0;
		tiltY = 0;
	};

	// Show the front again whenever a different artwork opens.
	$effect(() => {
		void openArtworkId;
		isFlipped = false;
	});

	// Lock background scrolling while the dialog is open, compensating for the
	// scrollbar so the page does not shift on desktop.
	$effect(() => {
		if (!openArtworkId) return;

		const { body, documentElement } = document;
		const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
		const previousOverflow = body.style.overflow;
		const previousPaddingRight = body.style.paddingRight;

		body.style.overflow = 'hidden';
		if (scrollbarWidth > 0) {
			body.style.paddingRight = `${scrollbarWidth}px`;
		}

		return () => {
			body.style.overflow = previousOverflow;
			body.style.paddingRight = previousPaddingRight;
		};
	});

	// Move focus into the dialog so Escape and screen readers work immediately,
	// and hand it back to the trigger on close. Keyed on the artwork id so
	// in-place hydration (votes, comments) never steals focus.
	$effect(() => {
		if (!openArtworkId || !dialogElement) return;

		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialogElement.focus();

		return () => {
			previouslyFocused?.focus();
		};
	});

	const isAvatarPreviewOpen = $derived(avatarPreviewArtworkId === (artwork?.id ?? null));
	let revealedIds = $state<Set<string>>(new Set());
	$effect(() => {
		if (!revealedArtworkIds) return;
		return revealedArtworkIds.subscribe((ids) => {
			revealedIds = ids;
		});
	});
	const isRevealed = $derived(Boolean(artwork?.id) && revealedIds.has(artwork!.id));
	const viewerIsAuthor = $derived(Boolean(viewer) && viewer?.id === artwork?.authorId);
	const isSensitiveBlurred = $derived(
		Boolean(artwork?.isNsfw) && !adultContentEnabled && !isRevealed && !viewerIsAuthor
	);
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

	const openAvatarPreview = () => {
		if (!artwork?.artistAvatar) return;
		avatarPreviewArtworkId = artwork.id;
	};

	const closeAvatarPreview = () => {
		avatarPreviewArtworkId = null;
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

	const downloadExtensions: Record<string, string> = {
		'image/avif': 'avif',
		'image/gif': 'gif',
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp'
	};

	const downloadArtwork = async () => {
		if (!artwork || isDownloading) return;

		isDownloading = true;
		actionError = null;

		try {
			const response = await fetch(artwork.imageUrl);
			if (!response.ok) {
				throw new Error('Artwork could not be downloaded.');
			}

			const blob = await response.blob();
			const extension = downloadExtensions[blob.type] ?? 'png';
			const safeTitle =
				artwork.title
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/(^-|-$)/g, '') || 'artwork';

			const objectUrl = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = objectUrl;
			anchor.download = `${safeTitle}.${extension}`;
			anchor.click();
			URL.revokeObjectURL(objectUrl);
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Artwork could not be downloaded.';
		} finally {
			isDownloading = false;
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
		bind:this={dialogElement}
		class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/65 px-3 py-3 backdrop-blur-sm outline-none md:px-4 md:py-6"
		role="dialog"
		aria-modal="true"
		aria-label={`Artwork details for ${artwork.title}`}
		tabindex="-1"
		transition:fade={{ duration: transitionDuration }}
		onclick={onClose}
		onkeydown={(event: KeyboardEvent) => {
			if (event.key === 'Escape' && isAvatarPreviewOpen) {
				closeAvatarPreview();
				return;
			}

			if (event.key === 'Escape') {
				onClose?.();
			}
		}}
	>
		<!-- Dialog chrome: anchored to the screen so the flip never drags it around -->
		<button
			type="button"
			class="fixed top-3 right-3 z-50 flex h-11 w-11 rotate-3 cursor-pointer items-center justify-center rounded-full border-3 border-[#2d2420] bg-[#fdfbf7] text-lg font-black text-[#2d2420] shadow-[3px_4px_0_rgba(45,36,32,0.4)] transition hover:-translate-y-0.5 hover:rotate-0 md:top-5 md:right-5"
			aria-label="Dismiss details"
			onclick={(event: MouseEvent) => {
				event.stopPropagation();
				onClose?.();
			}}
		>
			✕
		</button>

		<div
			class="relative m-auto"
			style="width: clamp(16rem, calc(100dvh - 12rem), 30rem); max-width: 100%;"
			role="presentation"
			transition:scale={{ duration: transitionDuration, start: 0.96 }}
			onclick={(event: MouseEvent) => event.stopPropagation()}
			onkeydown={(event: KeyboardEvent) => {
				if (event.key === 'Escape') {
					event.stopPropagation();
				}
			}}
		>
			<!-- The postcard -->
			<div
				class="postcard-scene"
				role="presentation"
				onpointermove={handleTiltMove}
				onpointerleave={resetTilt}
				style={`--flip-duration: ${flipDuration}ms;`}
			>
				<div
					class="postcard-tilt"
					style:transform={`rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`}
				>
					<div class="postcard" class:is-flipped={isFlipped} class:is-lifting={isLifting}>
						<!-- FRONT: the photo side -->
						<div class="postcard-face postcard-front paper-noise" inert={isFlipped}>
							<div class="postcard-stain postcard-stain-front-a" aria-hidden="true"></div>
							<div class="postcard-stain postcard-stain-front-b" aria-hidden="true"></div>
							<div class="relative">
								<span class="photo-tape photo-tape-left" aria-hidden="true"></span>
								<span class="photo-tape photo-tape-right" aria-hidden="true"></span>
								<!-- Unmounted while flipped or mid-flip: the positioned wrapper gets
								     its own compositor layer, which ignores the face's
								     backface-visibility and would ghost mirrored through the back. -->
								{#if viewer && !isFlipped && !isLifting}
									<div class="absolute top-2 right-2 z-20">
										<ArtworkSafetyActions
											{artwork}
											compact
											{viewer}
											onArtworkPatch={patchArtwork}
										/>
									</div>
								{/if}
								<div class="postcard-photo border border-[#d6cfc5]">
									<img
										class={`h-full w-full object-cover transition duration-200 ${isSensitiveBlurred ? 'scale-[1.04] blur-xl saturate-0' : ''}`}
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
								{#if artwork.rank && artwork.rank <= 3}
									<div
										class="absolute -top-3 -left-3 animate-[bob_1.8s_ease-in-out_infinite] text-4xl md:text-5xl"
									>
										{{ 1: '🥇', 2: '🥈', 3: '🥉' }[artwork.rank as 1 | 2 | 3]}
									</div>
								{/if}
							</div>

							<!-- Caption strip -->
							<div class="flex items-start gap-3 px-1 pt-3 pb-1">
								{#if artwork.artistAvatar}
									<button
										type="button"
										class="shrink-0 cursor-zoom-in rounded-full transition outline-none hover:scale-[1.05] focus-visible:ring-2 focus-visible:ring-[#4ecdc4] focus-visible:ring-offset-2"
										onclick={openAvatarPreview}
										aria-label={`Expand avatar for ${artwork.artist}`}
										data-testid="artist-avatar-trigger"
									>
										<WaxSealAvatar
											alt={artwork.artist}
											seed={artwork.id}
											size="md"
											src={artwork.artistAvatar}
										/>
									</button>
								{/if}
								<div class="min-w-0 flex-1">
									<h2 class="postcard-title truncate">{artwork.title}</h2>
									{#if artworkDate}
										<p class="postcard-meta">{artworkDate}</p>
									{/if}
									{#if forkAttribution}
										<p
											class="truncate text-[0.62rem] font-semibold tracking-[0.08em] text-[#8a6a42] uppercase"
										>
											{forkAttribution}
										</p>
									{/if}
								</div>
								<div class="flex shrink-0 flex-col items-end gap-0.5 pr-1 text-right">
									<p class="postcard-signature max-w-[10rem] truncate">by {artwork.artist}</p>
									<p class="font-['Fredoka'] text-sm font-semibold text-[#8a6c52]">
										<span class="text-base leading-none">⭐</span>
										{artwork.score}
									</p>
								</div>
							</div>
							<!-- Action row: sticker buttons, hand-applied on the card -->
							<div class="postcard-actions">
								{#if viewer}
									<GameButton variant="secondary" size="sm" onclick={() => submitVote('up')}
										>👍 {artwork.upvotes}</GameButton
									>
									<GameButton variant="danger" size="sm" onclick={() => submitVote('down')}
										>👎 {artwork.downvotes}</GameButton
									>
									<span class="postcard-actions-spacer"></span>
									<GameButton variant="primary" size="sm" onclick={goToFork}>
										<GitFork class="h-4 w-4" />
										Fork
									</GameButton>
								{:else}
									<p class="postcard-signin-note">Sign in to vote, fork, or leave a comment.</p>
									<span class="postcard-actions-spacer"></span>
								{/if}
								<GameButton
									variant="accent"
									size="sm"
									className="postcard-download"
									disabled={isDownloading}
									onclick={downloadArtwork}
								>
									<Download class="h-4 w-4" />
									<span class="sr-only">{isDownloading ? 'Downloading…' : 'Download'}</span>
								</GameButton>
							</div>
							{#if actionError && !isFlipped}
								<p class="px-2 pb-1 text-center text-xs font-semibold text-[#8f3720]">
									{actionError}
								</p>
							{/if}
							<div class="postcard-footer">
								<span class="postcard-edge-print">Not the Louvre · Gallery Post</span>
								<button
									type="button"
									class="flip-tape"
									aria-label="Read the comments"
									onclick={toggleFlip}
								>
									💬 <span class="flip-tape-count"
										>{artwork.commentCount ?? artwork.comments.length}</span
									>
									comments
									<svg
										class="doodle-arrow"
										viewBox="0 0 34 20"
										fill="none"
										stroke="currentColor"
										stroke-width="2.2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M2 15 Q 14 2 28 8" />
										<path d="M22 4.5 28 8l-6.5 4" />
									</svg>
								</button>
							</div>
						</div>

						<!-- BACK: the written side -->
						<div class="postcard-face postcard-back paper-noise" inert={!isFlipped}>
							<div class="postcard-stain postcard-stain-back" aria-hidden="true"></div>
							<div class="postcard-airmail" aria-hidden="true"></div>

							<header class="postcard-back-header">
								<span class="postcard-back-rule"></span>
								<p>Post Card</p>
								<span class="postcard-back-rule"></span>
							</header>

							<div class="postcard-back-grid">
								<!-- Correspondence: the visitor's book -->
								<div class="flex min-h-0 flex-col">
									<p class="guestbook-label">Visitor's Book</p>
									{#if artwork.comments.length > 0}
										<div
											class="guestbook-pages min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
										>
											{#each artwork.comments as comment (comment.id)}
												<p class="guestbook-entry">
													{comment.text}
													<span class="guestbook-author">— {comment.author}</span>
												</p>
											{/each}
										</div>
									{:else if isHydrating}
										<div
											class="guestbook-pages min-h-0 flex-1 overflow-hidden"
											data-testid="artwork-comments-loading"
											aria-hidden="true"
										>
											{#each [0, 1, 2] as index (index)}
												<div class="flex h-[26px] items-center">
													<div
														class="h-3 animate-pulse rounded-full bg-[#e3d5bd]"
														style={`width: ${[78, 58, 66][index]}%;`}
													></div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="guestbook-pages flex min-h-0 flex-1 items-start">
											<p class="guestbook-entry guestbook-empty">
												The visitor's book is empty — be the first to sign it.
											</p>
										</div>
									{/if}
									{#if viewer}
										<form
											class="mt-2 flex shrink-0 items-end gap-2"
											onsubmit={(event) => {
												event.preventDefault();
												submitComment();
											}}
										>
											<input
												bind:this={commentInput}
												bind:value={commentBody}
												id="artwork-comment-body"
												name="commentBody"
												type="text"
												placeholder="Write a comment"
												class="guestbook-input"
											/>
											<GameButton
												type="submit"
												variant="accent"
												size="sm"
												className="guestbook-send"
												disabled={isSubmittingComment}
												ariaLabel="Send comment"
											>
												Send
											</GameButton>
										</form>
									{/if}
									{#if actionError && isFlipped}
										<p class="pt-1 text-xs font-semibold text-[#8f3720]">{actionError}</p>
									{/if}
								</div>

								<div class="postcard-back-divider"></div>

								<!-- Address + franking -->
								<div class="flex min-h-0 flex-col">
									<div class="postcard-stamp-cluster">
										<!-- Stamp: the artwork itself -->
										<div class="postcard-stamp" aria-hidden="true">
											<img
												class={isSensitiveBlurred ? 'blur-md saturate-0' : ''}
												src={artwork.imageUrl}
												alt=""
											/>
											<span class="postcard-stamp-value">{artwork.score}★</span>
										</div>
										<!-- Postmark + cancellation lines, franked below the stamp -->
										<svg class="postcard-postmark" viewBox="0 0 220 96" aria-hidden="true">
											<defs>
												<path id="postmark-arc-top" d="M 16 48 A 32 32 0 1 1 80 48" />
												<path id="postmark-arc-bottom" d="M 19 48 A 29 29 0 1 0 77 48" />
											</defs>
											<g stroke="currentColor" fill="none" opacity="0.62">
												<circle cx="48" cy="48" r="40" stroke-width="2" />
												<circle cx="48" cy="48" r="22" stroke-width="1.2" />
												<path
													d="M86 30 q 11 -7 22 0 t 22 0 t 22 0 t 22 0 t 22 0"
													stroke-width="2.4"
												/>
												<path
													d="M86 44 q 11 -7 22 0 t 22 0 t 22 0 t 22 0 t 22 0"
													stroke-width="2.4"
												/>
												<path
													d="M86 58 q 11 -7 22 0 t 22 0 t 22 0 t 22 0 t 22 0"
													stroke-width="2.4"
												/>
												<path
													d="M86 72 q 11 -7 22 0 t 22 0 t 22 0 t 22 0 t 22 0"
													stroke-width="2.4"
												/>
											</g>
											<g fill="currentColor" opacity="0.68">
												<text class="postmark-text">
													<textPath href="#postmark-arc-top" startOffset="8%"
														>NOT THE LOUVRE</textPath
													>
												</text>
												<text class="postmark-text">
													<textPath href="#postmark-arc-bottom" startOffset="14%"
														>GALLERY POST</textPath
													>
												</text>
												<text x="48" y="46" text-anchor="middle" class="postmark-date"
													>{postmark?.day}</text
												>
												<text x="48" y="57" text-anchor="middle" class="postmark-date"
													>{postmark?.year}</text
												>
											</g>
										</svg>
									</div>

									<div class="postcard-address">
										<p class="postcard-address-line">
											<span class="postcard-address-field">To:</span> every gallery visitor
										</p>
										<p class="postcard-address-line">
											<span class="postcard-address-field">From:</span>
											{artwork.artist}
										</p>
										<p class="postcard-address-line postcard-address-blank">&nbsp;</p>
									</div>

									<div class="postcard-ink-stamps">
										<span class="postcard-ink-stamp ink-stamp-star">⭐ {artwork.score}</span>
										<span class="postcard-ink-stamp ink-stamp-forks"
											>{artwork.forkCount ?? 0} forks</span
										>
									</div>

									<div class="flex justify-end pb-1">
										<button
											type="button"
											class="flip-tape flip-tape-back"
											aria-label="Show the artwork"
											onclick={toggleFlip}
										>
											<svg
												class="doodle-arrow doodle-arrow-mirrored"
												viewBox="0 0 34 20"
												fill="none"
												stroke="currentColor"
												stroke-width="2.2"
												stroke-linecap="round"
												stroke-linejoin="round"
												aria-hidden="true"
											>
												<path d="M2 15 Q 14 2 28 8" />
												<path d="M22 4.5 28 8l-6.5 4" />
											</svg>
											🖼 the artwork
										</button>
									</div>
								</div>
							</div>

							<div class="postcard-airmail" aria-hidden="true"></div>
						</div>
					</div>
				</div>
			</div>

			{#if isAvatarPreviewOpen && artwork.artistAvatar}
				<!-- The wax seal floats free over the whole dimmed screen: no box, no
				     chrome. Fixed so it also covers the postcard's crooked corners and
				     swallows every click — outside clicks close the preview, never the
				     panel behind it. -->
				<div
					class="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
					role="dialog"
					aria-modal="true"
					aria-label={`Expanded avatar for ${artwork.artist}`}
				>
					<button
						type="button"
						class="absolute inset-0 h-full w-full cursor-zoom-out"
						aria-label="Close"
						onclick={closeAvatarPreview}
					></button>
					<div class="pointer-events-none relative flex flex-col items-center">
						<div class="flex h-80 w-80 items-center justify-center md:h-[26rem] md:w-[26rem]">
							<div class="scale-[3.6] md:scale-[4.6]">
								<WaxSealAvatar
									alt={artwork.artist}
									seed={artwork.id}
									size="xl"
									src={artwork.artistAvatar}
								/>
							</div>
						</div>
						<p class="avatar-preview-name">{artwork.artist}</p>
						<p class="avatar-preview-hint">click anywhere to close</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Floating wax-seal avatar preview: handwritten name under the seal */
	.avatar-preview-name {
		margin: 20px 0 0;
		max-width: 100%;
		overflow-wrap: anywhere;
		font-family: 'Caveat', cursive;
		font-size: 2.1rem;
		font-weight: 600;
		line-height: 1.05;
		text-align: center;
		color: #fdfbf7;
		rotate: -1.5deg;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
	}

	.avatar-preview-hint {
		margin: 8px 0 0;
		font-family: 'Caveat', cursive;
		font-size: 1.05rem;
		font-weight: 500;
		color: rgba(253, 251, 247, 0.6);
	}

	.postcard-scene {
		perspective: 1600px;
		/* the card hangs a touch crooked, like everything else on the wall */
		rotate: -0.6deg;
	}

	.postcard-tilt {
		transform-style: preserve-3d;
		transition: transform 200ms ease-out;
	}

	.postcard {
		position: relative;
		display: grid;
		transform-style: preserve-3d;
		transition: transform var(--flip-duration, 650ms) cubic-bezier(0.45, 0.05, 0.25, 1);
	}

	.postcard.is-flipped {
		transform: rotateY(180deg);
	}

	/* The card lifts slightly while it turns, like being picked up */
	.postcard.is-lifting {
		animation: postcard-lift var(--flip-duration, 650ms) ease-in-out;
	}

	@keyframes postcard-lift {
		0%,
		100% {
			scale: 1;
		}
		50% {
			scale: 1.045;
		}
	}

	/* Polaroid language: cut paper + hard offset shadow, no ink outline */
	.postcard-face {
		position: relative;
		grid-area: 1 / 1;
		/* Without an explicit minimum, the face's automatic min size is its
		 * min-content and the artwork image's natural width blows the card
		 * past the wrapper clamp (the faces keep overflow visible so the
		 * tape and stains can overhang). */
		min-width: 0;
		display: flex;
		flex-direction: column;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		border-radius: 3px;
		background-color: #f8f4ed;
		box-shadow:
			4px 6px 16px rgba(0, 0, 0, 0.32),
			1px 2px 4px rgba(0, 0, 0, 0.18);
	}

	.postcard-front {
		padding: 14px 14px 10px;
	}

	.postcard-back {
		/* Absolute so only the front sizes the card: the back gets exactly the
		 * front's box and a long visitor's book scrolls instead of growing it. */
		position: absolute;
		inset: 0;
		transform: rotateY(180deg);
		background-color: #f6efe2;
		/* airmail strips hug the corners */
		overflow: hidden;
	}

	/* Faint paint stains, like the polaroid cards carry. Radial gradients on
		* purpose — filter: blur() would get promoted to its own surface inside
		* the flip's preserve-3d context and ghost through backface-visibility. */
	.postcard-stain {
		position: absolute;
		pointer-events: none;
		border-radius: 50%;
	}

	.postcard-stain-front-a {
		width: 54px;
		height: 42px;
		right: -8px;
		bottom: 120px;
		background: radial-gradient(closest-side, rgba(74, 127, 181, 0.12), transparent 72%);
	}

	.postcard-stain-front-b {
		width: 38px;
		height: 34px;
		left: -4px;
		top: 40%;
		background: radial-gradient(closest-side, rgba(244, 196, 48, 0.16), transparent 72%);
	}

	.postcard-stain-back {
		width: 46px;
		height: 40px;
		left: 32%;
		bottom: 30px;
		background: radial-gradient(closest-side, rgba(113, 145, 127, 0.13), transparent 72%);
	}

	/* Masking tape holding the photo onto the card — same as PolaroidCard */
	.photo-tape {
		position: absolute;
		z-index: 3;
		height: 17px;
		width: 52px;
		background: rgba(255, 255, 240, 0.55);
		border: 1px solid rgba(200, 190, 170, 0.3);
		box-shadow: 0 1px 2px rgba(45, 36, 32, 0.08);
		pointer-events: none;
	}

	.photo-tape-left {
		top: -20px;
		left: 14px;
		rotate: -7deg;
	}

	.photo-tape-right {
		top: -18px;
		right: 12px;
		rotate: 9deg;
	}

	.postcard-title {
		margin: 0;
		font-family: 'Caveat', cursive;
		font-size: 1.65rem;
		font-weight: 600;
		line-height: 1.05;
		color: #2d2420;
	}

	.postcard-meta {
		margin: 2px 0 0;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	.postcard-signature {
		font-family: 'Caveat', cursive;
		font-size: 1.45rem;
		line-height: 1.1;
		color: #6b4226;
		transform: rotate(-2deg);
	}

	/* Sticker action row. GameButtons normally carry a 140px min-width;
		* here they hug their content instead. */
	.postcard-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 2px 4px;
	}

	.postcard-actions-spacer {
		flex: 1;
	}

	.postcard-actions :global(.sticker-btn) {
		min-width: 0;
		padding-inline: 12px;
	}

	/* Geometry in component CSS on purpose: the vitest client project loads no
	 * Tailwind, and the front face must keep its real height there because the
	 * absolutely positioned back face inherits its box from the front. */
	.postcard-photo {
		position: relative;
		aspect-ratio: 1;
		width: 100%;
		overflow: hidden;
	}

	/* Signed-out visitors get a pencilled note where the vote stickers go */
	.postcard-signin-note {
		margin: 0;
		align-self: center;
		max-width: 75%;
		font-family: 'Caveat', cursive;
		font-size: 1.2rem;
		font-weight: 600;
		line-height: 1.1;
		color: #8a6c52;
		rotate: -1.2deg;
	}

	.postcard-actions :global(.sticker-content) {
		padding-inline: 2px;
	}

	.postcard-actions :global(.sticker-btn.postcard-download) {
		width: 48px;
		padding-inline: 0;
	}

	.postcard-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 2px 2px;
	}

	.postcard-edge-print {
		font-family: 'Fredoka', sans-serif;
		font-size: 0.56rem;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(138, 108, 82, 0.75);
		white-space: nowrap;
	}

	/* Washi tape with writing on it — the flip affordance. It names WHY you
		* flip (the comments live on the back) and reuses the 💬 N chip language
		* of the polaroid cards. In-flow and filter-free on purpose (preserve-3d).
		* If the clip-path torn ends ever ghost through the flip, drop the
		* clip-path line — the rest survives. */
	.flip-tape {
		position: relative;
		border: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 9px 20px 9px 16px;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		white-space: nowrap;
		color: #4a3a2c;
		background:
			repeating-linear-gradient(
				115deg,
				rgba(212, 131, 74, 0.13) 0 9px,
				rgba(212, 131, 74, 0) 9px 18px
			),
			rgba(255, 248, 230, 0.94);
		box-shadow: 1px 2.5px 5px rgba(45, 36, 32, 0.22);
		rotate: -2.5deg;
		/* overhangs the card edge like real tape */
		margin-right: -6px;
		clip-path: polygon(
			1.6% 0%,
			98.4% 3%,
			96.8% 15%,
			99.6% 30%,
			97.4% 46%,
			99.8% 63%,
			97.2% 79%,
			99.2% 100%,
			2.4% 97%,
			3.6% 83%,
			0.6% 69%,
			2.8% 53%,
			0.3% 37%,
			2.6% 21%,
			0.8% 9%
		);
		transition:
			translate 150ms ease,
			box-shadow 150ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	.flip-tape:hover,
	.flip-tape:focus-visible {
		translate: 0 -2px;
		box-shadow: 2px 4px 7px rgba(45, 36, 32, 0.28);
	}

	.flip-tape:focus-visible {
		outline: 2px solid #4ecdc4;
		outline-offset: 2px;
	}

	/* generous invisible hit area */
	.flip-tape::after {
		content: '';
		position: absolute;
		inset: -8px;
	}

	.flip-tape-count {
		display: inline-grid;
		place-items: center;
		min-width: 21px;
		height: 21px;
		padding: 0 5px;
		border-radius: 9999px;
		border: 2px solid #4a3a2c;
		background: #f8f4ed;
		font-size: 0.72rem;
		font-weight: 700;
	}

	.flip-tape-back {
		rotate: 2deg;
		margin-right: 0;
		color: #3c4f42;
		background:
			repeating-linear-gradient(
				115deg,
				rgba(113, 145, 127, 0.15) 0 9px,
				rgba(113, 145, 127, 0) 9px 18px
			),
			rgba(246, 250, 244, 0.94);
	}

	.doodle-arrow {
		width: 30px;
		height: 18px;
		flex-shrink: 0;
	}

	.doodle-arrow-mirrored {
		scale: -1 1;
	}

	/* ── back face ── */
	.postcard-airmail {
		flex-shrink: 0;
		height: 9px;
		opacity: 0.8;
		background: repeating-linear-gradient(
			-45deg,
			rgba(200, 79, 79, 0.5) 0 13px,
			transparent 13px 25px,
			rgba(74, 127, 181, 0.5) 25px 38px,
			transparent 38px 50px
		);
	}

	.postcard-back-header {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 18px 8px;
	}

	.postcard-back-header p {
		margin: 0;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.45em;
		text-indent: 0.45em;
		text-transform: uppercase;
		color: #5d4e37;
	}

	.postcard-back-rule {
		flex: 1;
		height: 1px;
		background: rgba(141, 110, 78, 0.4);
	}

	.postcard-back-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) 1px minmax(0, 0.95fr);
		/* Cap the row at the available space so a long visitor's book
		 * scrolls instead of growing past the card. */
		grid-template-rows: minmax(0, 1fr);
		gap: 0 14px;
		padding: 2px 18px 12px;
	}

	.postcard-back-divider {
		background: linear-gradient(
			180deg,
			rgba(141, 110, 78, 0.1),
			rgba(141, 110, 78, 0.45) 18%,
			rgba(141, 110, 78, 0.45) 82%,
			rgba(141, 110, 78, 0.1)
		);
	}

	.guestbook-label {
		flex-shrink: 0;
		margin: 0 0 4px;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	/* Ruled guestbook: 26px line rhythm shared with the entries. The lines
		* scroll WITH the writing (background-attachment: local). */
	.guestbook-pages {
		overflow-y: auto;
		overscroll-behavior: contain;
		background-image: repeating-linear-gradient(
			transparent,
			transparent 25px,
			rgba(141, 113, 78, 0.3) 25px,
			rgba(141, 113, 78, 0.3) 26px
		);
		background-attachment: local;
	}

	.guestbook-entry {
		margin: 0;
		font-family: 'Caveat', cursive;
		font-size: 1.12rem;
		font-weight: 500;
		line-height: 26px;
		color: #3f3329;
		overflow-wrap: anywhere;
	}

	.guestbook-author {
		font-size: 0.95rem;
		color: #8a6c52;
		white-space: nowrap;
	}

	.guestbook-empty {
		color: #8a6c52;
	}

	/* writing directly on the card, not a UI pill */
	.guestbook-input {
		flex: 1;
		min-width: 0;
		border: 0;
		border-bottom: 2px solid rgba(93, 78, 55, 0.4);
		background: transparent;
		padding: 2px 2px 3px;
		font-family: 'Caveat', cursive;
		font-size: 1.15rem;
		font-weight: 600;
		color: #2d2420;
		outline: none;
	}

	.guestbook-input:focus {
		border-bottom-color: #5d4e37;
	}

	.guestbook-input::placeholder {
		color: rgba(138, 108, 82, 0.65);
	}

	/* The SEND sticker rides smaller than the action-row stickers — and it
	 * must NOT move on hover/press: inside the mirrored back face the lift
	 * transforms shift the button mid-click and real pointer clicks die. */
	.postcard :global(.sticker-btn.guestbook-send),
	.postcard :global(.sticker-btn.guestbook-send:hover),
	.postcard :global(.sticker-btn.guestbook-send:active) {
		height: 38px;
		min-height: 38px;
		min-width: 0;
		flex-shrink: 0;
		padding-inline: 13px;
		font-size: 11px;
		transform: none !important;
	}

	.postcard-stamp-cluster {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 12px;
	}

	/* perforated edge via the scalloped background trick */
	.postcard-stamp {
		position: relative;
		width: 66px;
		padding: 5px;
		rotate: 2.5deg;
		background-color: #fdfbf7;
		background-image: radial-gradient(circle at 4px 4px, rgba(0, 0, 0, 0) 2.4px, #fdfbf7 2.6px);
		background-size: 8px 8px;
		background-position: -4px -4px;
		box-shadow: 1px 2px 4px rgba(45, 36, 32, 0.22);
	}

	.postcard-stamp img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
	}

	.postcard-stamp-value {
		position: absolute;
		right: 8px;
		bottom: 8px;
		font-family: 'Fredoka', sans-serif;
		font-size: 0.55rem;
		font-weight: 700;
		color: rgba(253, 251, 247, 0.95);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
	}

	.postcard-postmark {
		width: 100%;
		height: auto;
		pointer-events: none;
		color: #4a4663;
		rotate: -3deg;
	}

	.postmark-text {
		font-family: 'Fredoka', sans-serif;
		font-size: 8.4px;
		font-weight: 600;
		letter-spacing: 1.6px;
		fill: currentColor;
	}

	.postmark-date {
		font-family: 'Fredoka', sans-serif;
		font-size: 9.5px;
		font-weight: 700;
		fill: currentColor;
	}

	.postcard-address {
		margin-block: auto;
		padding-top: 10px;
	}

	.postcard-address-line {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 6px;
		border-bottom: 1.5px dotted rgba(141, 110, 78, 0.55);
		padding: 3px 2px 1px;
		font-family: 'Caveat', cursive;
		font-size: 1.25rem;
		font-weight: 600;
		line-height: 1.3;
		color: #3f3329;
	}

	.postcard-address-field {
		font-family: 'Fredoka', sans-serif;
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	.postcard-address-blank {
		height: 34px;
	}

	.postcard-ink-stamps {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 2px 12px;
	}

	/* rubber stamps with uneven inking. If the mask ever ghosts through the
		* flip, drop the mask-image line — the rest survives. */
	.postcard-ink-stamp {
		font-family: 'Fredoka', sans-serif;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border: 2.5px solid currentColor;
		border-radius: 5px;
		padding: 4px 9px;
		opacity: 0.78;
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='40'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0.55'/%3E%3C/filter%3E%3Crect width='90' height='40' filter='url(%23m)'/%3E%3C/svg%3E");
	}

	.ink-stamp-star {
		color: #a8403a;
		rotate: -4deg;
	}

	.ink-stamp-forks {
		color: #3f5e8c;
		rotate: 2.5deg;
	}
</style>
