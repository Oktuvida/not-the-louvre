<script lang="ts">
	import { LogOut, UserRound } from 'lucide-svelte';
	import { hashString } from '#lib/features/artwork-presentation/model/frame.js';

	/*
	 * The artist's visitor pass, taped up in the corner of the front door: their
	 * avatar and name on it, a serial number, and a stub along the perforation.
	 * Tapping the pass opens the avatar editor; tearing off the stub signs out.
	 *
	 * The paper is a masked layer under each button rather than the buttons
	 * themselves, so the notches can be cut without cutting off the focus ring.
	 */

	// The ink each pass is printed in: dark enough to read on its paper.
	const PASS_INKS = ['#b5473c', '#3f6a96', '#3d7a4f', '#8f5a2c', '#6f5596'] as const;

	let {
		avatarUrl = null,
		nickname,
		onEdit,
		userId
	}: {
		avatarUrl?: string | null;
		nickname: string;
		onEdit: () => void;
		userId: string;
	} = $props();

	const seed = $derived(hashString(userId));
	const ink = $derived(PASS_INKS[seed % PASS_INKS.length]!);
	const rotation = $derived((seed % 5) - 2);
	const serial = $derived(`Nº ${String(seed % 10000).padStart(4, '0')}`);

	let imageFailed = $state(false);
	let torn = $state(false);

	// A new avatar gets a new chance to load.
	$effect(() => {
		void avatarUrl;
		imageFailed = false;
	});

	// The stub tears away before the form goes; under reduced motion, or a
	// second press, it simply goes.
	const tearOff = (event: SubmitEvent) => {
		const form = event.currentTarget as HTMLFormElement;
		if (torn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		event.preventDefault();
		torn = true;
		window.setTimeout(() => form.submit(), 320);
	};
</script>

<div class="visitor-pass" style={`--pass-rotate: ${rotation}deg; --pass-ink: ${ink};`}>
	<span class="pass-tape tape" aria-hidden="true"></span>

	<button
		type="button"
		class="pass-body focus-ring"
		aria-label={`Edit avatar for ${nickname}`}
		onclick={onEdit}
	>
		<span class="pass-paper pass-paper-body" aria-hidden="true"></span>
		<span class="pass-head" aria-hidden="true">
			<span class="pass-dot"></span>
			<span>Visitor pass</span>
			<span class="pass-serial">{serial}</span>
		</span>
		<span class="pass-who">
			<span class="pass-avatar">
				{#if avatarUrl && !imageFailed}
					<img
						src={avatarUrl}
						alt=""
						onerror={() => {
							imageFailed = true;
						}}
					/>
				{:else}
					<UserRound class="pass-avatar-empty" />
				{/if}
			</span>
			<span class="pass-name-block">
				<span class="pass-name">{nickname}</span>
				<span class="pass-admit" aria-hidden="true">Admit one artist</span>
			</span>
		</span>
	</button>

	<form method="POST" action="?/signOut" class="pass-stub-form" onsubmit={tearOff}>
		<button type="submit" class="pass-stub focus-ring" class:is-torn={torn}>
			<span class="pass-paper pass-paper-stub" aria-hidden="true"></span>
			<LogOut class="pass-stub-icon" aria-hidden="true" />
			<span class="pass-stub-word">Leave</span>
			<span class="pass-stub-serial" aria-hidden="true">{serial}</span>
		</button>
	</form>
</div>

<style>
	/*
	 * Drawn in em throughout: the pass is as big as the text around it, so the
	 * front door can show it smaller where room is short and larger on a big
	 * screen. The tilt is the standalone `rotate`, so presses compose with it.
	 */
	.visitor-pass {
		--notch: 0.62em;
		--pass-height: 8.2em;
		position: relative;
		display: flex;
		rotate: var(--pass-rotate, 0deg);
		filter: drop-shadow(0 0.45em 0.55em rgb(40 25 10 / 0.3))
			drop-shadow(0 1px 1px rgb(40 25 10 / 0.22));
	}

	.pass-tape {
		position: absolute;
		top: -0.62em;
		left: 38%;
		z-index: 3;
		width: 4.2em;
		height: 1.25em;
		rotate: -3deg;
		pointer-events: none;
	}

	.pass-body,
	.pass-stub {
		position: relative;
		height: var(--pass-height);
		border: 0;
		background: none;
		color: var(--color-ink-warm);
		text-align: left;
		cursor: pointer;
	}

	/* The ticket stock: polaroid paper, a band of the pass's ink along the top. */
	.pass-paper {
		position: absolute;
		inset: 0;
		background-color: #fbf8f2;
		background-image:
			linear-gradient(var(--pass-ink), var(--pass-ink)),
			radial-gradient(rgb(107 90 69 / 0.08) 1px, transparent 1px);
		background-size:
			100% 0.3em,
			4px 4px;
		background-repeat: no-repeat, repeat;
	}

	/* The perforation's punched notches, cut at the top and bottom. */
	.pass-paper-body {
		mask:
			radial-gradient(circle var(--notch) at 100% 0, transparent 98%, #000) top / 100% 51% no-repeat,
			radial-gradient(circle var(--notch) at 100% 100%, transparent 98%, #000) bottom / 100% 51%
				no-repeat;
	}

	.pass-paper-stub {
		background-image:
			linear-gradient(var(--pass-ink), var(--pass-ink)),
			repeating-linear-gradient(180deg, rgb(107 90 69 / 0.5) 0 0.32em, transparent 0.32em 0.62em),
			radial-gradient(rgb(107 90 69 / 0.08) 1px, transparent 1px);
		background-size:
			100% 0.3em,
			2px calc(100% - 2 * var(--notch) - 0.4em),
			4px 4px;
		background-position:
			0 0,
			0 calc(var(--notch) + 0.2em),
			0 0;
		background-repeat: no-repeat, no-repeat, repeat;
		mask:
			radial-gradient(circle var(--notch) at 0 0, transparent 98%, #000) top / 100% 51% no-repeat,
			radial-gradient(circle var(--notch) at 0 100%, transparent 98%, #000) bottom / 100% 51%
				no-repeat;
	}

	.pass-body {
		--focus-ring-offset: 3px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 15em;
		padding: 0.95em 1em 0.9em;
		transition: translate 180ms ease;
	}

	.pass-body:hover {
		translate: 0 -1px;
	}

	.pass-head {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.45em;
		font-family: var(--font-display);
		font-size: 0.7em;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--pass-ink);
	}

	.pass-dot {
		width: 0.7em;
		height: 0.7em;
		border-radius: 50%;
		background: var(--pass-ink);
	}

	.pass-serial {
		margin-left: auto;
		letter-spacing: 0.1em;
		color: rgb(45 36 32 / 0.55);
	}

	.pass-who {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.8em;
		min-width: 0;
	}

	.pass-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5em;
		height: 3.5em;
		flex-shrink: 0;
		overflow: hidden;
		border: 0.19em solid var(--color-ink-warm);
		border-radius: 50%;
		background: #f5f0e1;
	}

	.pass-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pass-avatar :global(.pass-avatar-empty) {
		width: 1.8em;
		height: 1.8em;
		color: var(--color-muted-ink);
	}

	.pass-name-block {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.pass-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-hand);
		font-size: 1.8em;
		font-weight: 700;
		line-height: 1;
	}

	.pass-admit {
		margin-top: 0.35em;
		font-family: var(--font-display);
		font-size: 0.66em;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(45 36 32 / 0.62);
	}

	/* The stub: Leave, and the serial repeated down its side, as on a ticket. */
	.pass-stub-form {
		margin-left: -1px;
	}

	.pass-stub {
		--focus-ring-offset: 3px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35em;
		width: 4.6em;
		color: #b5473c;
		transform-origin: 0 100%;
		rotate: 2deg;
		transition:
			rotate 260ms cubic-bezier(0.3, 1.4, 0.5, 1),
			translate 320ms ease-in,
			opacity 320ms ease-in;
	}

	.pass-stub:hover,
	.pass-stub:focus-visible {
		rotate: 8deg;
	}

	/* Torn off: it drops away before the visitor leaves. */
	.pass-stub.is-torn {
		rotate: 26deg;
		translate: 0.8em 1.6em;
		opacity: 0;
	}

	.pass-stub :global(.pass-stub-icon) {
		position: relative;
		width: 1.45em;
		height: 1.45em;
	}

	.pass-stub-word {
		position: relative;
		font-family: var(--font-display);
		/* Never under 12px: the word names the button. */
		font-size: max(1.05em, 12px);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.pass-stub-serial {
		position: absolute;
		right: 0.35em;
		bottom: 0.55em;
		font-family: var(--font-display);
		font-size: 0.55em;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: rgb(45 36 32 / 0.45);
		writing-mode: vertical-rl;
		rotate: 180deg;
	}

	@media (prefers-reduced-motion: reduce) {
		.pass-stub {
			transition: none;
		}
	}
</style>
