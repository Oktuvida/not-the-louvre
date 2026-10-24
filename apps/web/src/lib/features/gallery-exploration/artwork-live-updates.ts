import type { ArtworkLiveChange } from '#lib/shared/artwork/live-change.js';
import { readArtworkLiveChange } from './artwork-live-change';

/*
 * Keeps the open artwork detail current. A WebSocket to the artwork's live
 * endpoint (served by the realtime Worker's Durable Object) reports every vote
 * or comment change, usually with its data. A dropped socket reconnects with
 * backoff while the same artwork stays open and reports a change without data
 * once it is back, since changes made in the gap were never announced.
 */

// Under the idle timeout of the proxies between browser and Cloudflare; the
// Durable Object answers these without waking up.
const PING_INTERVAL_MS = 30_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export type ArtworkLiveUpdatesOptions = {
	/** `change` is null when the artwork has to be read again to catch up. */
	onChange: (artworkId: string, change: ArtworkLiveChange | null) => void;
};

const liveUrl = (artworkId: string) => {
	const url = new URL(`/api/artworks/${encodeURIComponent(artworkId)}/live`, window.location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	return url.href;
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
			if (isReconnect) options.onChange(artworkId, null);
		};

		next.onmessage = (event) => {
			const change = readArtworkLiveChange(event.data);
			if (change?.artworkId === artworkId) options.onChange(artworkId, change);
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
