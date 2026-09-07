<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { Download, GitFork } from 'lucide-svelte';
	import { ApiError, requestJson } from '$lib/client/api';
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import ArtworkSafetyActions from '$lib/features/artwork-presentation/components/ArtworkSafetyActions.svelte';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import { resolve } from '$app/paths';
	import NsfwImage from '$lib/features/gallery-exploration/components/NsfwImage.svelte';
	import { isArtworkBlurred } from '$lib/features/gallery-exploration/model/sensitivity';
	import { focusTrap } from '$lib/features/shared-ui/actions/focus-trap';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import type { ArtworkVoteValue } from '$lib/shared/content/votes';
	import type { Viewer } from '$lib/shared/viewer';

	/* The visitor never reads a stack trace. Codes whose server message is
	 * already written for them (moderation reasons, rate-limit countdowns) pass
	 * through; everything else is answered in the museum's own voice. */
	const PASS_THROUGH_ERROR_CODES = new Set(['INVALID_COMMENT', 'INVALID_TITLE', 'RATE_LIMITED']);

	const HOUSE_ERROR_MESSAGES: Record<string, string> = {
		BANNED_USER: 'Your gallery pass has been withdrawn.',
		FORBIDDEN: 'The attendants will not let you do that.',
		INVALID_VOTE: 'That vote was not one the ledger accepts.',
		NOT_FOUND: 'This piece has left the wall.',
		UNAUTHENTICATED: 'Sign in to interact with artworks.'
	};

	const VOTE_FAILED_MESSAGE = 'That vote did not make it onto the ledger. Please try again.';
	const COMMENT_FAILED_MESSAGE = "The visitor's book would not take that entry. Please try again.";
	const DOWNLOAD_FAILED_MESSAGE = 'Artwork could not be downloaded.';
	const ADULT_PREFERENCE_FAILED_MESSAGE = '18+ artwork preference could not be updated.';

	/* Thrown with copy that is already safe to show; anything else that reaches
	 * a catch block (a dropped connection, a parser blow-up) gets the fallback
	 * instead of leaking the browser's own wording. */
	class ActionFailure extends Error {}

	/* An API answer becomes museum copy here: its own wording only for the codes
	 * written for visitors, the house line for the codes that are not, and the
	 * fallback for everything else — a 500, an HTML error page from a proxy, or
	 * a request that never reached the API at all. */
	const toActionError = (error: unknown, fallback: string) => {
		if (error instanceof ActionFailure) return error.message;
		if (!(error instanceof ApiError) || !error.code) return fallback;
		if (PASS_THROUGH_ERROR_CODES.has(error.code)) return error.message;

		return HOUSE_ERROR_MESSAGES[error.code] ?? fallback;
	};

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
		onNotify,
		revealedArtworkIds
	}: {
		artwork: Artwork | null;
		adultContentEnabled?: boolean;
		checkTextContent?: TextContentChecker;
		isHydrating?: boolean;
		onAdultContentToggle?: (enabled: boolean) => Promise<void> | void;
		viewer?: Viewer | null;
		onArtworkChange?: (artwork: Artwork) => void;
		onArtworkPatch?: (
			artworkId: string,
			patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
		) => void;
		onClose?: () => void;
		/**
		 * Hands every transient outcome to the host page instead of the panel's
		 * own notice. The gallery owns a status region that outlives the dialog,
		 * so a failure raised on the last click is still readable after the panel
		 * closes; without this the panel keeps saying it itself.
		 */
		onNotify?: (message: string | null) => void;
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
	let avatarTriggerElement: HTMLButtonElement | undefined = $state();
	let restoreFocusTimer: ReturnType<typeof setTimeout> | undefined;

	/* One writer for the panel's transient outcomes. With a host region wired up
	 * the panel says nothing itself, so a failure is never announced twice. The
	 * clear travels too: a retry that succeeds has to retire the failure it
	 * replaces instead of leaving it up for the rest of its dismissal window. */
	const notify = (message: string | null) => {
		if (onNotify) {
			onNotify(message);
			return;
		}

		actionError = message;
	};

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

	// Show the front again whenever a different artwork opens. The component
	// itself never unmounts — only `artwork` goes null — so every piece of
	// per-card state has to be cleared here or it leaks into the next artwork:
	// a stale `isLifting` opens the new card mid-lift and hides the moderation
	// buttons behind `{#if viewer && !isFlipped && !isLifting}`.
	$effect(() => {
		void openArtworkId;
		isFlipped = false;
		isLifting = false;
		clearTimeout(liftTimer);
		liftTimer = undefined;
		cancelAnimationFrame(tiltFrame);
		tiltX = 0;
		tiltY = 0;
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

		const dialog = dialogElement;
		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		clearTimeout(restoreFocusTimer);
		dialog.focus();

		return () => {
			// The outro still paints the dialog over the page, so the card the
			// visitor came from is not there to receive focus yet. Wait it out —
			// but never steal focus back from wherever they have already gone.
			const restore = () => {
				if (!previouslyFocused || !document.body.contains(previouslyFocused)) return;

				const active = document.activeElement;
				if (active instanceof HTMLElement && active !== document.body && !dialog.contains(active)) {
					return;
				}

				previouslyFocused.focus();
			};

			const delay = prefersReducedMotion.current ? 0 : transitionDuration;

			if (delay === 0) {
				restore();
				return;
			}

			clearTimeout(restoreFocusTimer);
			restoreFocusTimer = setTimeout(restore, delay);
		};
	});

	// Escape has to work even if focus wandered to something fixed above the
	// backdrop (the ambient audio tab, the Ops link) rather than staying in the
	// dialog. The dialog's own handler still runs first and stops this one.
	$effect(() => {
		if (!openArtworkId) return;

		const handleWindowKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || event.defaultPrevented) return;
			handleEscape();
		};

		window.addEventListener('keydown', handleWindowKeydown);

		return () => {
			window.removeEventListener('keydown', handleWindowKeydown);
		};
	});

	const isAvatarPreviewOpen = $derived(avatarPreviewArtworkId === (artwork?.id ?? null));

	// Terminal states only: a screen reader should hear that something is under
	// way, not a running commentary of every skeleton frame.
	const pendingStatus = $derived(
		isSubmittingVote
			? 'Recording your vote…'
			: isSubmittingComment
				? 'Signing the visitor’s book…'
				: isDownloading
					? 'Preparing the download…'
					: isHydrating
						? 'Loading this artwork…'
						: ''
	);
	let revealedIds = $state<Set<string>>(new Set());
	$effect(() => {
		if (!revealedArtworkIds) return;
		return revealedArtworkIds.subscribe((ids) => {
			revealedIds = ids;
		});
	});
	// The one predicate every surface shares: the author always sees their own
	// piece, and a reveal made in the grid carries into the dialog.
	const isSensitiveBlurred = $derived(
		artwork
			? isArtworkBlurred(artwork, { adultContentEnabled, id: viewer?.id, revealedIds })
			: false
	);
	const forkAttribution = $derived.by(() => {
		if (!artwork?.lineage?.isFork) return null;
		if (artwork.lineage.parentStatus !== 'available' || !artwork.lineage.parent) {
			return 'Forked artwork';
		}

		return `Forked from ${artwork.lineage.parent.title} by ${artwork.lineage.parent.author.nickname}`;
	});

	/* Every caller clears the notice BEFORE this runs: clearing after it would
	 * wipe the sign-in prompt it just wrote, and a signed-out visitor would
	 * never see why nothing happened. */
	const requireViewer = () => {
		if (!viewer) {
			notify('Sign in to interact with artworks.');
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
		// The seal is a dead end for the keyboard otherwise: hand focus back to
		// the avatar that opened it.
		avatarTriggerElement?.focus();
	};

	// One Escape owner for the whole dialog — the postcard, the backdrop and the
	// window fallback all route here so a single press never closes two layers.
	const handleEscape = () => {
		if (isAvatarPreviewOpen) {
			closeAvatarPreview();
			return;
		}

		onClose?.();
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
		notify(null);

		try {
			await onAdultContentToggle(enabled);
		} catch (error) {
			notify(toActionError(error, ADULT_PREFERENCE_FAILED_MESSAGE));
		} finally {
			isUpdatingAdultContentPreference = false;
		}
	};

	const goToFork = async () => {
		if (!artwork) return;

		notify(null);
		if (!requireViewer()) return;

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
		notify(null);

		try {
			const response = await fetch(artwork.imageUrl);
			if (!response.ok) {
				throw new ActionFailure(DOWNLOAD_FAILED_MESSAGE);
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
			notify(toActionError(error, DOWNLOAD_FAILED_MESSAGE));
		} finally {
			isDownloading = false;
		}
	};

	const submitVote = async (value: ArtworkVoteValue) => {
		if (!artwork || isSubmittingVote) return;

		notify(null);
		if (!requireViewer()) return;

		isSubmittingVote = true;

		const previousArtwork = artwork;
		const method = artwork.viewerVote === value ? 'DELETE' : 'POST';
		const currentVote = artwork.viewerVote;
		const nextVote = method === 'DELETE' ? null : value;
		const upvotes = artwork.upvotes + (currentVote === 'up' ? -1 : 0) + (nextVote === 'up' ? 1 : 0);
		const downvotes =
			artwork.downvotes + (currentVote === 'down' ? -1 : 0) + (nextVote === 'down' ? 1 : 0);

		// Optimistic: the tap lands instantly; the authoritative score reconciles
		// below, or the snapshot rolls back if the server rejects the vote.
		syncArtwork({
			...previousArtwork,
			downvotes,
			score:
				previousArtwork.score +
				(upvotes - previousArtwork.upvotes) -
				(downvotes - previousArtwork.downvotes),
			upvotes,
			viewerVote: nextVote
		});

		try {
			const payload = await requestJson<{ artwork: { score: number } }>(
				`/api/artworks/${previousArtwork.id}/vote`,
				{ ...(method === 'POST' ? { json: { value } } : {}), method }
			);

			if (artwork && artwork.id === previousArtwork.id) {
				syncArtwork({ ...artwork, score: payload.artwork.score });
			}
		} catch (error) {
			syncArtwork(previousArtwork);
			notify(toActionError(error, VOTE_FAILED_MESSAGE));
		} finally {
			isSubmittingVote = false;
		}
	};

	const submitComment = async () => {
		if (!artwork || isSubmittingComment) return;

		notify(null);
		if (!requireViewer()) return;

		const body = commentBody.trim();
		if (!body) {
			notify('Comment cannot be empty.');
			return;
		}

		const moderationResult = await checkTextContent(body, 'comment');
		if (moderationResult.status !== 'allowed') {
			notify(moderationResult.message);
			return;
		}

		isSubmittingComment = true;

		try {
			const payload = await requestJson<{
				comment: {
					author: { nickname: string };
					body: string;
					createdAt?: string;
					id: string;
				};
			}>(`/api/artworks/${artwork.id}/comments`, { json: { body }, method: 'POST' });

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
			notify(toActionError(error, COMMENT_FAILED_MESSAGE));
		} finally {
			isSubmittingComment = false;
		}
	};
</script>

{#if artwork}
	<div
		bind:this={dialogElement}
		use:focusTrap={{ enabled: !isAvatarPreviewOpen }}
		class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/65 px-3 py-3 backdrop-blur-sm outline-none md:px-4 md:py-6"
		role="dialog"
		aria-modal="true"
		aria-label={`Artwork details for ${artwork.title}`}
		tabindex="-1"
		transition:fade={{ duration: transitionDuration }}
		onclick={onClose}
		onkeydown={(event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;

			event.preventDefault();
			handleEscape();
		}}
	>
		<!-- Dialog chrome: anchored to the screen so the flip never drags it around -->
		<button
			type="button"
			class="fixed top-3 right-3 z-50 flex h-11 w-11 rotate-3 cursor-pointer items-center justify-center rounded-full border-3 border-ink-warm bg-paper-bright text-lg font-black text-ink-warm shadow-[3px_4px_0_rgba(45,36,32,0.4)] transition hover:-translate-y-0.5 hover:rotate-0 md:top-5 md:right-5"
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
				if (event.key !== 'Escape') return;

				// Owned here so the backdrop handler and the window fallback never
				// close two layers on one press — and so Escape still dismisses the
				// dialog while focus sits inside the postcard.
				event.stopPropagation();
				event.preventDefault();
				handleEscape();
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
						<div class="postcard-face postcard-front paper-sheet paper-noise" inert={isFlipped}>
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
								<div class="postcard-photo border border-hairline">
									<!-- The same blur-to-sharp handoff, and the same censoring radius
									     and scrim, every grid card gets: one treatment, read from the
									     shared `--nsfw-*` tokens. The built-in badge is switched off
									     because this surface paints a richer scrim below, the one that
									     carries the "Reveal 18+ artworks" call to action. -->
									<NsfwImage
										className="postcard-photo-layer"
										src={artwork.imageUrl}
										alt={artwork.title}
										placeholder={artwork.imagePlaceholder ?? null}
										blurred={isSensitiveBlurred}
										showScrim={false}
										loading="eager"
										decoding="async"
										fetchpriority="high"
									/>
									{#if isSensitiveBlurred}
										<div
											class="postcard-photo-scrim absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-paper-bright"
										>
											<span
												class="rounded-full border-2 border-paper-bright px-3 py-1 text-xs font-black"
												>18+</span
											>
											<p class="mt-3 text-lg font-bold uppercase">Sensitive artwork</p>
											<p class="mt-2 text-sm">Reveal 18+ artworks to view this piece in full.</p>
											{#if viewer}
												<button
													type="button"
													class="mt-4 rounded-card border-3 border-paper-bright bg-[#d68a49] px-4 py-2 text-sm font-black text-ink-warm"
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
										bind:this={avatarTriggerElement}
										type="button"
										class="shrink-0 cursor-zoom-in rounded-full focus-ring transition hover:scale-[1.05]"
										onclick={openAvatarPreview}
										aria-label={`Expand avatar for ${artwork.artist}`}
										data-testid="artist-avatar-trigger"
									>
										<WaxSealAvatar
											alt={artwork.artist}
											loading="eager"
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
									<p class="font-display text-sm font-semibold text-muted-ink">
										<span class="text-base leading-none">⭐</span>
										{artwork.score}
									</p>
								</div>
							</div>
							<!-- Action row: sticker buttons, hand-applied on the card -->
							<div class="postcard-actions">
								{#if viewer}
									<!-- The variant stays constant on purpose: it seeds the sticker's
									     rotation and canvas background, so flipping it on every vote
									     would re-rotate and repaint the sticker mid-click. The viewer's
									     own vote is a persistent ring instead. -->
									<GameButton
										variant="secondary"
										size="sm"
										ariaPressed={artwork.viewerVote === 'up'}
										className={artwork.viewerVote === 'up' ? 'vote-cast' : ''}
										disabled={isSubmittingVote}
										onclick={() => submitVote('up')}>👍 {artwork.upvotes}</GameButton
									>
									<GameButton
										variant="danger"
										size="sm"
										ariaPressed={artwork.viewerVote === 'down'}
										className={artwork.viewerVote === 'down' ? 'vote-cast' : ''}
										disabled={isSubmittingVote}
										onclick={() => submitVote('down')}>👎 {artwork.downvotes}</GameButton
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
							<div class="postcard-footer">
								<span class="postcard-edge-print">Not the Louvre · Gallery Post</span>
								<button
									type="button"
									class="flip-tape focus-ring"
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
						<div class="postcard-face postcard-back paper-sheet paper-noise" inert={!isFlipped}>
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
											class="flip-tape flip-tape-back focus-ring"
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

			<!-- One notice for the whole dialog, outside the card so it neither
			     changes face with the flip nor pushes the postcard around, and
			     always in the DOM so a screen reader actually announces it. A host
			     that passes `onNotify` owns the notice instead, so nothing here
			     duplicates it — not even the reserved line. -->
			{#if !onNotify}
				<p class="postcard-notice" class:is-visible={Boolean(actionError)} role="alert">
					{actionError ?? ''}
				</p>
			{/if}
			<p class="sr-only" aria-live="polite">{pendingStatus}</p>

			{#if isAvatarPreviewOpen && artwork.artistAvatar}
				<!-- The wax seal floats free over the whole dimmed screen: no box, no
				     chrome. Fixed so it also covers the postcard's crooked corners and
				     swallows every click — outside clicks close the preview, never the
				     panel behind it.

				     No `backdrop-blur` here on purpose: this layer is a descendant of
				     the panel's own `backdrop-blur-sm` scrim, so its backdrop is the
				     already-blurred result and a second filter would blur the blur
				     (and pin one more full-viewport surface to the compositor while
				     the preview is open). The extra `bg-black/65` is all the
				     separation the seal needs. -->
				<div
					use:focusTrap={{ autoFocus: true }}
					class="fixed inset-0 z-(--z-dialog) flex items-center justify-center bg-black/65 p-4"
					role="dialog"
					aria-modal="true"
					aria-label={`Expanded avatar for ${artwork.artist}`}
					tabindex="-1"
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
									loading="eager"
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
		font-family: var(--font-hand);
		font-size: 2.1rem;
		font-weight: 600;
		line-height: 1.05;
		text-align: center;
		color: var(--color-paper-bright);
		rotate: -1.5deg;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
	}

	.avatar-preview-hint {
		margin: 8px 0 0;
		font-family: var(--font-hand);
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
		transition: transform var(--duration-ui) ease-out;
	}

	.postcard {
		position: relative;
		display: grid;
		transform-style: preserve-3d;
		transition: transform var(--flip-duration, var(--duration-flip))
			cubic-bezier(0.45, 0.05, 0.25, 1);
	}

	.postcard.is-flipped {
		transform: rotateY(180deg);
	}

	/* The card lifts slightly while it turns, like being picked up */
	.postcard.is-lifting {
		animation: postcard-lift var(--flip-duration, var(--duration-flip)) ease-in-out;
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
	/*
	 * `.paper-sheet` (utilities.css) carries the position, radius and the
	 * two-layer sheet shadow — this was the fifth copy of it. The postcard's own
	 * stock is a shade cooler than a note's, so only that stays local.
	 */
	.postcard-face {
		/*
		 * The paper grain draws with `mix-blend-mode: normal` on the postcard and
		 * only on the postcard. A non-normal blend mode forces the same grouping
		 * and flattening that `filter` does, inside a `preserve-3d` subtree with
		 * `backface-visibility: hidden` — the exact combination this file already
		 * documents as ghosting through the flip (see the two notes below). The
		 * grain is a 0.16-alpha dot pattern over a near-white stock, where
		 * multiply and normal are visually indistinguishable at rest.
		 */
		--paper-noise-blend: normal;
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
		background-color: var(--color-paper-card);
	}

	.postcard-front {
		z-index: 2;
		padding: 14px 14px 10px;
		transform: translateZ(0.1px);
	}

	.postcard.is-flipped .postcard-front {
		z-index: 1;
	}

	.postcard-back {
		/* Absolute so only the front sizes the card: the back gets exactly the
		 * front's box and a long visitor's book scrolls instead of growing it. */
		position: absolute;
		inset: 0;
		z-index: 1;
		transform: rotateY(180deg) translateZ(0.1px);
		background-color: #f6efe2;
		/* airmail strips hug the corners */
		overflow: hidden;
	}

	.postcard.is-flipped .postcard-back {
		z-index: 2;
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
		font-family: var(--font-hand);
		font-size: 1.65rem;
		font-weight: 600;
		line-height: 1.05;
		color: var(--color-ink-warm);
	}

	.postcard-meta {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 0.62rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
	}

	.postcard-signature {
		font-family: var(--font-hand);
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

	/* Same reason as the block above: the shared image component sizes itself
	 * with utility classes, so pin its box here rather than relying on them. */
	.postcard-photo :global(.postcard-photo-layer) {
		position: absolute;
		inset: 0;
	}

	/* The panel paints its own scrim because it also carries the reveal CTA, but
	 * it censors at the same strength as every other surface. */
	.postcard-photo-scrim {
		background: var(--nsfw-scrim, rgba(45, 36, 32, 0.68));
	}

	/* A single notice for the dialog. It keeps its box whether or not there is
	 * something to say, so a failed vote never shoves the postcard around. */
	.postcard-notice {
		margin: 10px 0 0;
		min-height: 1.1rem;
		text-align: center;
		font-family: var(--font-display);
		font-size: 0.8rem;
		font-weight: 600;
		color: #ffd7cb;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
		opacity: 0;
		transition: opacity 160ms ease;
	}

	.postcard-notice.is-visible {
		opacity: 1;
	}

	/* Signed-out visitors get a pencilled note where the vote stickers go */
	.postcard-signin-note {
		margin: 0;
		align-self: center;
		max-width: 75%;
		font-family: var(--font-hand);
		font-size: 1.2rem;
		font-weight: 600;
		line-height: 1.1;
		color: var(--color-muted-ink);
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
		font-family: var(--font-display);
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
		font-family: var(--font-display);
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
			translate var(--duration-fast) ease,
			box-shadow var(--duration-fast) ease;
		-webkit-tap-highlight-color: transparent;
	}

	.flip-tape:hover,
	.flip-tape:focus-visible {
		translate: 0 -2px;
		box-shadow: 2px 4px 7px rgba(45, 36, 32, 0.28);
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
		background: var(--color-paper-card);
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
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.45em;
		text-indent: 0.45em;
		text-transform: uppercase;
		color: var(--color-olive);
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
		font-family: var(--font-display);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
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
		font-family: var(--font-hand);
		font-size: 1.12rem;
		font-weight: 500;
		line-height: 26px;
		color: #3f3329;
		overflow-wrap: anywhere;
	}

	.guestbook-author {
		font-size: 0.95rem;
		color: var(--color-muted-ink);
		white-space: nowrap;
	}

	.guestbook-empty {
		color: var(--color-muted-ink);
	}

	/* writing directly on the card, not a UI pill */
	.guestbook-input {
		flex: 1;
		min-width: 0;
		border: 0;
		border-bottom: 2px solid rgba(93, 78, 55, 0.4);
		background: transparent;
		padding: 2px 2px 3px;
		font-family: var(--font-hand);
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--color-ink-warm);
		outline: none;
	}

	.guestbook-input:focus {
		border-bottom-color: var(--color-olive);
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
		/* The sticker's motion is three separate properties (transform, rotate
		 * and the standalone scale the global `button:active` press also uses),
		 * so all three have to be pinned or `transform: none` cancels none of it.
		 * `--sticker-rotate` keeps the sticker's resting tilt.
		 *
		 * No `!important` needed: every rule that would move this button lives in
		 * a cascade layer (`StickerControl` in `components`, the press feedback in
		 * `base`, Tailwind's in `utilities`) and this scoped rule is unlayered, so
		 * it outranks all of them whatever their specificity. */
		transform: none;
		rotate: var(--sticker-rotate, 0deg);
		scale: 1;
	}

	/* The side the viewer has already voted for keeps a persistent ring instead
	 * of switching sticker variant, which would re-seed the rotation. */
	.postcard-actions :global(.sticker-btn.vote-cast) {
		filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0));
	}

	.postcard-actions :global(.sticker-btn.vote-cast .sticker-content) {
		border-radius: var(--radius-pill);
		box-shadow:
			inset 0 0 0 2px rgba(45, 36, 32, 0.85),
			inset 0 2px 5px rgba(45, 36, 32, 0.28);
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
		background-color: var(--color-paper-bright);
		background-image: radial-gradient(
			circle at 4px 4px,
			rgba(0, 0, 0, 0) 2.4px,
			var(--color-paper-bright) 2.6px
		);
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
		font-family: var(--font-display);
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

	/* `geometricPrecision` used to sit on `body`, where it softened small text
	 * across every route. Here it earns its place: 8.4px glyphs with 1.6px
	 * tracking, laid along a 32px-radius `textPath`, are the one place the hinted
	 * default quantises advances and visibly bunches letters on the arc. */
	.postmark-text {
		font-family: var(--font-display);
		font-size: 8.4px;
		font-weight: 600;
		letter-spacing: 1.6px;
		fill: currentColor;
		text-rendering: geometricPrecision;
	}

	.postmark-date {
		font-family: var(--font-display);
		font-size: 9.5px;
		font-weight: 700;
		fill: currentColor;
		text-rendering: geometricPrecision;
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
		font-family: var(--font-hand);
		font-size: 1.25rem;
		font-weight: 600;
		line-height: 1.3;
		color: #3f3329;
	}

	.postcard-address-field {
		font-family: var(--font-display);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
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
		font-family: var(--font-display);
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
		color: var(--color-danger-deep);
		rotate: -4deg;
	}

	.ink-stamp-forks {
		color: #3f5e8c;
		rotate: 2.5deg;
	}
</style>
