<script lang="ts">
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import {
		createClient,
		type RealtimeChannel,
		type RealtimePostgresChangesPayload
	} from '@supabase/supabase-js';
	import type { ActionData, PageData } from './$types';

	type SubscriptionState = 'idle' | 'connecting' | 'subscribed' | 'errored' | 'closed';
	type VoteRow = {
		artwork_id: string;
		id: string;
		value: 'down' | 'up';
	};
	type ArtworkDetailResponse = {
		artwork?: {
			score?: number;
		} | null;
	};

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let trackedScore = $state(0);
	let subscriptionState = $state<SubscriptionState>('idle');
	let subscriptionError = $state('');
	let actionError = $state('');
	let actionPending = $state(false);
	let actionStatus = $state('');
	let eventLog = $state<string[]>([]);
	let currentArtworkId = $state<string | null>(null);
	let cleanupRealtime: (() => void) | null = null;
	let reconciliationIntervalId: number | null = null;

	const pushEvent = (message: string) => {
		eventLog = [message, ...eventLog].slice(0, 6);
	};

	const getVoteArtworkId = (candidate: unknown) => {
		if (
			typeof candidate === 'object' &&
			candidate !== null &&
			'artwork_id' in candidate &&
			typeof candidate.artwork_id === 'string'
		) {
			return candidate.artwork_id;
		}

		return null;
	};

	const getPayloadArtworkId = (payload: RealtimePostgresChangesPayload<VoteRow>) =>
		getVoteArtworkId(payload.new) ?? getVoteArtworkId(payload.old) ?? null;

	const isTrackedVoteEvent = (
		payload: RealtimePostgresChangesPayload<VoteRow>,
		artworkId: string
	) => getPayloadArtworkId(payload) === artworkId;

	const stopScoreReconciliation = () => {
		if (reconciliationIntervalId !== null) {
			window.clearInterval(reconciliationIntervalId);
			reconciliationIntervalId = null;
		}
	};

	const reconcileTrackedScore = (nextScore: number) => {
		if (nextScore === trackedScore) {
			return;
		}

		pushEvent(
			nextScore > trackedScore
				? 'Vote event: up from realtime'
				: 'Vote event: removed from realtime'
		);
		trackedScore = nextScore;
	};

	const reconcileTrackedArtworkScore = async (artworkId: string) => {
		const response = await fetch(`/api/artworks/${artworkId}`, {
			headers: { accept: 'application/json' }
		});

		if (!response.ok) {
			return;
		}

		const payload = (await response.json()) as ArtworkDetailResponse;
		const nextScore = payload.artwork?.score;

		if (typeof nextScore === 'number') {
			reconcileTrackedScore(nextScore);
		}
	};

	const applyRealtimePayload = (
		payload: RealtimePostgresChangesPayload<VoteRow>,
		artworkId: string
	) => {
		if (!isTrackedVoteEvent(payload, artworkId)) {
			return;
		}

		void reconcileTrackedArtworkScore(artworkId);
	};

	const stopRealtime = () => {
		stopScoreReconciliation();
		cleanupRealtime?.();
		cleanupRealtime = null;
	};

	const startRealtime = async (artworkId: string) => {
		stopRealtime();
		trackedScore = data.trackedArtwork?.score ?? 0;
		subscriptionError = '';
		eventLog = [];

		if (!data.realtimeConfig.url || !data.realtimeConfig.anonKey) {
			subscriptionState = 'errored';
			subscriptionError = 'Realtime demo is missing Supabase browser configuration';
			return;
		}

		subscriptionState = 'connecting';

		const tokenResponse = await fetch('/api/realtime/token', {
			headers: { accept: 'application/json' }
		});

		if (!tokenResponse.ok) {
			subscriptionState = 'errored';
			subscriptionError = 'Realtime token request failed';
			return;
		}

		const { token } = (await tokenResponse.json()) as { token: string };
		const supabase = createClient(data.realtimeConfig.url, data.realtimeConfig.anonKey, {
			auth: {
				autoRefreshToken: false,
				detectSessionInUrl: false,
				persistSession: false
			}
		});
		await supabase.realtime.setAuth(token);

		const channel: RealtimeChannel = supabase
			.channel(`artwork-votes:${artworkId}:${data.user.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'app',
					table: 'artwork_vote_realtime'
				},
				(payload) =>
					applyRealtimePayload(payload as RealtimePostgresChangesPayload<VoteRow>, artworkId)
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					subscriptionState = 'subscribed';
					pushEvent('Realtime status: subscribed');
					void reconcileTrackedArtworkScore(artworkId);
					stopScoreReconciliation();
					reconciliationIntervalId = window.setInterval(() => {
						void reconcileTrackedArtworkScore(artworkId);
					}, 1000);
					return;
				}

				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					subscriptionState = 'errored';
					subscriptionError = 'Realtime subscription failed';
					return;
				}

				if (status === 'CLOSED') {
					subscriptionState = 'closed';
				}
			});

		cleanupRealtime = () => {
			void supabase.removeChannel(channel);
			void supabase.realtime.disconnect();
		};
	};

	const mutateVote = async (mode: 'remove' | 'up') => {
		if (!data.trackedArtwork?.id) {
			return;
		}

		actionPending = true;
		actionError = '';
		actionStatus = '';

		const response = await fetch(`/api/artworks/${data.trackedArtwork.id}/vote`, {
			body: mode === 'up' ? JSON.stringify({ value: 'up' }) : undefined,
			headers: mode === 'up' ? { 'content-type': 'application/json' } : undefined,
			method: mode === 'up' ? 'POST' : 'DELETE'
		});

		actionPending = false;

		if (!response.ok) {
			const payload = (await response.json()) as { message?: string };
			actionError = payload.message ?? 'Vote action failed';
			return;
		}

		actionStatus =
			mode === 'up' ? 'Vote action requested: upvote' : 'Vote action requested: remove';
	};

	$effect(() => {
		actionError = form?.message ?? '';
	});

	$effect(() => {
		const artworkId = data.trackedArtwork?.id ?? null;
		trackedScore = data.trackedArtwork?.score ?? 0;

		if (!browser) {
			return;
		}

		if (!artworkId) {
			currentArtworkId = null;
			stopRealtime();
			subscriptionState = 'idle';
			subscriptionError = '';
			eventLog = [];
			return;
		}

		if (currentArtworkId === artworkId) {
			return;
		}

		currentArtworkId = artworkId;
		void startRealtime(artworkId);

		return () => {
			stopRealtime();
		};
	});
</script>

<svelte:head>
	<title>Artwork Realtime Vote Demo</title>
</svelte:head>

<nav>
	<a href={resolve('/demo')}>Back to demo index</a>
	<a href={resolve('/demo/better-auth')}>Back to auth demo</a>
	<a href={resolve('/demo/artwork-publish')}>Back to artwork publish demo</a>
</nav>

<h1>Artwork Realtime Vote Demo</h1>
<p>Realtime vote demo state: authenticated</p>
<p>Signed in as: {data.user.nickname}</p>

{#if !data.trackedArtwork}
	<section aria-label="Publish tracked artwork">
		<h2>Publish tracked artwork</h2>
		<p>Publish one artwork to open the realtime vote view for a second browser context.</p>
		<form method="post" action="?/publish" enctype="multipart/form-data">
			<label>
				Artwork title
				<input
					name="title"
					value="Realtime Gallery Study"
					class="mt-1 rounded-md border border-stone-300 bg-white px-3 py-2 shadow-sm focus:border-amber-700 focus:ring-2 focus:ring-amber-700 focus:outline-none"
				/>
			</label>
			<label>
				Artwork media
				<input
					accept="image/avif"
					name="media"
					type="file"
					class="mt-1 rounded-md border border-stone-300 bg-white px-3 py-2 shadow-sm focus:border-amber-700 focus:ring-2 focus:ring-amber-700 focus:outline-none"
				/>
			</label>
			<button class="rounded-md bg-amber-700 px-4 py-2 text-white transition hover:bg-amber-800"
				>Publish tracked artwork</button
			>
		</form>
		<p class="text-red-600">{actionError}</p>
	</section>
{:else}
	<section aria-label="Tracked artwork state">
		<h2>Tracked artwork state</h2>
		<p>Tracked artwork ID: {data.trackedArtwork.id}</p>
		<p>Tracked artwork title: {data.trackedArtwork.title}</p>
		<p>Tracked artwork author: {data.trackedArtwork.author.nickname}</p>
		<p>Tracked artwork score: {trackedScore}</p>
		<p>Realtime subscription: {subscriptionState}</p>
		{#if subscriptionError}
			<p class="text-red-600">Realtime error: {subscriptionError}</p>
		{/if}
		{#if actionStatus}
			<p>{actionStatus}</p>
		{/if}
		{#if actionError}
			<p class="text-red-600">Vote action error: {actionError}</p>
		{/if}
	</section>

	<section aria-label="Tracked artwork controls">
		<h2>Tracked artwork controls</h2>
		<p>Open this same URL in another signed-in browser context to drive the vote changes.</p>
		<button
			type="button"
			onclick={() => mutateVote('up')}
			disabled={actionPending}
			class="rounded-md bg-stone-900 px-4 py-2 text-white transition hover:bg-black disabled:opacity-50"
		>
			Upvote tracked artwork
		</button>
		<button
			type="button"
			onclick={() => mutateVote('remove')}
			disabled={actionPending}
			class="rounded-md border border-stone-400 px-4 py-2 text-stone-900 transition hover:border-stone-700 hover:text-black disabled:opacity-50"
		>
			Remove vote
		</button>
	</section>

	<section aria-label="Realtime event log">
		<h2>Realtime event log</h2>
		{#if eventLog.length === 0}
			<p>No realtime events received yet.</p>
		{:else}
			<ul>
				{#each eventLog as eventEntry (eventEntry)}
					<li>{eventEntry}</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

{#if data.trackedArtworkState === 'unavailable'}
	<p class="text-red-600">Tracked artwork is unavailable.</p>
{/if}
