<script lang="ts">
	import type { AwardStyle } from '#lib/features/shared-ui/award-style.js';

	/*
	 * One of the Hall of Fame's three places, in either of its two hands: a
	 * rubber stamp in coloured ink with the Hall of Fame around its ring, or a
	 * doodle in marker, as if an artist had drawn on the wall. In the corner of
	 * a postcard it is the mark alone, without its title.
	 */
	let {
		awardStyle,
		corner = false,
		place
	}: {
		awardStyle: AwardStyle;
		corner?: boolean;
		place: 1 | 2 | 3;
	} = $props();

	const PLACES = {
		1: {
			marker: '#c98a12',
			markerInk: '#8a5a06',
			name: 'Champion, first place',
			ordinal: '1st',
			stampInk: '#a87512',
			title: 'Champion'
		},
		2: {
			marker: '#3f5a7a',
			markerInk: '#2f4560',
			name: 'Runner-up, second place',
			ordinal: '2nd',
			stampInk: '#3f5a7a',
			title: 'Runner up'
		},
		3: {
			marker: '#b5532f',
			markerInk: '#8a3e22',
			name: 'Bronze star, third place',
			ordinal: '3rd',
			stampInk: '#9b4a2a',
			title: 'Bronze star'
		}
	} as const;

	const id = $props.id();
	const award = $derived(PLACES[place]);
	const label = $derived(
		`${award.name} (${awardStyle === 'stamps' ? 'rubber stamp' : 'marker doodle'})`
	);
</script>

