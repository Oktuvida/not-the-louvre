<script lang="ts">
	import { Trophy, X } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import ArtworkFrame from '#lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import { resolveArtworkFrame } from '#lib/features/artwork-presentation/model/frame.js';
	import { isArtworkBlurred } from '#lib/features/gallery-exploration/model/sensitivity.js';
	import type { HomeAuthUser } from '#lib/features/home-entry-scene/auth-contract.js';
	import type { HomePreviewCard } from '#lib/features/home-entry-scene/state/home-entry.svelte.js';
	import AvatarSketchpad from '#lib/features/home-entry-scene/components/AvatarSketchpad.svelte';
	import MailboxDialog from '#lib/features/mailbox/components/MailboxDialog.svelte';
	import MailboxStand from '#lib/features/mailbox/components/MailboxStand.svelte';
	import {
		homeGalleryTarget,
		warmOnIntent
	} from '#lib/features/home-entry-scene/navigation-warmup.js';
	import { setAdultContentEnabled, uploadViewerAvatar } from '#lib/client/avatar-upload.js';
	import { buildDrawingDraftKey, clearDrawingDraft } from '#lib/features/stroke-json/drafts.js';
	import {
		DRAWING_DOCUMENT_VERSION,
		createEmptyDrawingDocumentV2
	} from '#lib/features/stroke-json/document.js';
	import { parseEditableDrawing } from '#lib/features/stroke-json/ink-document.js';
	import { focusTrap } from '#lib/features/shared-ui/actions/focus-trap.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import InkStamp from '#lib/features/shared-ui/components/InkStamp.svelte';
	import GameLink from '#lib/features/shared-ui/components/GameLink.svelte';
	import PaperSheet from '#lib/features/shared-ui/components/PaperSheet.svelte';
	import PostItNote from '#lib/features/shared-ui/components/PostItNote.svelte';
	import VisitorPass from '#lib/features/shared-ui/components/VisitorPass.svelte';
	import WashiTape from '#lib/features/shared-ui/components/WashiTape.svelte';
	import WaxSealAvatar from '#lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import { dispatchAvatarFaviconUpdate } from '#lib/favicon.js';

	type AvatarSavedPayload = {
		avatarDrawingDocument?:
			| import('#lib/features/stroke-json/document.js').DrawingDocumentV2
			| null;
		avatarOnboardingCompletedAt: Date;
		avatarUrl: string;
	};

	let {
		adultContentEnabled = false,
		isExiting = false,
		onArtworkNavigate,
		onAvatarSaved,
		onGalleryNavigate,
		onWishTaken,
		previewCards = [],
		user = null
	}: {
		adultContentEnabled?: boolean;
		isExiting?: boolean;
		/** A best piece picked from the wall: the page walks into the gallery with it open. */
		onArtworkNavigate?: (artworkId: string) => void;
		onAvatarSaved?: (payload: AvatarSavedPayload) => void;
		onGalleryNavigate?: () => void;
		/** A slip taken from the mailbox: the walk to the studio, with the slip. */
		onWishTaken?: (wishId: string) => void;
		previewCards?: HomePreviewCard[];
		user?: HomeAuthUser | null;
	} = $props();

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	/** The 18+ choice that did not save, stamped on its note until it is tried again or put away. */
	let adultContentFailure = $state<boolean | null>(null);
	let isSavingAdultContentPreference = $state(false);
	let isAvatarEditorOpen = $state(false);
	let isMailboxOpen = $state(false);

	const adultContentAllowed = $derived(adultContentPreferenceOverride ?? adultContentEnabled);
	const hasSensitivePreview = $derived(previewCards.some((card) => card.isNsfw));
	const galleryHref = $derived(user ? ('/gallery/your-studio' as const) : ('/gallery' as const));
	const avatarDraftKey = $derived(
		user
			? buildDrawingDraftKey({
					schemaVersion:
						user.avatarDrawingDocument?.version ?? createEmptyDrawingDocumentV2('avatar').version,
					scope: 'profile',
					surface: 'avatar',
					userKey: user.id
				})
			: null
	);
	const avatarLegacyDraftKey = $derived(
		user
			? buildDrawingDraftKey({
					schemaVersion: DRAWING_DOCUMENT_VERSION,
					scope: 'profile',
					surface: 'avatar',
					userKey: user.id
				})
			: null
	);

	const updateAdultContentPreference = async (enabled: boolean) => {
		// Only an artist sees the button; a second press while one is saving waits.
		if (!user || isSavingAdultContentPreference) return;

		isSavingAdultContentPreference = true;
		adultContentFailure = null;

		try {
			await setAdultContentEnabled(enabled);
			adultContentPreferenceOverride = enabled;
		} catch {
			// What the visitor asked for, so Try again asks for it once more.
			adultContentFailure = enabled;
		} finally {
			isSavingAdultContentPreference = false;
		}
	};

	const handleGalleryClick = () => {
		onGalleryNavigate?.();
	};

	// Each best piece is a link to its own page, so it can be opened in a new
	// tab, copied or shared; a plain click walks into the gallery with it.
	const openBestPiece = (event: MouseEvent, artworkId: string) => {
		if (!onArtworkNavigate) return;
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		onArtworkNavigate(artworkId);
	};

	const openAvatarEditor = () => {
		// Where focus goes back to when the dialog closes is the trap's job now
		// (`restoreFocus` below); it also covers the case this did not, where the
		// torn-down dialog leaves focus on <body>.
		isAvatarEditorOpen = true;
	};

	const closeAvatarEditor = () => {
		if (avatarDraftKey) {
			clearDrawingDraft(avatarDraftKey);
		}
		if (avatarLegacyDraftKey) {
			clearDrawingDraft(avatarLegacyDraftKey);
		}

		isAvatarEditorOpen = false;
	};

	const saveAvatar = async (drawingDocument: string) => {
		const userId = user?.id;
		const result = await uploadViewerAvatar(userId, drawingDocument);

		if (result.success && userId) {
			dispatchAvatarFaviconUpdate(userId);
			onAvatarSaved?.({
				avatarDrawingDocument: parseEditableDrawing(drawingDocument),
				avatarOnboardingCompletedAt: new Date(),
				avatarUrl: result.avatarUrl
			});
		}

		return result;
	};
