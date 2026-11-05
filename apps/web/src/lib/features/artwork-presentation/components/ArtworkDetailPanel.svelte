<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		Clapperboard,
		Download,
		GitFork,
		MessageCircle,
		PenLine,
		ThumbsDown,
		ThumbsUp
	} from 'lucide-svelte';
	import '@fontsource/special-elite/latin-400.css';
	import { ApiError, requestJson } from '#lib/client/api.js';
	import type { Artwork } from '#lib/features/artwork-presentation/model/artwork.js';
	import ArtworkSafetyActions from '#lib/features/artwork-presentation/components/ArtworkSafetyActions.svelte';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '#lib/client/content-filter/index.js';
	import { resolve } from '$app/paths';
	import NsfwImage from '#lib/features/gallery-exploration/components/NsfwImage.svelte';
	import { isArtworkBlurred } from '#lib/features/gallery-exploration/model/sensitivity.js';
	import { focusTrap } from '#lib/features/shared-ui/actions/focus-trap.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import InkStamp from '#lib/features/shared-ui/components/InkStamp.svelte';
	import PencilNote from '#lib/features/shared-ui/components/PencilNote.svelte';
	import WaxSealAvatar from '#lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import { saveBlob } from '#lib/client/save-blob.js';
	import WishSlip from '#lib/features/shared-ui/components/WishSlip.svelte';
	import TimelapsePlayer from '#lib/features/timelapse/TimelapsePlayer.svelte';
	import { decodeDrawingV3, type InkDocument } from '#lib/stroke/v3.js';
	import type { ArtworkVoteValue } from '#lib/shared/content/votes.js';
	import type { Viewer } from '#lib/shared/viewer.js';
	import AwardMark from '#lib/features/shared-ui/components/AwardMark.svelte';
	import { hashString } from '#lib/features/artwork-presentation/model/frame.js';
	import type { AwardStyle } from '#lib/features/shared-ui/award-style.js';

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

	// What the stamp's slip says; its Try again sticker says what to do.
	const VOTE_FAILED_MESSAGE = "Your vote didn't make it onto the ledger.";
	const COMMENT_FAILED_MESSAGE = "The visitor's book didn't take your entry.";
	const DOWNLOAD_FAILED_MESSAGE = "The download didn't start. Try again in a moment.";
	const TIMELAPSE_FAILED_MESSAGE = "The timelapse wouldn't play. Try again in a moment.";
	const VIDEO_FAILED_MESSAGE = "The video didn't come out. Try again in a moment.";
	const ADULT_PREFERENCE_FAILED_MESSAGE = "Your 18+ setting didn't save. Try again in a moment.";

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

	/* A failure that doing it again can fix: the answer was not one of the
	 * API's own explanations (a 500, a proxy's error page, a dropped
	 * connection). An explanation — sign in, slow down, this piece is gone —
	 * is a notice instead: trying again would only get it again. */
	const isWorthRetrying = (error: unknown) =>
		!(error instanceof ActionFailure) &&
		!(
			error instanceof ApiError &&
			error.code &&
			(PASS_THROUGH_ERROR_CODES.has(error.code) || error.code in HOUSE_ERROR_MESSAGES)
		);

	let {
		artwork,
		adultContentEnabled = false,
		awardStyle = 'stamps',
		checkTextContent = defaultCheckTextContent,
		isHydrating = false,
		onAdultContentToggle,
		viewer = null,
		onArtworkChange,
		onArtworkPatch,
		onClose,
		onNotify,
		revealedArtworkIds

		/**
		 * Hands every transient outcome to the host page instead of the panel's
		 * own notice. The gallery owns a status region that outlives the dialog,
		 * so a failure raised on the last click is still readable after the panel
		 * closes; without this the panel keeps saying it itself.
		 */
	}: {
		artwork: Artwork | null;
		adultContentEnabled?: boolean;
		/** The award style this visit to the gallery drew, for a top-three artwork. */
		awardStyle?: AwardStyle;
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
		onNotify?: (message: string | null) => void;
		revealedArtworkIds?: import('svelte/store').Writable<Set<string>>;
	} = $props();

	let commentBody = $state('');
	/* A vote or a comment that did not save, stamped on the postcard it was
	 * for until it is tried again or put away. */
	let actionFailure = $state<{
		artworkId: string;
		label: string;
		message: string;
		retry: () => void;
	} | null>(null);
	/** Why the comment on the line was not taken, pencilled under it. */
	let commentError = $state('');
	let actionError = $state<string | null>(null);
	let avatarPreviewArtworkId = $state<string | null>(null);
	let isUpdatingAdultContentPreference = $state(false);
	let isSubmittingComment = $state(false);
	let isSubmittingVote = $state(false);
	let isDownloading = $state(false);
	// The replay shown in place of the photo, for the artwork it belongs to.
	let timelapse = $state.raw<{
		artworkId: string;
		backdropUrl: string | null;
		drawing: InkDocument;
	} | null>(null);
	let isLoadingTimelapse = $state(false);
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

	const stampFailure = (artworkId: string, message: string, retry: () => void) => {
		actionFailure = { artworkId, label: 'Not sent', message, retry };
	};

	// Another postcard opened in the same panel does not inherit the stamp.
	const visibleFailure = $derived(
		actionFailure && artwork && actionFailure.artworkId === artwork.id ? actionFailure : null
	);

	const retryFailedAction = () => {
		const retry = visibleFailure?.retry;
		actionFailure = null;
		retry?.();
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
			hung: `${date.getDate()} ${MONTH_STAMPS[date.getMonth()]} ${date.getFullYear()}`,
			year: `${date.getFullYear()}`
		};
	});
	/** The piece's number in the museum's catalogue, the same every time it is opened. */
	const catalogueNumber = $derived(
		artwork ? String(hashString(artwork.id) % 10000).padStart(4, '0') : ''
	);
	/* Each visitor signs the book in their own pen: blue-black, sepia, black,
	 * green-black or oxblood, kept by their name. */
	const GUESTBOOK_INKS = ['#2c4a7a', '#6b4423', '#2a2622', '#3d5e46', '#6a2f3f'];
	const inkFor = (author: string) => GUESTBOOK_INKS[hashString(author) % GUESTBOOK_INKS.length];
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

		await goto(resolve(`draw?fork=${artwork.id}`));
	};

	const downloadExtensions: Record<string, string> = {
		'image/avif': 'avif',
		'image/gif': 'gif',
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp'
	};

	const fileNameFor = (title: string) =>
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '') || 'artwork';

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
			saveBlob(blob, `${fileNameFor(artwork.title)}.${extension}`);
		} catch (error) {
			notify(toActionError(error, DOWNLOAD_FAILED_MESSAGE));
		} finally {
			isDownloading = false;
		}
	};

	const openTimelapse = async () => {
		if (!artwork || isLoadingTimelapse) return;

		const artworkId = artwork.id;
		isLoadingTimelapse = true;
		notify(null);

		try {
			const body = await requestJson<{ backdropUrl: string | null; drawing: unknown }>(
				`/api/artworks/${artworkId}/timelapse`
			);
			timelapse = {
				artworkId,
				backdropUrl: body.backdropUrl,
				drawing: decodeDrawingV3(body.drawing)
			};
		} catch (error) {
			notify(toActionError(error, TIMELAPSE_FAILED_MESSAGE));
		} finally {
			isLoadingTimelapse = false;
		}
	};

	const submitVote = async (value: ArtworkVoteValue) => {
		if (!artwork || isSubmittingVote) return;

		notify(null);
		actionFailure = null;
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
			if (isWorthRetrying(error)) {
				stampFailure(previousArtwork.id, VOTE_FAILED_MESSAGE, () => void submitVote(value));
			} else {
				notify(toActionError(error, VOTE_FAILED_MESSAGE));
			}
		} finally {
			isSubmittingVote = false;
		}
	};

	/* What is wrong with the comment itself belongs to its line, not to the
	 * gallery's notices: the cursor goes back there to fix it. */
	const markComment = async (message: string) => {
		commentError = message;
		await tick();
		commentInput?.focus();
	};

	const submitComment = async () => {
		if (!artwork || isSubmittingComment) return;

		notify(null);
		commentError = '';
		actionFailure = null;
		if (!requireViewer()) return;

		const body = commentBody.trim();
		if (!body) {
			void markComment('Write something first.');
			return;
		}

		const moderationResult = await checkTextContent(body, 'comment');
		if (moderationResult.status !== 'allowed') {
			void markComment(moderationResult.message);
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

			// The live copy of this comment can land before this answer does.
			if (!artwork.comments.some((comment) => comment.id === payload.comment.id)) {
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
			}
			commentBody = '';
			commentInput?.focus();
		} catch (error) {
			if (error instanceof ApiError && error.code === 'INVALID_COMMENT') {
				void markComment(error.message);
				return;
			}
			// The words stay on the line, so Try again writes the same comment.
			if (isWorthRetrying(error)) {
				stampFailure(artwork.id, COMMENT_FAILED_MESSAGE, () => void submitComment());
			} else {
				notify(toActionError(error, COMMENT_FAILED_MESSAGE));
			}
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
			class="relative isolate m-auto"
			class:postcard-with-wish={Boolean(artwork.wish)}
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
			<!-- The slip it answers, tucked behind the card: never on the drawing. -->
			{#if artwork.wish}
				<aside class="postcard-wish" aria-label="Drawn for a slip from the mailbox">
					<WishSlip
						text={artwork.wish.text}
						byline={`left by ${artwork.wish.author}`}
						tilt={-3.4}
					/>
				</aside>
			{/if}

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
						<div class="postcard-face postcard-front paper-sheet polaroid-paper" inert={isFlipped}>
							<div class="postcard-stain postcard-stain-front-a" aria-hidden="true"></div>
							<div class="postcard-stain postcard-stain-front-b" aria-hidden="true"></div>
							<div class="relative">
								<span class="photo-tape photo-tape-left tape" aria-hidden="true"></span>
								<span class="photo-tape photo-tape-right tape" aria-hidden="true"></span>
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
										blurred={isSensitiveBlurred}
										showScrim={false}
										loading="eager"
										decoding="async"
										fetchpriority="high"
									/>
									{#if timelapse && timelapse.artworkId === artwork.id && !isSensitiveBlurred}
										<div class="postcard-photo-layer">
											<TimelapsePlayer
												backdropUrl={timelapse.backdropUrl}
												drawing={timelapse.drawing}
												label={`Timelapse of ${artwork.title}`}
												onClose={() => (timelapse = null)}
												onVideoFailed={() => notify(VIDEO_FAILED_MESSAGE)}
												videoName={fileNameFor(artwork.title)}
											/>
										</div>
									{/if}
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
									<div class={`postcard-award postcard-award-${awardStyle}`}>
										<AwardMark {awardStyle} corner place={artwork.rank as 1 | 2 | 3} />
									</div>
								{/if}
							</div>

							<!-- Caption strip: written in pen, the postage stuck in the corner -->
							<div class="postcard-caption">
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
									{#if artwork.isHidden}
										<!-- Seen only by its author and moderators; nobody else can open it. -->
										<p class="postcard-pending ink-stamp">Hidden · pending review</p>
									{/if}
									{#if forkAttribution}
										<p
											class="truncate text-[0.75rem] font-semibold tracking-[0.08em] text-[#8a6a42] uppercase"
										>
											{#if artwork.lineage?.parent}
												<a
													class="postcard-lineage focus-ring"
													href={resolve('/gallery/forks/[artworkId]', {
														artworkId: artwork.lineage.parent.id
													})}
												>
													{forkAttribution}
												</a>
											{:else}
												{forkAttribution}
											{/if}
										</p>
									{/if}
									<p class="postcard-signature truncate">
										by
										<a
											class="postcard-artist focus-ring"
											href={resolve('/gallery/artist/[nickname]', { nickname: artwork.artist })}
										>
											<span class="postcard-artist-name">{artwork.artist}</span>
											<span class="postcard-artist-go">
												<span class="hidden sm:inline">see the studio</span> →
											</span>
										</a>
									</p>
								</div>
								<!-- The postage: the artwork as its own stamp, its stars the value. -->
								<div class="postcard-postage">
									<div class="postcard-stamp postcard-stamp-front">
										<img
											class={isSensitiveBlurred ? 'blur-md saturate-0' : ''}
											src={artwork.imageUrl}
											alt=""
										/>
										<span class="postcard-stamp-value">★ {artwork.score}</span>
									</div>
									<svg class="postcard-front-postmark" viewBox="0 0 92 64" aria-hidden="true">
										<g stroke="currentColor" fill="none">
											<circle cx="32" cy="32" r="24" stroke-width="2.2"></circle>
											<path
												d="M60 20 q 7 -5 14 0 t 14 0 M60 31 q 7 -5 14 0 t 14 0 M60 42 q 7 -5 14 0 t 14 0"
												stroke-width="1.8"
											></path>
										</g>
										<g fill="currentColor" class="postmark-small">
											<text x="32" y="30" text-anchor="middle">NOT THE</text>
											<text x="32" y="39" text-anchor="middle">LOUVRE</text>
										</g>
									</svg>
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
										onclick={() => submitVote('up')}
										><ThumbsUp class="vote-icon" aria-hidden="true" /><span class="sr-only"
											>Upvote</span
										>
										{artwork.upvotes}</GameButton
									>
									<GameButton
										variant="danger"
										size="sm"
										ariaPressed={artwork.viewerVote === 'down'}
										className={artwork.viewerVote === 'down' ? 'vote-cast' : ''}
										disabled={isSubmittingVote}
										onclick={() => submitVote('down')}
										><ThumbsDown class="vote-icon" aria-hidden="true" /><span class="sr-only"
											>Downvote</span
										>
										{artwork.downvotes}</GameButton
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
								{#if !isSensitiveBlurred}
									<GameButton
										variant="secondary"
										size="sm"
										className="postcard-timelapse"
										disabled={isLoadingTimelapse}
										onclick={openTimelapse}
									>
										<Clapperboard class="h-4 w-4" />
										<span class="sr-only">Watch it being drawn</span>
									</GameButton>
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
								<span class="postcard-edge-print" aria-hidden="true"
									>Not the Louvre · Gallery Post</span
								>
								<button
									type="button"
									class="flip-tape focus-ring"
									aria-label="Read the comments"
									onclick={toggleFlip}
								>
									<MessageCircle class="flip-tape-icon" aria-hidden="true" />
									<span class="flip-tape-count"
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
										<path d="M2 15 Q 14 2 28 8"></path>
										<path d="M22 4.5 28 8l-6.5 4"></path>
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
								<!-- Correspondence: the visitor's book, each visitor in their own ink -->
								<div class="guestbook">
									<p class="guestbook-label">Visitor's Book</p>
									{#if artwork.comments.length > 0}
										<div
											class="guestbook-pages min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
										>
											{#each artwork.comments as comment (comment.id)}
												<p class="guestbook-entry" style={`--entry-ink: ${inkFor(comment.author)}`}>
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
												<div class="flex h-[30px] items-center">
													<div
														class="h-3 animate-pulse rounded-full bg-[#e3d5bd]"
														style={`width: ${[78, 58, 66][index]}%;`}
													></div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="guestbook-pages guestbook-blank min-h-0 flex-1">
											<p class="guestbook-prompt">Nobody has written on the back yet.</p>
											<p class="guestbook-prompt">Be the first.</p>
											{#if viewer}
												<svg
													class="guestbook-prompt-arrow"
													viewBox="0 0 60 120"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													aria-hidden="true"
												>
													<path d="M10 4 C 44 26, 52 70, 22 112"></path>
													<path d="M14 101 22 112l11-6"></path>
												</svg>
											{/if}
										</div>
									{/if}
								</div>

								<div class="postcard-back-divider"></div>

								<!-- The postage, and the museum's catalogue card for the piece -->
								<div class="postcard-franking">
									<div class="postcard-stamp-cluster">
										<div class="postcard-stamp postcard-stamp-back" aria-hidden="true">
											<div class="postcard-stamp-picture">
												<img
													class={isSensitiveBlurred ? 'blur-md saturate-0' : ''}
													src={artwork.imageUrl}
													alt=""
												/>
												<span class="postcard-stamp-country">Not the Louvre</span>
											</div>
										</div>
										<!-- Struck half over the stamp, half on the card -->
										<svg class="postcard-postmark" viewBox="0 0 160 84" aria-hidden="true">
											<defs>
												<path id="postmark-arc-top" d="M 12 42 A 30 30 0 1 1 72 42"></path>
												<path id="postmark-arc-bottom" d="M 15 42 A 27 27 0 1 0 69 42"></path>
											</defs>
											<g stroke="currentColor" fill="none">
												<circle cx="42" cy="42" r="38" stroke-width="2"></circle>
												<circle cx="42" cy="42" r="21" stroke-width="1.2"></circle>
												<path d="M84 25 q 9 -6 18 0 t 18 0 t 18 0 t 18 0" stroke-width="2.2"></path>
												<path d="M84 37 q 9 -6 18 0 t 18 0 t 18 0 t 18 0" stroke-width="2.2"></path>
												<path d="M84 49 q 9 -6 18 0 t 18 0 t 18 0 t 18 0" stroke-width="2.2"></path>
												<path d="M84 61 q 9 -6 18 0 t 18 0 t 18 0 t 18 0" stroke-width="2.2"></path>
											</g>
											<g fill="currentColor">
												<text class="postmark-text">
													<textPath href="#postmark-arc-top" startOffset="7%"
														>NOT THE LOUVRE</textPath
													>
												</text>
												<text class="postmark-text">
													<textPath href="#postmark-arc-bottom" startOffset="14%"
														>GALLERY POST</textPath
													>
												</text>
												<text x="42" y="40" text-anchor="middle" class="postmark-date"
													>{postmark?.day}</text
												>
												<text x="42" y="51" text-anchor="middle" class="postmark-date"
													>{postmark?.year}</text
												>
											</g>
										</svg>
									</div>

									<div class="catalogue-card">
										<span class="catalogue-pin" aria-hidden="true"></span>
										<p class="catalogue-number">Catalogue No. {catalogueNumber}</p>
										<p class="catalogue-row catalogue-row-title">
											<span class="catalogue-key">Title</span>
											<span class="catalogue-hand">{artwork.title}</span>
										</p>
										<p class="catalogue-row">
											<span class="catalogue-key">Artist</span>
											<span class="catalogue-hand">{artwork.artist}</span>
										</p>
										<p class="catalogue-row">
											<span class="catalogue-key">Hung</span>
											<span class="catalogue-typed">{postmark?.hung}</span>
										</p>
										<p class="catalogue-row">
											<span class="catalogue-key">Votes</span>
											<span class="catalogue-hand catalogue-votes">
												<svg viewBox="0 0 24 24" aria-hidden="true"
													><path
														d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"
													></path></svg
												>
												{artwork.score}
											</span>
										</p>
										<p class="catalogue-row catalogue-row-last">
											{#if artwork.forkCount}
												<a
													class="catalogue-forks-link focus-ring"
													href={resolve('/gallery/forks/[artworkId]', { artworkId: artwork.id })}
												>
													<span class="catalogue-key">Forks</span>
													<span class="catalogue-hand catalogue-forks">{artwork.forkCount} →</span>
												</a>
											{:else}
												<span class="catalogue-key">Forks</span>
												<span class="catalogue-hand catalogue-forks">0</span>
											{/if}
										</p>
										{#if artwork.rank && artwork.rank <= 3}
											<span class="catalogue-honour" aria-hidden="true">Hall of Fame</span>
										{/if}
									</div>
								</div>

								{#if viewer}
									<form
										class="guestbook-form"
										onsubmit={(event) => {
											event.preventDefault();
											submitComment();
										}}
									>
										<label class="guestbook-line" for="artwork-comment-body">
											<PenLine class="guestbook-pen" aria-hidden="true" />
											<input
												bind:this={commentInput}
												bind:value={commentBody}
												aria-describedby={commentError ? 'artwork-comment-note' : undefined}
												aria-invalid={commentError ? 'true' : undefined}
												id="artwork-comment-body"
												name="commentBody"
												type="text"
												placeholder="Write on the back…"
												class="guestbook-input"
											/>
										</label>
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
										{#if commentError}
											<div class="guestbook-note">
												<PencilNote id="artwork-comment-note" message={commentError} />
											</div>
										{/if}
									</form>
								{/if}

								<div class="postcard-back-turn">
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
											<path d="M2 15 Q 14 2 28 8"></path>
											<path d="M22 4.5 28 8l-6.5 4"></path>
										</svg>
										the artwork
									</button>
								</div>
							</div>

							<div class="postcard-airmail" aria-hidden="true"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- The stamp lies over the postcard but outside the card, so it stays
			     put while the card turns over. -->
			{#if visibleFailure}
				<InkStamp
					label={visibleFailure.label}
					message={visibleFailure.message}
					onDismiss={() => (actionFailure = null)}
					onRetry={retryFailedAction}
				/>
			{/if}

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

	/* Beside the card where there is room; under it where there is not, with
	 * the room for it kept below the card. */
	.postcard-with-wish {
		--wish-room: 3.5rem;
		padding-bottom: var(--wish-room);
	}

	.postcard-wish {
		--slip-padding: 1.6rem 1.1rem 0.5rem 1.2rem;
		--slip-text: 1.38rem;
		position: absolute;
		top: calc(100% - var(--wish-room) - 1.4rem);
		right: 0.5rem;
		left: 0.5rem;
		z-index: -1;
	}

	@media (orientation: landscape) and (min-width: 64rem) {
		.postcard-with-wish {
			--wish-room: 0rem;
		}

		.postcard-wish {
			--slip-padding: 0.85rem 1.5rem 0.65rem 3.4rem;
			--slip-text: 1.7rem;
			top: 57%;
			right: auto;
			left: calc(100% - 2.75rem);
			width: max-content;
			max-width: calc(50vw - 50% - 0.5rem);
		}
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
		/* The polaroid it was on the wall, its corners yellowing the way old
		 * postcards do: the same stock and grain as the closed card. */
		background-color: var(--polaroid-paper);
		background-image:
			radial-gradient(ellipse at 100% 100%, rgb(160 120 70 / 0.16), transparent 45%),
			radial-gradient(ellipse at 0% 0%, rgb(160 120 70 / 0.1), transparent 40%),
			var(--polaroid-grain);
		background-size:
			100% 100%,
			100% 100%,
			4px 4px;
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

	/* Masking tape holding the photo onto the card — same tape as PolaroidCard */
	.photo-tape {
		position: absolute;
		z-index: 3;
		height: 18px;
		width: 56px;
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

	/* The Hall of Fame's award on a top-three postcard: a stamp pressed over
	 * the photo's bottom corner, or a doodle drawn over its top one. */
	.postcard-award {
		position: absolute;
		z-index: 5;
		pointer-events: none;
	}

	.postcard-award-stamps {
		right: -0.75rem;
		bottom: -0.75rem;
		rotate: -12deg;
	}

	.postcard-award-doodles {
		top: -1.75rem;
		left: -1rem;
		rotate: -16deg;
	}

	.postcard-pending {
		margin: 0.35rem 0 0.15rem;
		font-size: 0.62rem;
		rotate: -3deg;
	}

	/* Written in ballpoint, in the pen's navy. */
	.postcard-title {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;
		color: #1f2a44;
	}

	.postcard-meta {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
	}

	.postcard-signature {
		margin: 4px 0 0;
		font-family: var(--font-hand);
		font-size: 1.2rem;
		line-height: 1.1;
		color: #1f2a44;
	}

	.postcard-artist {
		color: inherit;
		text-decoration: none;
	}

	.postcard-lineage {
		color: inherit;
		text-decoration: underline dotted currentColor;
		text-decoration-thickness: 1.5px;
		text-underline-offset: 3px;
	}

	.catalogue-forks-link {
		display: contents;
		color: inherit;
		text-decoration: none;
	}

	.catalogue-forks-link .catalogue-forks {
		text-decoration: underline dotted currentColor;
		text-decoration-thickness: 1.5px;
		text-underline-offset: 3px;
	}

	.postcard-artist-name {
		text-decoration: underline dotted rgb(31 42 68 / 0.55);
		text-decoration-thickness: 1.5px;
		text-underline-offset: 3px;
	}

	.postcard-artist-go {
		margin-left: 0.15rem;
		color: var(--color-pencil);
		font-size: 0.85em;
		white-space: nowrap;
	}

	.postcard-caption {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px 4px 4px;
	}

	.postcard-postage {
		position: relative;
		flex-shrink: 0;
		width: 5.25rem;
		height: 5.5rem;
	}

	/* The front's stamp, smaller than the back's and stuck on a little crooked;
	 * its value, the artwork's stars, printed in the margin under the picture. */
	.postcard-stamp-front {
		position: absolute;
		top: 0;
		right: 2px;
		width: 3.75rem;
		rotate: 3deg;
	}

	.postcard-stamp-front .postcard-stamp-value {
		position: static;
		display: block;
		padding-top: 2px;
		text-align: right;
		font-size: 0.75rem;
		line-height: 1.1;
		color: #1f2a44;
		text-shadow: none;
	}

	/* The postmark struck half over the stamp, half on the card. */
	.postcard-front-postmark {
		position: absolute;
		top: 1.5rem;
		left: -1.5rem;
		width: 5.25rem;
		color: #5a3a6e;
		opacity: 0.7;
		rotate: -12deg;
		pointer-events: none;
	}

	.postmark-small {
		font-family: var(--font-display);
		font-size: 6.5px;
		font-weight: 700;
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

	.postcard-actions :global(.vote-icon) {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
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

	.postcard-actions :global(.sticker-btn.postcard-download),
	.postcard-actions :global(.sticker-btn.postcard-timelapse) {
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
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 0.56rem;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(138, 108, 82, 0.75);
		white-space: nowrap;
	}

	/* On a phone-wide card the printed line gives way to the comments tape,
	 * which would otherwise be pushed off the card's edge. */
	@media (max-width: 30rem) {
		.postcard-edge-print {
			display: none;
		}

		.postcard-footer {
			justify-content: flex-end;
		}
	}

	/* Washi tape with writing on it — the flip affordance. It names WHY you
		* flip (the comments live on the back) and reuses the comment-count chip
		* language of the polaroid cards. In-flow and filter-free on purpose (preserve-3d).
		* If the clip-path torn ends ever ghost through the flip, drop the
		* clip-path line — the rest survives. */
	.flip-tape {
		position: relative;
		flex-shrink: 0;
		border: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-height: 40px;
		padding: 0 20px 0 16px;
		font-family: var(--font-display);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		white-space: nowrap;
		color: #3d3530;
		background:
			repeating-linear-gradient(45deg, rgb(212 131 74 / 0.22) 0 6px, transparent 6px 13px),
			rgb(241 226 188 / 0.95);
		box-shadow: 1px 2.5px 5px rgba(45, 36, 32, 0.22);
		rotate: -2deg;
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
		font-size: 0.75rem;
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
		grid-template-columns: minmax(0, 1.4fr) 1px minmax(0, 1fr);
		/* Cap the first row at the available space so a long visitor's book
		 * scrolls instead of growing past the card. */
		grid-template-rows: minmax(0, 1fr) auto;
		grid-template-areas:
			'book rule card'
			'form rule turn';
		gap: 0 14px;
		padding: 2px 18px 12px;
	}

	.guestbook {
		grid-area: book;
		display: flex;
		min-height: 0;
		flex-direction: column;
	}

	.postcard-franking {
		grid-area: card;
		display: flex;
		min-height: 0;
		flex-direction: column;
	}

	.postcard-back-turn {
		grid-area: turn;
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		padding-bottom: 4px;
	}

	.postcard-back-divider {
		grid-area: rule;
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
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-muted-ink);
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
		font-size: 0.75rem;
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

	.flip-tape :global(.flip-tape-icon) {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	/* The visitor's book: each visitor writes in their own pen, straight on
	 * the card, with no ruled lines waiting below the last entry. */
	.guestbook-pages {
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.guestbook-entry {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.18rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--entry-ink, #3f3329);
		overflow-wrap: anywhere;
	}

	.guestbook-entry + .guestbook-entry {
		margin-top: 9px;
		padding-top: 9px;
		border-top: 1px dashed rgb(141 113 78 / 0.32);
	}

	.guestbook-author {
		display: block;
		text-align: right;
		font-size: 1rem;
		font-weight: 500;
	}

	.guestbook-blank {
		position: relative;
	}

	.guestbook-prompt {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.22rem;
		font-weight: 500;
		line-height: 1.35;
		color: #66574a;
	}

	/* A pencil arrow from the empty page down to the line to write on. */
	.guestbook-prompt-arrow {
		position: absolute;
		left: 30%;
		bottom: 0.25rem;
		width: 2.6rem;
		height: min(5.2rem, calc(100% - 4.8rem));
		color: #8a7660;
	}

	.guestbook-form {
		grid-area: form;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px;
		margin-top: 8px;
	}

	/* The pencil note runs under the line the comment was written on. */
	.guestbook-note {
		flex-basis: 100%;
		margin-top: -6px;
	}

	/* writing directly on the card, not a UI pill */
	.guestbook-line {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		border-bottom: 2px solid rgb(93 78 55 / 0.4);
	}

	.guestbook-line:focus-within {
		border-bottom-color: var(--color-olive);
	}

	.guestbook-line :global(.guestbook-pen) {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: #7d6a54;
	}

	.guestbook-input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 2px 2px 3px;
		font-family: var(--font-hand);
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-ink-warm);
		outline: none;
	}

	/* The postage: the artwork as a perforated stamp, and the postmark struck
	 * half over it, half on the card, its waves running across the stamp. */
	.postcard-stamp-cluster {
		position: relative;
		flex-shrink: 0;
		height: 7.4rem;
	}

	.postcard-stamp-back {
		position: absolute;
		top: 0;
		right: 4px;
		width: 5.8rem;
		padding: 6px;
	}

	.postcard-stamp-picture {
		position: relative;
		padding: 11px 4px 4px;
		border: 1px solid #ddd0ba;
		background: #fffdf8;
	}

	.postcard-stamp-country {
		position: absolute;
		inset: 2px 0 auto;
		text-align: center;
		font-family: var(--font-display);
		font-size: 6.5px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #7a5a3a;
	}

	.postcard-postmark {
		position: absolute;
		top: 3.3rem;
		left: 0;
		width: min(9.4rem, 100%);
		height: auto;
		pointer-events: none;
		color: #4a4663;
		opacity: 0.78;
		rotate: -8deg;
	}

	/* The museum's catalogue card for the piece, pinned to the postcard:
	 * typed headings, the details filled in by hand. */
	.catalogue-card {
		position: relative;
		margin-block: auto;
		padding: 0.85rem 0.75rem 0.55rem;
		border: 1px solid #d6c6ac;
		background: #fbf7ee;
		box-shadow: 0 2px 4px rgb(60 40 20 / 0.12);
		rotate: -1deg;
	}

	.catalogue-pin {
		position: absolute;
		left: 50%;
		top: -6px;
		width: 12px;
		height: 12px;
		translate: -50% 0;
		border-radius: 50%;
		background: #2a2622;
		box-shadow:
			inset 0 0 0 3.5px #fbf7ee,
			0 0 0 1px #d6c6ac;
	}

	.catalogue-number,
	.catalogue-key,
	.catalogue-typed {
		font-family: 'Special Elite', 'Courier New', monospace;
	}

	.catalogue-number {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		white-space: nowrap;
		text-transform: uppercase;
		color: #5f4f3e;
	}

	.catalogue-row {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.22rem 0;
		border-bottom: 1px dotted #b8a68c;
	}

	.catalogue-row-last {
		border-bottom: 0;
	}

	.catalogue-key {
		flex: none;
		width: 3.7rem;
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #5f4f3e;
	}

	.catalogue-hand {
		min-width: 0;
		font-family: var(--font-hand);
		font-size: 1.12rem;
		font-weight: 600;
		line-height: 1.1;
		color: #3f3329;
		/* A name breaks only when it cannot fit at all. */
		overflow-wrap: break-word;
	}

	.catalogue-typed {
		font-size: 0.78rem;
		white-space: nowrap;
		color: #3f3329;
	}

	.catalogue-votes {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: #a33a2f;
	}

	.catalogue-votes svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: currentColor;
	}

	.catalogue-forks {
		color: #3f5e8c;
	}

	/* The trophy room's rubber stamp, with uneven inking. If the mask ever
	 * ghosts through the flip, drop the mask-image line; the rest survives. */
	.catalogue-honour {
		position: absolute;
		right: -0.4rem;
		bottom: 0.8rem;
		rotate: -14deg;
		padding: 2px 8px;
		border: 2.4px solid #a33a2f;
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #a33a2f;
		opacity: 0.85;
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='40'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0.55'/%3E%3C/filter%3E%3Crect width='90' height='40' filter='url(%23m)'/%3E%3C/svg%3E");
	}

	/* On a phone-wide card the line to write on runs the card's whole width,
	 * and the catalogue card puts each heading over its entry. */
	@media (max-width: 30rem) {
		.postcard-back-grid {
			grid-template-rows: minmax(0, 1fr) auto auto;
			grid-template-areas:
				'book rule card'
				'form form form'
				'turn turn turn';
		}

		.postcard-back-turn {
			padding-top: 8px;
		}

		.catalogue-card {
			padding: 0.7rem 0.6rem 0.4rem;
		}

		.catalogue-row {
			flex-direction: column;
			gap: 0;
			padding: 0.1rem 0;
		}

		.catalogue-key {
			width: auto;
		}

		.catalogue-number {
			letter-spacing: 0;
			white-space: normal;
		}

		.postcard-stamp-cluster {
			height: 6.4rem;
		}

		.postcard-stamp-back {
			width: 4.8rem;
		}

		.postcard-stamp-country {
			font-size: 5.5px;
			letter-spacing: 0.08em;
		}

		.postcard-postmark {
			top: 2.9rem;
		}

		.guestbook-form {
			margin-top: 14px;
		}
	}
</style>
