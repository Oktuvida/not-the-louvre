<script lang="ts">
	import { LogOut, Trophy, X } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import { isArtworkBlurred } from '$lib/features/gallery-exploration/model/sensitivity';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type { HomePreviewCard } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import AvatarSketchpad from '$lib/features/home-entry-scene/components/AvatarSketchpad.svelte';
	import {
		homeGalleryTarget,
		warmOnIntent
	} from '$lib/features/home-entry-scene/navigation-warmup';
	import { setAdultContentEnabled, uploadViewerAvatar } from '$lib/client/avatar-upload';
	import { buildDrawingDraftKey, clearDrawingDraft } from '$lib/features/stroke-json/drafts';
	import {
		DRAWING_DOCUMENT_VERSION,
		createEmptyDrawingDocumentV2,
		parseEditableDrawingDocumentV2
	} from '$lib/features/stroke-json/document';
	import { focusTrap } from '$lib/features/shared-ui/actions/focus-trap';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import PaperSheet from '$lib/features/shared-ui/components/PaperSheet.svelte';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import VisitorBadge from '$lib/features/shared-ui/components/VisitorBadge.svelte';
	import WashiTape from '$lib/features/shared-ui/components/WashiTape.svelte';
	import WaxSealAvatar from '$lib/features/shared-ui/components/WaxSealAvatar.svelte';
	import { dispatchAvatarFaviconUpdate } from '$lib/favicon';

	type AvatarSavedPayload = {
		avatarDrawingDocument?: import('$lib/features/stroke-json/document').DrawingDocumentV2 | null;
		avatarOnboardingCompletedAt: Date;
		avatarUrl: string;
	};

	let {
		adultContentEnabled = false,
		isExiting = false,
		onAvatarSaved,
		onGalleryNavigate,
		previewCards = [],
		user = null
	}: {
		adultContentEnabled?: boolean;
		isExiting?: boolean;
		onAvatarSaved?: (payload: AvatarSavedPayload) => void;
		onGalleryNavigate?: () => void;
		previewCards?: HomePreviewCard[];
		user?: HomeAuthUser | null;
	} = $props();

	let adultContentPreferenceOverride = $state<boolean | null>(null);
	let adultContentError = $state<string | null>(null);
	let isSavingAdultContentPreference = $state(false);
	let isAvatarEditorOpen = $state(false);

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
		if (!user || isSavingAdultContentPreference) {
			adultContentError = 'Sign in to manage 18+ artwork visibility.';
			return;
		}

		isSavingAdultContentPreference = true;
		adultContentError = null;

		try {
			await setAdultContentEnabled(enabled);
			adultContentPreferenceOverride = enabled;
		} catch (error) {
			adultContentError =
				error instanceof Error ? error.message : '18+ artwork preference could not be updated.';
		} finally {
			isSavingAdultContentPreference = false;
		}
	};

	const handleGalleryClick = () => {
		onGalleryNavigate?.();
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
				avatarDrawingDocument: parseEditableDrawingDocumentV2(drawingDocument),
				avatarOnboardingCompletedAt: new Date(),
				avatarUrl: result.avatarUrl
			});
		}

		return result;
	};
</script>

<div class="pointer-events-none absolute inset-0 z-30">
	{#if user}
		<div
			class="pointer-events-auto absolute top-4 left-4 max-w-[calc(100vw-2rem)] transition-all duration-700 ease-in md:top-8 md:left-8 md:max-w-[22rem]"
			class:-translate-x-[calc(100%+3rem)]={isExiting}
			class:opacity-0={isExiting}
			inert={isExiting}
		>
			<VisitorBadge
				avatarUrl={user.avatarUrl ?? user.image ?? null}
				nickname={user.nickname}
				onclick={openAvatarEditor}
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
		class="pointer-events-auto absolute top-4 right-4 hidden transition-all duration-700 ease-in md:top-8 md:right-8 md:block"
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
					href={resolve('/gallery/[[room]]', {})}
					class="group relative block cursor-pointer"
					style={`transform: rotate(${card.rotation}deg);`}
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
						{#if adultContentError}
							<p class="mt-2 text-xs font-semibold text-rust">{adultContentError}</p>
						{/if}
					</PostItNote>
				</div>
			{/if}
		</div>
	</div>

	<div
		class="pointer-events-auto absolute right-4 bottom-6 left-4 flex items-stretch justify-center transition-all duration-700 ease-in md:right-auto md:bottom-20 md:left-16 md:translate-x-0 md:items-start"
		class:translate-y-[calc(100%+6rem)]={isExiting}
		class:opacity-0={isExiting}
		inert={isExiting}
	>
		<div
			class="flex w-full max-w-[22rem] flex-col items-stretch gap-4 md:w-auto md:max-w-none md:items-start"
		>
			{#if user}
				<!--
					The signed-in GALLERY control is a <button>, so the body-level
					`data-sveltekit-preload-data="hover"` never reaches it — and the click
					starts 2.4s of camera choreography before `goto` runs. Warming on
					pointer/focus intent turns that hold into overlap.
				-->
				<div class="w-full md:w-auto" use:warmOnIntent={homeGalleryTarget}>
					<GameButton
						type="button"
						variant="secondary"
						size="lg"
						className="group w-full justify-center -rotate-1 hover:translate-x-[10px] hover:rotate-2 md:w-auto"
						onclick={handleGalleryClick}
					>
						<Trophy
							class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
						/>
						<span>GALLERY</span>
					</GameButton>
				</div>
			{:else}
				<GameLink
					href={galleryHref}
					variant="secondary"
					size="lg"
					className="group w-full justify-center -rotate-1 hover:translate-x-[10px] hover:rotate-2 md:w-auto"
				>
					<Trophy
						class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
					/>
					<span>GALLERY</span>
				</GameLink>
			{/if}

			{#if user}
				<form method="POST" action="?/signOut" class="w-full md:w-fit md:self-start">
					<GameButton
						type="submit"
						variant="danger"
						size="lg"
						className="group w-full justify-center rotate-1 hover:translate-x-[10px] hover:rotate-[-2deg] md:w-auto"
					>
						<LogOut
							class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
						/>
						<span>LOGOUT</span>
					</GameButton>
				</form>
			{/if}
		</div>
	</div>
</div>

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
