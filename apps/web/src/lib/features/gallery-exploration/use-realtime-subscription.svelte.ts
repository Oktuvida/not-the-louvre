import type { SupabaseClient } from '@supabase/supabase-js';
import { createRealtimeAttemptController } from '$lib/features/realtime/attempt-controller';

export type RealtimeTokenResponse = {
	expiresAt?: string | null;
	token: string;
};

export type RealtimeSubscriptionOptions = {
	getRealtimeClient: () => SupabaseClient | Promise<SupabaseClient>;
	fetchToken: () => Promise<RealtimeTokenResponse | null>;
	viewerId: string;
	onRefresh: (artworkId: string) => void;
};

/*
 * Opening an artwork used to mint a fresh realtime JWT every single time, even
 * though the endpoint issues them with a five-minute TTL. Reuse one only while
 * more than half its life is left: nothing re-authenticates a live channel, so
 * a token handed out near its expiry would leave a panel that stays open
 * quietly deaf.
 */
const TOKEN_REUSE_FLOOR_MS = 150_000;

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- module-scope cache, not reactive state
const tokenCache = new Map<string, { expiresAtMs: number; token: string }>();

/** Test seam — the cache is module scope so it survives room-to-room remounts. */
export const clearRealtimeTokenCache = () => tokenCache.clear();

export const createRealtimeSubscription = (options: RealtimeSubscriptionOptions) => {
	const attemptController = createRealtimeAttemptController();

	let cleanupChannel: (() => void) | null = null;
	let connected = $state(false);

	const readCachedToken = () => {
		const cached = tokenCache.get(options.viewerId);
		if (!cached) return null;

		if (cached.expiresAtMs - Date.now() > TOKEN_REUSE_FLOOR_MS) return cached.token;

		tokenCache.delete(options.viewerId);
		return null;
	};

	const resolveToken = async () => {
		const cached = readCachedToken();
		if (cached) return cached;

		const response = await options.fetchToken();

		if (!response) {
			// A refused or failed mint invalidates whatever we were holding.
			tokenCache.delete(options.viewerId);
			return null;
		}

		const expiresAtMs = response.expiresAt ? Date.parse(response.expiresAt) : Number.NaN;
		if (Number.isFinite(expiresAtMs)) {
			tokenCache.set(options.viewerId, { expiresAtMs, token: response.token });
		}

		return response.token;
	};

	const stop = () => {
		attemptController.cancel();
		cleanupChannel?.();
		cleanupChannel = null;
		connected = false;
	};

	const start = async (artworkId: string) => {
		stop();
		const attempt = attemptController.begin();

		try {
			const token = await resolveToken();

			if (!token) {
				return;
			}

			if (!attemptController.isCurrent(attempt.id)) {
				return;
			}

			const supabase = await options.getRealtimeClient();
			await supabase.realtime.setAuth(token);

			if (!attemptController.isCurrent(attempt.id)) {
				return;
			}

			// Belt and braces behind the server-side filter below: a payload that
			// slips through (or a server that ignores the filter) must not refresh
			// somebody else's artwork.
			const isArtworkEvent = (payload: unknown) => {
				if (typeof payload !== 'object' || payload === null) {
					return false;
				}

				const candidate = payload as {
					new?: { artwork_id?: string };
					old?: { artwork_id?: string };
				};

				return candidate.new?.artwork_id === artworkId || candidate.old?.artwork_id === artworkId;
			};

			/*
			 * Without the filter every vote and comment anywhere on the site is
			 * broadcast to every connected browser and thrown away client-side.
			 * Both mirror tables are REPLICA IDENTITY FULL, so DELETE payloads
			 * still carry `old.artwork_id` and the filter keeps matching.
			 */
			const artworkFilter = `artwork_id=eq.${artworkId}`;

			const channel = supabase
				.channel(`gallery-artwork:${artworkId}:${options.viewerId}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						filter: artworkFilter,
						schema: 'app',
						table: 'artwork_vote_realtime'
					},
					(payload) => {
						if (attemptController.isCurrent(attempt.id) && isArtworkEvent(payload)) {
							options.onRefresh(artworkId);
						}
					}
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						filter: artworkFilter,
						schema: 'app',
						table: 'artwork_comment_realtime'
					},
					(payload) => {
						if (attemptController.isCurrent(attempt.id) && isArtworkEvent(payload)) {
							options.onRefresh(artworkId);
						}
					}
				)
				.subscribe();

			if (!attemptController.isCurrent(attempt.id)) {
				void supabase.removeChannel(channel);
				return;
			}

			cleanupChannel = () => {
				void supabase.removeChannel(channel);
			};

			connected = true;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}
			throw error;
		}
	};

	return {
		start,
		stop,
		get isConnected() {
			return connected;
		}
	};
};
