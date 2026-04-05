<script lang="ts">
	import { LogOut, Trophy, X } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import ArtworkFrame from '$lib/features/artwork-presentation/components/ArtworkFrame.svelte';
	import { resolveArtworkFrame } from '$lib/features/artwork-presentation/model/frame';
	import type { HomeAuthUser } from '$lib/features/home-entry-scene/auth-contract';
	import type { HomePreviewCard } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import AvatarSketchpad from '$lib/features/home-entry-scene/components/AvatarSketchpad.svelte';
	import { buildDrawingDraftKey, clearDrawingDraft } from '$lib/features/stroke-json/drafts';
	import {
		DRAWING_DOCUMENT_VERSION,
		createEmptyDrawingDocumentV2,
		parseEditableDrawingDocumentV2
	} from '$lib/features/stroke-json/document';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '$lib/features/shared-ui/components/GameLink.svelte';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
	import StudioPanel from '$lib/features/shared-ui/components/StudioPanel.svelte';
	import VisitorBadge from '$lib/features/shared-ui/components/VisitorBadge.svelte';
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
			const response = await fetch('/api/viewer/content-preferences', {
				body: JSON.stringify({ adultContentEnabled: enabled }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});

			if (!response.ok) {
				throw new Error('18+ artwork preference could not be updated.');
			}

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
		if (!user?.id) {
			return {
				message: 'Your session is not ready for avatar upload. Please sign in again.',
				success: false as const
			};
		}

		const formData = new FormData();
		formData.set('drawingDocument', drawingDocument);

		const response = await fetch(`/api/users/${user.id}/avatar`, {
			body: formData,
			method: 'PUT'
		});

		if (response.ok) {
			const data = (await response.json()) as { avatarUrl?: string };

			if (!data.avatarUrl) {
				return {
					message: 'Avatar save succeeded but no avatar URL was returned.',
					success: false as const
				};
			}

			dispatchAvatarFaviconUpdate(user.id);
			onAvatarSaved?.({
				avatarDrawingDocument: parseEditableDrawingDocumentV2(drawingDocument),
				avatarOnboardingCompletedAt: new Date(),
				avatarUrl: data.avatarUrl
			});
			return { success: true as const };
		}

		try {
			const data = (await response.json()) as { code?: string; message?: string };

			return {
				code: data.code,
				message: data.message ?? 'Avatar save failed. Please try again.',
				success: false as const
			};
		} catch {
			// Ignore invalid error bodies and fall back to a generic message.
		}

		return {
			message: 'Avatar save failed. Please try again.',
			success: false as const
		};
	};
</script>

<div class="pointer-events-none absolute inset-0 z-[30]">
	{#if user}
		<div
			class="pointer-events-auto absolute top-4 left-4 max-w-[calc(100vw-2rem)] transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:top-8 md:left-8 md:max-w-[22rem]"
			class:-translate-x-[calc(100%+3rem)]={isExiting}
			class:opacity-0={isExiting}
		>
			<VisitorBadge
				avatarUrl={user.avatarUrl ?? user.image ?? null}
				nickname={user.nickname}
				onclick={openAvatarEditor}
				userId={user.id}
			/>
		</div>
	{/if}

	<div
		class="pointer-events-auto absolute top-4 right-4 hidden transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:top-8 md:right-8 md:block"
		class:translate-x-[calc(100%+3rem)]={isExiting}
		class:opacity-0={isExiting}
		data-testid="home-preview-stack"
	>
		<div class="relative flex flex-col items-end gap-7 pb-[13.5rem]">
			{#each previewCards as card (card.id)}
				{@const frame = resolveArtworkFrame({ artworkId: card.id, podiumPosition: card.rank })}
				<a
					href={resolve('/gallery')}
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
									class={`h-full w-full object-cover transition duration-200 ${card.isNsfw && !adultContentAllowed ? 'scale-[1.08] blur-xl saturate-0' : ''}`}
								/>
								{#if card.isNsfw && !adultContentAllowed}
									<div
										class="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[#2d2420] bg-[rgba(45,36,32,0.68)] px-2 text-center text-[#fdfbf7]"
									>
										<span
											class="rounded-full border-2 border-[#fdfbf7] px-2 py-0.5 text-xs font-black"
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
								<WaxSealAvatar alt={card.artist} seed={card.id} size="lg" src={card.artistAvatar} />
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
								class="w-full rounded-[0.95rem] border-3 border-[#2d2420] bg-[#fff7d4] px-4 py-2 text-sm font-black text-[#2d2420] shadow-[2px_3px_0_rgba(45,36,32,0.18)] transition duration-200 hover:-translate-y-0.5 disabled:opacity-60"
								disabled={isSavingAdultContentPreference}
								onclick={() => updateAdultContentPreference(!adultContentAllowed)}
							>
								{adultContentAllowed ? 'Hide 18+ artworks' : 'Reveal 18+ artworks'}
							</button>
						{:else}
							<p class="text-xs font-semibold text-[#8f3720]">Sign in to reveal 18+ artworks.</p>
						{/if}
						{#if adultContentError}
							<p class="mt-2 text-xs font-semibold text-[#8f3720]">{adultContentError}</p>
						{/if}
					</PostItNote>
				</div>
			{/if}
		</div>
	</div>

	<div
		class="pointer-events-auto absolute right-4 bottom-6 left-4 flex items-stretch justify-center transition-all duration-700 ease-[cubic-bezier(0.4,0,1,1)] md:right-auto md:bottom-20 md:left-16 md:translate-x-0 md:items-start"
		class:translate-y-[calc(100%+6rem)]={isExiting}
		class:opacity-0={isExiting}
	>
		<div
			class="flex w-full max-w-[22rem] flex-col items-stretch gap-4 md:w-auto md:max-w-none md:items-start"
		>
			{#if user}
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

			<!-- <GameLink
			href="/gallery/mystery"
			variant="accent"
			size="lg"
			className="group rotate-1 hover:translate-x-[10px] hover:rotate-[-2deg]"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]"
			>
				<circle cx="12" cy="12" r="9" />
				<path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
				<path d="M12 17h.01" />
			</svg>
			<span>MYSTERY</span>
		</GameLink> -->

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
		onclick={closeAvatarEditor}
		onkeydown={(event) => {
			if (event.key === 'Escape') closeAvatarEditor();
		}}
	>
		<div
			role="presentation"
			class="w-full max-w-[52rem]"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<StudioPanel
				tone="paper"
				className="w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto md:max-h-[calc(100dvh-4rem)]"
			>
				<div class="p-4 md:p-8">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="font-display text-xl tracking-[0.06em] text-[var(--color-ink)] uppercase">
							Redraw your avatar
						</h2>
						<GameButton type="button" variant="ghost" size="sm" onclick={closeAvatarEditor}>
							<span class="sr-only">Close</span>
							<X />
						</GameButton>
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
			</StudioPanel>
		</div>
	</div>
{/if}
