<script lang="ts">
	const PALETTES = {
		bronze: {
			gradient: 'linear-gradient(145deg, #f1c18a 0%, #cd7f32 45%, #8d4d23 100%)',
			ink: '#4d2612'
		},
		gold: {
			gradient: 'linear-gradient(145deg, #f7dd87 0%, #d4a840 45%, #8e641d 100%)',
			ink: '#533913'
		},
		silver: {
			gradient: 'linear-gradient(145deg, #f4f4f4 0%, #c0c0c0 48%, #727272 100%)',
			ink: '#2f2f2f'
		}
	} as const;

	const SIZES = {
		large: 'h-20 w-20 text-3xl',
		medium: 'h-16 w-16 text-2xl',
		small: 'h-12 w-12 text-lg'
	} as const;

	let {
		className = '',
		position,
		size = 'medium',
		tone = position === 1 ? 'gold' : position === 2 ? 'silver' : 'bronze'
	}: {
		className?: string;
		position: 1 | 2 | 3;
		size?: 'small' | 'medium' | 'large';
		tone?: 'gold' | 'silver' | 'bronze';
	} = $props();

	const palette = $derived(PALETTES[tone]);
</script>

<div class={`seal-wrap inline-flex ${className}`} aria-label={`Position ${position} medal`}>
	<div
		class={`seal relative flex items-center justify-center font-black ${SIZES[size]}`}
		style={`--seal-gradient:${palette.gradient};--seal-ink:${palette.ink};`}
	>
		<div
			class="inner absolute inset-[15%] flex items-center justify-center rounded-full border-[2px] border-white/20"
		>
			<span class="relative z-10 font-['Fredoka']">{position}</span>
		</div>
	</div>
</div>

<style>
	.seal-wrap {
		filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.28));
	}

	.seal {
		background:
			radial-gradient(circle at 30% 28%, rgba(255, 255, 255, 0.48), transparent 30%),
			var(--seal-gradient);
		clip-path: polygon(
			50% 0%,
			61% 4%,
			70% 0%,
			78% 7%,
			87% 5%,
			91% 15%,
			100% 17%,
			98% 28%,
			105% 35%,
			100% 44%,
			103% 54%,
			96% 60%,
			97% 70%,
			89% 74%,
			87% 84%,
			78% 84%,
			73% 93%,
			63% 90%,
			55% 97%,
			46% 92%,
			37% 97%,
			30% 90%,
			22% 94%,
			17% 85%,
			8% 84%,
			7% 75%,
			0% 68%,
			4% 59%,
			-2% 50%,
			3% 42%,
			-1% 33%,
			5% 26%,
			3% 17%,
			12% 13%,
			15% 4%,
			24% 3%,
			30% -3%,
			39% 3%,
			47% -2%
		);
		color: var(--seal-ink);
	}

	.inner {
		background:
			radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15), transparent 50%),
			radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.08), transparent 40%);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.24);
	}
</style>
