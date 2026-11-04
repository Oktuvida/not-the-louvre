<script lang="ts">
	import '@fontsource/playfair-display/latin-700.css';
	import '@fontsource/special-elite/latin-400.css';
	import type { Snippet } from 'svelte';

	let {
		children,
		heading,
		label,
		line,
		name,
		photo = null,
		photoAlt,
		tilt = -1.2
	}: {
		/** What goes under the rule at the foot of the label. */
		children: Snippet;
		heading: string;
		/** How the label is announced, as the region it is. */
		label: string;
		/** The printed line above the name. */
		line: string;
		name: string;
		photo?: string | null;
		photoAlt: string;
		tilt?: number;
	} = $props();
</script>

<!-- The label inside the sketchbook's cover, out on the wall: printed heading
     and border, a face in the same printed rule, the name in ink. -->
<aside class="bookplate" aria-label={label} style:--bookplate-tilt={`${tilt}deg`}>
	<span class="bookplate-tape tape" aria-hidden="true"></span>
	<p class="bookplate-heading">{heading}</p>
	{#if photo}
		<img
			class="bookplate-face"
			src={photo}
			alt={photoAlt}
			width="340"
			height="340"
			decoding="async"
		/>
	{/if}
	<p class="bookplate-line">{line}</p>
	<p class="bookplate-name">{name}</p>
	<div class="bookplate-foot">
		{@render children()}
	</div>
</aside>

<style>
	.bookplate {
		position: relative;
		width: min(21rem, 100%);
		padding: 1.15rem 1.25rem 1.1rem;
		rotate: var(--bookplate-tilt);
		background: #fbf6ea;
		box-shadow:
			0 1px 1px rgb(0 0 0 / 0.1),
			0 10px 22px rgb(40 25 10 / 0.34);
		color: #4a3524;
		text-align: center;
	}

	.bookplate::before {
		content: '';
		position: absolute;
		inset: 0.35rem;
		border: 1.5px solid #8c6a46;
		outline: 1px solid #8c6a46;
		outline-offset: -0.3rem;
		pointer-events: none;
	}

	.bookplate-tape {
		position: absolute;
		top: -0.7rem;
		left: 50%;
		width: 5rem;
		height: 1.4rem;
		translate: -50% 0;
		rotate: 2deg;
	}

	.bookplate-heading {
		margin: 0.2rem 0 0.4rem;
		font-family: 'Playfair Display', serif;
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}

	.bookplate-face {
		display: block;
		width: 8rem;
		height: 8rem;
		margin: 0.5rem auto 0.6rem;
		border: 1.5px solid #8c6a46;
		border-radius: 50%;
		outline: 1px solid #8c6a46;
		outline-offset: 3px;
		background: #fffdf9;
		object-fit: cover;
	}

	.bookplate-line {
		margin: 0;
		font-family: 'Special Elite', 'Courier New', monospace;
		font-size: 0.8rem;
		line-height: 1.3;
	}

	.bookplate-name {
		margin: 0.15rem 0 0;
		overflow-wrap: anywhere;
		color: #1f2a44;
		font-family: var(--font-hand);
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.05;
	}

	.bookplate-foot {
		position: relative;
		margin: 0.45rem 0 0;
		padding-top: 0.4rem;
		border-top: 1px dotted rgb(74 53 36 / 0.5);
		font-family: 'Special Elite', 'Courier New', monospace;
		font-size: 0.75rem;
		line-height: 1.35;
	}
</style>