</script>

<div class="pointer-events-none absolute inset-0 z-30">
	{#if user}
		<!-- The visitor's own corner: who they are, and the way out. Its size and
		     place come from HomeEntryPage, which keeps room for it above the window. -->
		<div
			class="home-account pointer-events-auto absolute flex items-start gap-3 transition-[translate,opacity] duration-700 ease-in"
			class:-translate-x-[calc(100%+3rem)]={isExiting}
			class:opacity-0={isExiting}
			inert={isExiting}
		>
			<VisitorPass
				avatarUrl={user.avatarUrl ?? user.image ?? null}
				nickname={user.nickname}
				onEdit={openAvatarEditor}
				userId={user.id}
			/>
		</div>
	{/if}

	<!--
		inert, not pointer-events-none: both are plain utilities, so which one wins
		depends on Tailwind's generated source order. inert also drops the fading
		layer out of the tab order and the a11y tree while it leaves.
	-->
	<div
		class="home-previews pointer-events-auto absolute top-8 right-8 transition-[translate,opacity] duration-700 ease-in"
		class:translate-x-[calc(100%+3rem)]={isExiting}
		class:opacity-0={isExiting}
		data-testid="home-preview-stack"
		inert={isExiting}
	>
		<div class="relative flex flex-col items-end gap-7 pb-[13.5rem]">
			{#each previewCards as card (card.id)}
				{@const frame = resolveArtworkFrame({ artworkId: card.id, podiumPosition: card.rank })}
				{@const blurred = isArtworkBlurred(card, { adultContentEnabled: adultContentAllowed })}
				<a
					href={resolve('/artwork/[artworkId]', { artworkId: card.id })}
					class="group relative block cursor-pointer"
					style={`transform: rotate(${card.rotation}deg);`}
					onclick={(event) => openBestPiece(event, card.id)}
				>
					<div
						class="relative transition-all duration-200 group-hover:-translate-x-[10px] group-hover:scale-110 group-hover:rotate-0"
					>
						<ArtworkFrame
							{frame}
							className="h-36 w-36 md:h-40 md:w-40"
							testId={`home-preview-frame-${card.rank}`}
						>
							<div class="relative h-full w-full">
								<img
									src={card.imageUrl}
									alt={card.title}
									decoding="async"
									class="h-full w-full object-cover transition duration-200"
									class:nsfw-blurred={blurred}
								/>
								{#if blurred}
									<div
										class="nsfw-scrim absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-ink-warm px-2 text-center text-paper-bright"
									>
										<span
											class="rounded-full border-2 border-paper-bright px-2 py-0.5 text-xs font-black"
											>18+</span
										>
										<span class="mt-2 max-w-[5rem] text-[0.7rem] font-semibold uppercase"
											>Sensitive preview</span
										>
									</div>
								{/if}
							</div>
						</ArtworkFrame>
						{#if card.artistAvatar}
							<div class="absolute -bottom-3 -left-3">
								<WaxSealAvatar
									alt={card.artist}
									loading="eager"
									seed={card.id}
									size="lg"
									src={card.artistAvatar}
								/>
							</div>
						{/if}
					</div>
				</a>
			{/each}

			{#if hasSensitivePreview}
				<div class="absolute right-[-0.5rem] bottom-0 z-10 w-[17.5rem] max-w-[calc(100vw-3rem)]">
					<PostItNote
						attachment="tape"
						className="pointer-events-auto"
						color="linear-gradient(160deg, #fef49c 0%, #f1df77 100%)"
						label="18+ artworks"
						seedKey="home-sensitive-preview"
						text={adultContentAllowed
							? 'Sensitive previews are visible on this account.'
							: 'Sensitive previews stay blurred until you opt in.'}
					>
						{#if user}
							<button
								type="button"
								class="w-full rounded-card border-3 border-ink-warm bg-[#fff7d4] px-4 py-2 text-sm font-black text-ink-warm shadow-[2px_3px_0_rgba(45,36,32,0.18)] transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
								disabled={isSavingAdultContentPreference}
								onclick={() => updateAdultContentPreference(!adultContentAllowed)}
							>
								{adultContentAllowed ? 'Hide 18+ artworks' : 'Reveal 18+ artworks'}
							</button>
						{:else}
							<p class="text-xs font-semibold text-rust">Sign in to reveal 18+ artworks.</p>
						{/if}
					</PostItNote>
					{#if adultContentFailure !== null}
						{@const wanted = adultContentFailure}
						<InkStamp
							label="Not saved"
							message="Your 18+ setting didn't save."
							onDismiss={() => (adultContentFailure = null)}
							onRetry={() => void updateAdultContentPreference(wanted)}
						/>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div
		class="home-nav pointer-events-auto absolute flex transition-[translate,opacity] duration-700 ease-in"
		class:translate-y-[calc(100%+6rem)]={isExiting}
		class:opacity-0={isExiting}
		inert={isExiting}
	>
		<div
			class="relative flex w-full flex-col items-stretch gap-4 landscape:w-auto landscape:items-start"
		>
			{#if user}
				<!--
					The signed-in GALLERY control is a <button>, so the body-level
					`data-sveltekit-preload-data="hover"` never reaches it — and the click
					starts 2.4s of camera choreography before `goto` runs. Warming on
					pointer/focus intent turns that hold into overlap.
				-->
				<div
					class="home-gallery relative z-1 w-full landscape:w-auto"
					use:warmOnIntent={homeGalleryTarget}
				>
					<GameButton
						type="button"
						variant="secondary"
						size="lg"
						className="group w-full justify-center -rotate-1 hover:translate-x-[10px] hover:rotate-2 landscape:w-auto"
						onclick={handleGalleryClick}
					>
						<Trophy
							class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
						/>
						<span>GALLERY</span>
					</GameButton>
				</div>
				<MailboxStand onOpen={() => (isMailboxOpen = true)} />
			{:else}
				<GameLink
					href={galleryHref}
					variant="secondary"
					size="lg"
					className="group w-full justify-center -rotate-1 hover:translate-x-[10px] hover:rotate-2 landscape:w-auto"
				>
					<Trophy
						class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
					/>
					<span>GALLERY</span>
				</GameLink>
			{/if}
		</div>
	</div>
</div>

{#if isMailboxOpen}
	<MailboxDialog
		onClose={() => (isMailboxOpen = false)}
		onTake={(wish) => {
			isMailboxOpen = false;
			onWishTaken?.(wish.id);
		}}
	/>
{/if}

{#if isAvatarEditorOpen && user}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-3 py-3 backdrop-blur-sm md:px-4 md:py-8"
		role="dialog"
		aria-modal="true"
		aria-label="Edit your avatar"
		tabindex="-1"
		use:focusTrap={{ autoFocus: true, restoreFocus: true }}
		onclick={closeAvatarEditor}
		onkeydown={(event) => {
			if (event.key === 'Escape') closeAvatarEditor();
		}}
	>
		<!--
			The sheet swallows the events the backdrop closes on — but not Escape,
			which is the dialog's own exit and is handled above. Focus starts inside
			this wrapper (the trap's `autoFocus` lands on the close tape), so a blanket
			`stopPropagation` here meant the key never reached the handler at all.
		-->
		<div
			role="presentation"
			class="w-full max-w-[52rem]"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => {
				if (e.key !== 'Escape') e.stopPropagation();
			}}
		>
			<PaperSheet
				class="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto md:max-h-[calc(100dvh-4rem)]"
				grain={false}
			>
				<div class="avatar-sheet-inner paper-grain relative p-4 pl-9 md:p-8 md:pl-12">
					<div class="mb-3 flex items-start justify-between gap-4">
						<div>
							<h2 class="avatar-sheet-title">Redraw your avatar</h2>
							<span class="paint-swipe avatar-sheet-swipe" aria-hidden="true"></span>
						</div>
						<WashiTape onclick={closeAvatarEditor}>
							<span class="sr-only">Close</span>
							<X aria-hidden="true" />
						</WashiTape>
					</div>
					<AvatarSketchpad
						clearMode="blank"
						draftUserKey={user.id}
						initialDrawingDocument={user.avatarDrawingDocument ?? null}
						nickname={user.nickname}
						{saveAvatar}
						onContinue={closeAvatarEditor}
						submitLabel="Done"
					/>
				</div>
			</PaperSheet>
		</div>
	</div>
{/if}

<style>
	/*
	 * One NSFW treatment for the whole museum: the blur radius and the scrim
	 * live in `routes/layout.css` as --nsfw-*, and the fallbacks here are the
	 * same values NsfwImage carries, so the preview stack can never drift into
	 * a fourth alpha again.
	 */
	.nsfw-blurred {
		scale: 1.08;
		filter: blur(var(--nsfw-blur, 20px)) saturate(0);
	}

	.nsfw-scrim {
		background: var(--nsfw-scrim, rgba(45, 36, 32, 0.68));
	}

	/*
	 * Where the front door's pieces stand on each screen; MuseumWallOverlay
	 * lays the window out around them, so the two must change together.
	 */

	/* The visitor's corner, at the top left, its size set by HomeEntryPage:
	 * Logout under the badge on a screen on its side, beside it on an upright
	 * one, where the title sits under the corner (HomeHeroOverlay). */
	.home-account {
		top: var(--account-top, 1rem);
		left: var(--account-top, 1rem);
		flex-direction: column;
		font-size: var(--account-em, 1rem);
	}

	@media (orientation: portrait) {
		.home-account {
			flex-direction: row;
		}
	}

	/* The best pieces hang down the right only where there is room for them
	 * beside the window: a wide screen, on its side, at least 40rem tall. */
	.home-previews {
		display: none;
	}

	@media (orientation: landscape) and (min-width: 48rem) and (min-height: 40rem) {
		.home-previews {
			display: block;
		}
	}

	/* Gallery: at the bottom left beside Come In on a screen on its side; under
	 * the window on an upright one, clear of the audio tab in the corner. */
	@media (orientation: landscape) {
		.home-nav {
			bottom: 2rem;
			left: 2rem;
		}
	}

	@media (orientation: landscape) and (max-height: 30rem) {
		.home-nav {
			bottom: 1rem;
			left: 1rem;
		}
	}

	@media (orientation: portrait) {
		.home-nav {
			right: 8.5rem;
			bottom: 1rem;
			left: 1rem;
		}
	}

	@media (orientation: portrait) and (min-width: 43.75rem) {
		.home-nav {
			right: auto;
			width: 22rem;
		}
	}

	/* torn-out spiral perforations along the left edge */
	.avatar-sheet-inner::after {
		content: '';
		position: absolute;
		top: 18px;
		bottom: 18px;
		left: 10px;
		width: 14px;
		background-image: radial-gradient(
			circle at 7px 9px,
			rgba(45, 36, 32, 0.18) 4px,
			rgba(45, 36, 32, 0.07) 4.6px,
			transparent 5.4px
		);
		background-size: 14px 44px;
		background-repeat: repeat-y;
		pointer-events: none;
	}

	.avatar-sheet-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink);
	}

	/* How long and how crooked this swipe is; the paint is `.paint-swipe`. */
	.avatar-sheet-swipe {
		width: 150px;
		height: 7px;
		margin-top: 4px;
		rotate: -0.8deg;
	}
</style>
