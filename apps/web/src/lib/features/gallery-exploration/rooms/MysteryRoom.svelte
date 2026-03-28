<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';

	let {
		artwork,
		onReveal,
		onSelect
	}: {
		artwork: Artwork;
		onReveal?: () => void;
		onSelect?: (artwork: Artwork) => void;
	} = $props();

	let isSpinning = $state(false);
	let revealed = $state(false);

	const handleSpin = () => {
		if (isSpinning) return;
		isSpinning = true;
		revealed = false;

		setTimeout(() => {
			onReveal?.();
			isSpinning = false;
			revealed = true;
		}, 2000);
	};
</script>

<div class="flex min-h-[500px] flex-col items-center justify-center py-12">
	<div class="flex flex-col items-center gap-8">
		<!-- Mystery Card -->
		<div
			class="relative"
			class:animate-[spinY_2s_ease-in-out]={isSpinning}
			style="perspective: 1000px;"
		>
			<div class="h-96 w-80 rounded-2xl border-[6px] border-[#5d4e37] bg-[#fdfbf7] p-6 shadow-2xl">
				{#if !revealed || isSpinning}
					<!-- Placeholder ? card -->
					<div
						class="flex h-full w-full items-center justify-center rounded-lg border-4 border-dashed border-[#8b7355] bg-gradient-to-br from-[#e5dfd5] to-[#d4c5b5]"
					>
						<div
							class="font-display text-8xl text-[#8b7355]"
							class:animate-[pulseScale_0.5s_ease-in-out_infinite]={isSpinning}
						>
							?
						</div>
					</div>
				{:else}
					<!-- Revealed artwork -->
					<div class="relative h-full animate-[fadeScale_0.4s_ease-out]">
						<img
							src={artwork.imageUrl}
							alt={artwork.title}
							class="h-full w-full rounded-lg border-2 border-[#2d2420] object-cover"
						/>
						{#if artwork.artistAvatar}
							<div
								class="absolute -bottom-4 -left-4 h-16 w-16 animate-[popIn_0.3s_ease-out_0.3s_both] overflow-hidden rounded-full border-4 border-[#2d2420] bg-white shadow-lg"
							>
								<img src={artwork.artistAvatar} alt={artwork.artist} class="h-full w-full" />
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Spin Button -->
		<button
			type="button"
			class="font-display rounded-full border-4 border-[#2d2420] bg-[#c84f4f] px-12 py-5 text-2xl font-black text-white shadow-2xl transition duration-200 hover:scale-110 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
			disabled={isSpinning}
			onclick={handleSpin}
		>
			{isSpinning ? 'SPINNING...' : 'Spin!'}
		</button>

		<p
			class="text-center [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif] text-[#6b625a] italic"
		>
			Discover a random masterpiece from the gallery
		</p>

		<!-- Revealed Artwork Details -->
		{#if revealed && !isSpinning}
			<div
				class="max-w-md rotate-1 animate-[slideUp_0.4s_ease-out] rounded-xl border-4 border-[#2d2420] bg-[#e8b896] p-6 text-center shadow-lg"
			>
				<h3 class="font-display mb-2 text-2xl font-black text-[#2d2420]">
					{artwork.title}
				</h3>
				<p class="mb-3 [font-family:'Baloo_2',_'Trebuchet_MS',_sans-serif] text-lg text-[#6b625a]">
					by {artwork.artist}
				</p>
				<div class="flex items-center justify-center gap-4 text-[#2d2420]">
					<span class="flex items-center gap-1 font-bold">⭐ {artwork.score}</span>
					<span class="flex items-center gap-1">👍 {artwork.upvotes}</span>
				</div>
				<button
					type="button"
					class="mt-4 rounded-lg bg-[#2d2420] px-6 py-2 font-bold text-white transition duration-200 hover:scale-105"
					onclick={() => onSelect?.(artwork)}
				>
					View Details
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	@keyframes spinY {
		0% {
			transform: rotateY(0deg);
		}
		25% {
			transform: rotateY(360deg);
		}
		50% {
			transform: rotateY(720deg);
		}
		100% {
			transform: rotateY(1080deg);
		}
	}

	@keyframes pulseScale {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.2);
		}
	}

	@keyframes fadeScale {
		0% {
			opacity: 0;
			transform: scale(0.8);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes popIn {
		0% {
			transform: scale(0);
		}
		100% {
			transform: scale(1);
		}
	}

	@keyframes slideUp {
		0% {
			opacity: 0;
			transform: translateY(20px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
