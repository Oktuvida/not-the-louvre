<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import StudioPanel from '$lib/features/shared-ui/components/StudioPanel.svelte';

	let {
		artwork,
		onClose
	}: {
		artwork: Artwork | null;
		onClose?: () => void;
	} = $props();
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
							<img
								class="aspect-square w-full object-cover"
								src={artwork.imageUrl}
								alt={artwork.title}
							/>
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
							<GameButton variant="secondary" className="w-full justify-center"
								>👍 {artwork.upvotes}</GameButton
							>
							<GameButton variant="danger" className="w-full justify-center"
								>👎 {artwork.downvotes}</GameButton
							>
							<GameButton variant="primary" className="w-full justify-center">💬 Comment</GameButton
							>
							<GameButton variant="accent" className="w-full justify-center">📄 Fork</GameButton>
						</div>
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
