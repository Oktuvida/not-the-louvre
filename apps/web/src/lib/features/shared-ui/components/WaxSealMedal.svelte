<script lang="ts">
	// A county-fair prize rosette: pleated ribbon disc, paper centre, two tails.
	const PALETTES = {
		bronze: {
			dark: '#8a5524',
			ink: '#5c3610',
			light: '#e0a06b',
			mid: '#c07a3e'
		},
		gold: {
			dark: '#a87b16',
			ink: '#6b4a0e',
			light: '#f2cf66',
			mid: '#d9a520'
		},
		silver: {
			dark: '#8e94a3',
			ink: '#4a5160',
			light: '#e7e9ee',
			mid: '#c3c8d2'
		}
	} as const;

	const SIZES = {
		large: { disc: 84, font: 30 },
		medium: { disc: 66, font: 24 },
		small: { disc: 54, font: 19 }
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
	const dimensions = $derived(SIZES[size]);
</script>

<div
	class={`rosette-wrap inline-flex ${className}`}
	aria-label={`Position ${position} medal`}
	style={`--ros-light:${palette.light};--ros-mid:${palette.mid};--ros-dark:${palette.dark};--ros-ink:${palette.ink};--ros-disc:${dimensions.disc}px;--ros-font:${dimensions.font}px;`}
>
	<div class="rosette">
		<span class="rosette-tail rosette-tail-left" aria-hidden="true"></span>
		<span class="rosette-tail rosette-tail-right" aria-hidden="true"></span>
		<div class="rosette-pleats" aria-hidden="true"></div>
		<div class="rosette-center">
			<span>{position}</span>
		</div>
	</div>
</div>

<style>
	.rosette-wrap {
		filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.28));
	}

	.rosette {
		position: relative;
		width: var(--ros-disc);
		height: var(--ros-disc);
		/* room for the tails hanging below the disc */
		margin-bottom: calc(var(--ros-disc) * 0.34);
	}

	/* pleated ribbon edge */
	.rosette-pleats {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: repeating-conic-gradient(var(--ros-mid) 0deg 15deg, var(--ros-light) 15deg 30deg);
		box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.08);
	}

	.rosette-center {
		position: absolute;
		inset: 18%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: #fdfbf7;
		border: 2.5px solid var(--ros-dark);
		box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.1);
	}

	.rosette-center span {
		font-family: 'Fredoka', sans-serif;
		font-size: var(--ros-font);
		font-weight: 700;
		line-height: 1;
		color: var(--ros-ink);
	}

	/* ribbon tails with notched ends */
	.rosette-tail {
		position: absolute;
		top: 62%;
		left: 50%;
		width: calc(var(--ros-disc) * 0.24);
		height: calc(var(--ros-disc) * 0.62);
		background: linear-gradient(180deg, var(--ros-mid), var(--ros-dark));
		clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
	}

	.rosette-tail-left {
		translate: -85% 0;
		rotate: 14deg;
	}

	.rosette-tail-right {
		translate: -15% 0;
		rotate: -14deg;
	}
</style>
