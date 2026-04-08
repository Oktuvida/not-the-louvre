import type { SupabaseClient } from '@supabase/supabase-js';
import { createRealtimeAttemptController } from '$lib/features/realtime/attempt-controller';

export type RealtimeSubscriptionOptions = {
	getRealtimeClient: () => SupabaseClient;
	fetchToken: () => Promise<string | null>;
	viewerId: string;
	onRefresh: (artworkId: string) => void;
};

export const createRealtimeSubscription = (options: RealtimeSubscriptionOptions) => {
	const attemptController = createRealtimeAttemptController();

	let cleanupChannel: (() => void) | null = null;
	let connected = $state(false);

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
			const token = await options.fetchToken();

			if (!token) {
				return;
			}

			if (!attemptController.isCurrent(attempt.id)) {
				return;
			}

			const supabase = options.getRealtimeClient();
			await supabase.realtime.setAuth(token);

			if (!attemptController.isCurrent(attempt.id)) {
				return;
			}

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

			const channel = supabase
				.channel(`gallery-artwork:${artworkId}:${options.viewerId}`)
				.on(
					'postgres_changes',
					{
						event: '*',
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
