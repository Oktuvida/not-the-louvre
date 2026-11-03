<script lang="ts">
	import { House, Paintbrush } from 'lucide-svelte';
	import GameLink from '#lib/features/shared-ui/components/GameLink.svelte';
	import { museumWallPatternAssetUrl } from '#lib/features/shared-ui/generated-art.js';
	import { page } from '$app/state';

	let props: { status?: number } = $props();

	const status = $derived(props.status ?? page.status ?? 500);

	/*
	 * A page with nothing to show is a gap on the gallery wall: an empty frame
	 * and the museum's label beside it, saying in the house voice why nothing
	 * hangs there and where to go instead. The label is chosen by status, never
	 * from the error's own message: that is written for the logs ("Not Found",
	 * "Authenticated session is missing its product user profile"), not for a
	 * visitor.
	 */
	type MuseumLabel = { kicker: string; meta: string; text: string };

	const labelFor = (code: number): MuseumLabel => {
		if (code === 404) {
			return {
				kicker: 'Not on display',
				meta: 'Artist unknown · an empty frame',
				text: 'This piece was moved, sold, or never painted. The rest of the museum is right where you left it.'
			};
		}

		if (code === 401 || code === 403) {
			return {
				kicker: 'Staff only',
				meta: 'Behind the velvet rope',
				text: 'This room is not open to visitors. The rest of the museum is, so come back through the front door.'
			};
		}

		if (code === 429) {
			return {
				kicker: 'One moment, please',
				meta: 'A queue at the door',
				text: 'The attendants asked everyone to slow down a little. Wait a moment, then try again.'
			};
		}

		return {
			kicker: 'Closed for repairs',
			meta: 'Work in progress',
			text: 'Something fell off the wall behind the scenes. Give it a moment, then try again.'
		};
	};

	const label = $derived(labelFor(status));
</script>

<main
	class="error-wall"
	style={`background-image: url('${museumWallPatternAssetUrl}');`}
	aria-labelledby="museum-label-room"
>
	<div class="error-spotlight" aria-hidden="true"></div>

	<div class="error-hang">
		<!-- The frame is empty: the wall shows through where the piece should be. -->
		<div class="empty-frame" aria-hidden="true">
			<span class="empty-frame-hook"></span>
			<div class="empty-frame-inside"></div>
		</div>

		<article class="museum-label">
			<h1 id="museum-label-room" class="museum-label-room">Room {status}</h1>
			<p class="museum-label-kicker">{label.kicker}</p>
			<p class="museum-label-meta">{label.meta}</p>
			<p class="museum-label-text">{label.text}</p>

			<div class="museum-label-ways">
				<GameLink href="/" variant="primary" size="md" className="rotate-1">
					<House class="mr-2 h-5 w-5" />
					<span>Go Home</span>
				</GameLink>
				<GameLink href="/draw" variant="secondary" size="md" className="-rotate-1">
					<Paintbrush class="mr-2 h-5 w-5" />
					<span>Start Drawing</span>
				</GameLink>
			</div>
		</article>
	</div>
</main>

<style>
	/* The gallery's own brick wall, at the tile size the rooms use. */
	.error-wall {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 100dvh;
		padding: 2rem 1rem 6rem;
		overflow: hidden;
		background-color: var(--color-wall);
		background-repeat: repeat;
		background-size: 512px 512px;
	}

	/* A gallery lamp on the spot where the piece should hang. */
	.error-spotlight {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(48% 42% at 50% 40%, rgb(255 244 220 / 0.32), transparent 70%),
			radial-gradient(circle at center, transparent 45%, rgb(12 9 7 / 0.22) 100%);
	}

	.error-hang {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 2.5rem;
	}

	/* A plain wooden frame with nothing in it, hung from a hook. */
	.empty-frame {
		position: relative;
		width: clamp(9rem, 24vw, 14rem);
		aspect-ratio: 3 / 4;
		padding: 0.85rem;
		background: #6b4128;
		box-shadow:
			inset 0 0 0 0.2rem #8a5a34,
			inset 0 0 0 0.55rem #5a3520,
			0 0.75rem 1.5rem rgb(30 15 5 / 0.35);
		rotate: -1.5deg;
	}

	.empty-frame-hook {
		position: absolute;
		top: -1.4rem;
		left: 50%;
		width: 0.7rem;
		height: 0.7rem;
		translate: -50% 0;
		border-radius: 50%;
		background: #4a3a2c;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.4);
	}

	.empty-frame-inside {
		height: 100%;
		background-color: var(--color-wall);
		box-shadow: inset 0 0.3rem 0.8rem rgb(0 0 0 / 0.35);
	}

	/* The museum's wall label: a small white card in a clean sans. */
	.museum-label {
		width: min(22rem, 100%);
		padding: 1.4rem 1.5rem 1.3rem;
		background: var(--color-paper-bright);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.25),
			0 0.75rem 1.5rem rgb(30 15 5 / 0.28);
		color: var(--color-ink-warm);
		rotate: 0.6deg;
	}

	.museum-label-room {
		margin: 0;
		font-family: var(--font-body);
		font-size: clamp(2.2rem, 6vw, 3rem);
		font-weight: 800;
		line-height: 1;
	}

	.museum-label-kicker {
		margin: 0.5rem 0 0;
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.museum-label-meta {
		margin: 0.2rem 0 0;
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-style: italic;
		color: var(--color-muted-ink);
	}

	.museum-label-text {
		margin: 0.85rem 0 0;
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.4;
		color: var(--color-note-ink);
		text-wrap: pretty;
	}

	.museum-label-ways {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.2rem;
	}
</style>
