/*
 * Keeps the open artwork detail current. A WebSocket to the artwork's live
 * endpoint (served by the realtime Worker's Durable Object) reports every vote
 * or comment change, and the page refetches the detail. A dropped socket
 * reconnects with backoff while the same artwork stays open, and refetches once
 * it is back, since changes made in the gap were never announced.
 */

// Under the idle timeout of the proxies between browser and Cloudflare; the
// Durable Object answers these without waking up.
const PING_INTERVAL_MS = 30_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export type ArtworkLiveUpdatesOptions = {
	onChange: (artworkId: string) => void;
};

const liveUrl = (artworkId: string) => {
	const url = new URL(`/api/artworks/${encodeURIComponent(artworkId)}/live`, window.location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.href;
};

const readChangedArtworkId = (data: unknown) => {
	if (typeof data !== 'string') return null;
	try {
		const change = JSON.parse(data) as { artworkId?: unknown };
		return typeof change.artworkId === 'string' ? change.artworkId : null;
	} catch {
		return null;
	}
};

export const createArtworkLiveUpdates = (options: ArtworkLiveUpdatesOptions) => {
	let socket: WebSocket | null = null;
	let watchedArtworkId: string | null = null;
	let failedAttempts = 0;
	let pingTimer: ReturnType<typeof setInterval> | undefined;
	let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

	const closeSocket = () => {
		clearInterval(pingTimer);
		const current = socket;
		socket = null;
		if (current) {
			current.onclose = null;
			current.close(1000);
		}
	};

	const connect = (artworkId: string, isReconnect: boolean) => {
		const next = new WebSocket(liveUrl(artworkId));
		socket = next;

		next.onopen = () => {
			failedAttempts = 0;
			pingTimer = setInterval(() => {
				if (next.readyState === WebSocket.OPEN) next.send('ping');
			}, PING_INTERVAL_MS);
			if (isReconnect) options.onChange(artworkId);
		};

		next.onmessage = (event) => {
			if (readChangedArtworkId(event.data) === artworkId) {
				options.onChange(artworkId);
			}
		};

		next.onclose = () => {
			if (socket !== next) return;
			clearInterval(pingTimer);
			socket = null;
			if (watchedArtworkId !== artworkId) return;

			const delay = RECONNECT_DELAYS_MS[Math.min(failedAttempts, RECONNECT_DELAYS_MS.length - 1)];
			failedAttempts += 1;
			reconnectTimer = setTimeout(() => {
				if (watchedArtworkId === artworkId) connect(artworkId, true);
			}, delay);
		};
	};

	const stop = () => {
		watchedArtworkId = null;
		failedAttempts = 0;
		clearTimeout(reconnectTimer);
		closeSocket();
	};

	const start = (artworkId: string) => {
		stop();
		watchedArtworkId = artworkId;
		connect(artworkId, false);
	};

	return { start, stop };
};