{#if awardStyle === 'stamps'}
	<svg
		class={`award award-stamp award-place-${place}`}
		class:award-corner={corner}
		viewBox="0 0 140 140"
		role="img"
		aria-label={label}
		style={`color: ${award.stampInk};`}
	>
		<defs>
			<path id={`${id}-ring`} d="M70 70 m -50 0 a 50 50 0 1 1 100 0 a 50 50 0 1 1 -100 0" />
			<!-- The rubber's wobble, and the paper showing through where the ink missed. -->
			<filter id={`${id}-ink`} x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.8"
					numOctaves="2"
					seed="4"
					result="wobble"
				/>
				<feDisplacementMap
					in="SourceGraphic"
					in2="wobble"
					scale="2"
					xChannelSelector="R"
					yChannelSelector="G"
					result="shifted"
				/>
				<feTurbulence
					type="fractalNoise"
					baseFrequency="1.3"
					numOctaves="1"
					seed="11"
					result="speckle"
				/>
				<feColorMatrix
					in="speckle"
					type="matrix"
					values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.6"
					result="holes"
				/>
				<feComposite in="shifted" in2="holes" operator="in" />
			</filter>
		</defs>
		<!-- The lettering is the stamp's picture; its name above says what it reads. -->
		<g
			filter={`url(#${id}-ink)`}
			fill="none"
			stroke="currentColor"
			opacity="0.95"
			aria-hidden="true"
		>
			<circle cx="70" cy="70" r="64" stroke-width="4" />
			<circle cx="70" cy="70" r="58" stroke-width="1.5" />
			<circle cx="70" cy="70" r="38" stroke-width="2.5" />
			<text class="stamp-ring" fill="currentColor" stroke="none">
				<textPath href={`#${id}-ring`}>HALL OF FAME · NOT THE LOUVRE ·</textPath>
			</text>
			<text
				class="stamp-ordinal"
				x="70"
				y={corner ? 81 : 70}
				text-anchor="middle"
				fill="currentColor"
				stroke="none">{award.ordinal}</text
			>
			{#if !corner}
				<text
					class="stamp-title"
					x="70"
					y="88"
					text-anchor="middle"
					fill="currentColor"
					stroke="none">{award.title.toUpperCase()}</text
				>
			{/if}
		</g>
	</svg>
{:else}
	<span
		class={`award award-doodle award-place-${place}`}
		class:award-corner={corner}
		role="img"
		aria-label={label}
		style={`--marker: ${award.marker}; --marker-ink: ${award.markerInk};`}
	>
		{#if place === 1}
			<svg
				class="doodle-mark"
				viewBox={corner ? '0 0 130 104' : '0 0 130 150'}
				aria-hidden="true"
				fill="none"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				{#if corner}
					<path
						d="M14 76 L20 30 L42 56 L65 14 L88 56 L110 30 L116 76 Z"
						stroke="var(--marker)"
						stroke-width="8"
						fill="rgb(246 215 122 / 0.35)"
					/>
					<path d="M18 90 C 46 84, 84 84, 112 90" stroke="var(--marker)" stroke-width="8" />
				{:else}
					<path
						d="M22 70 L28 30 L48 54 L65 18 L82 54 L102 30 L108 70 Z"
						stroke="var(--marker)"
						stroke-width="5"
					/>
					<path d="M26 82 C 50 76, 82 76, 106 82" stroke="var(--marker)" stroke-width="5" />
					<circle cx="28" cy="27" r="4" fill="#e63946" stroke="none" />
					<circle cx="65" cy="14" r="4" fill="#2a9d8f" stroke="none" />
					<circle cx="102" cy="27" r="4" fill="#e63946" stroke="none" />
					<path
						d="M8 40 l6 4 M118 40 l-6 4 M14 18 l6 6 M116 18 l-6 6"
						stroke="var(--marker)"
						stroke-width="3"
					/>
				{/if}
			</svg>
			{#if !corner}
				<span class="doodle-words doodle-words-below">#1!</span>
			{/if}
		{:else if place === 2}
			<svg
				class="doodle-mark"
				viewBox="0 0 120 120"
				aria-hidden="true"
				fill="none"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path
					d="M60 10 L70 34 L96 36 L76 52 L83 78 L60 64 L37 78 L44 52 L24 36 L50 34 Z"
					stroke="var(--marker)"
					stroke-width={corner ? 7 : 4.5}
					fill={corner ? 'rgb(170 196 226 / 0.35)' : 'none'}
				/>
			</svg>
			{#if !corner}
				<span class="doodle-words doodle-words-below doodle-tilt-right">2nd!</span>
			{/if}
		{:else}
			<span class="doodle-words doodle-words-over">3rd</span>
			<svg
				class="doodle-mark"
				viewBox="0 0 110 100"
				aria-hidden="true"
				fill="none"
				stroke-linecap="round"
			>
				<path
					d="M18 70 C 34 62, 50 76, 66 66 S 92 62, 98 68"
					stroke="var(--marker)"
					stroke-width="4.5"
				/>
				<path d="M24 82 C 44 76, 70 84, 92 78" stroke="var(--marker)" stroke-width="3" />
			</svg>
		{/if}
	</span>
{/if}

<style>
	.award {
		display: block;
		flex-shrink: 0;
		pointer-events: none;
	}

	.award-stamp {
		--award-size: 7.5rem;
		width: var(--award-size);
		height: var(--award-size);
		overflow: visible;
	}

	.award-stamp.award-place-2 {
		--award-size: 6.75rem;
	}

	.award-stamp.award-place-3 {
		--award-size: 6rem;
	}

	.award-stamp.award-corner {
		--award-size: 5.25rem;
	}

	.stamp-ring {
		font-family: var(--font-display);
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 2.4px;
	}

	.stamp-ordinal {
		font-family: var(--font-display);
		font-size: 30px;
		font-weight: 700;
	}

	.award-corner .stamp-ordinal {
		font-size: 34px;
	}

	.stamp-title {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 1.8px;
	}

	.award-doodle {
		--award-size: 7.5rem;
		--award-ratio: 130 / 150;
		position: relative;
		width: var(--award-size);
		aspect-ratio: var(--award-ratio);
	}

	.award-doodle.award-place-2 {
		--award-size: 6.75rem;
		--award-ratio: 1;
	}

	.award-doodle.award-place-3 {
		--award-size: 6.25rem;
		--award-ratio: 110 / 100;
	}

	.award-doodle.award-corner {
		--award-size: 4.5rem;
		--award-ratio: 130 / 104;
	}

	.award-doodle.award-corner.award-place-2 {
		--award-size: 3.75rem;
		--award-ratio: 1;
	}

	.award-doodle.award-corner.award-place-3 {
		--award-size: 4.5rem;
		--award-ratio: 110 / 100;
	}

	.doodle-mark {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.doodle-words {
		position: absolute;
		right: 0;
		left: 0;
		font-family: var(--font-hand);
		font-weight: 700;
		line-height: 1;
		text-align: center;
		color: var(--marker-ink);
	}

	/* Under the crown or the star, scrawled on at a slant. */
	.doodle-words-below {
		bottom: 0;
		font-size: calc(var(--award-size) * 0.36);
		rotate: -6deg;
	}

	.doodle-tilt-right {
		bottom: -0.3rem;
		rotate: 5deg;
	}

	/* Over its own underlining. */
	.doodle-words-over {
		top: 20%;
		font-size: calc(var(--award-size) * 0.4);
		rotate: -4deg;
	}
</style>
