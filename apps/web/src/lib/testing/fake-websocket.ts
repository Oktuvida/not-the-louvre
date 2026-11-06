import { vi } from 'vitest';

/*
 * A stand-in for WebSocket in component specs: nothing connects anywhere, and
 * the spec plays the server.
 *
 *   beforeEach(() => installFakeWebSocket());
 *   const socket = await connectedSocket('/api/artworks/artwork-1/live');
 *   socket.receive(JSON.stringify({ artworkId: 'artwork-1', change: 'votes' }));
 */

export class FakeWebSocket extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly url: string;
	readyState = FakeWebSocket.CONNECTING;
	readonly sent: string[] = [];
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onopen: ((event: Event) => void) | null = null;

	constructor(url: string | URL) {
		super();
		this.url = String(url);
		sockets.push(this);
	}

	send(data: string) {
		this.sent.push(data);
	}

	close(code = 1000) {
		if (this.readyState === FakeWebSocket.CLOSED) return;
		this.readyState = FakeWebSocket.CLOSED;
		this.onclose?.(new CloseEvent('close', { code }));
	}

	/** The server accepted the connection. */
	open() {
		this.readyState = FakeWebSocket.OPEN;
		this.onopen?.(new Event('open'));
	}

	/** The server sent a message. */
	receive(data: string) {
		this.onmessage?.(new MessageEvent('message', { data }));
	}

	/** The connection failed or dropped. */
	drop() {
		this.readyState = FakeWebSocket.CLOSED;
		this.onclose?.(new CloseEvent('close', { code: 1006 }));
	}
}

const sockets: FakeWebSocket[] = [];

export const installFakeWebSocket = () => {
	sockets.length = 0;
	vi.stubGlobal('WebSocket', FakeWebSocket);
};

/** Every socket opened since the install, oldest first. */
export const openedSockets = () => [...sockets];

/** Waits for a socket to the given path and accepts it. */
export const connectedSocket = async (path: string) => {
	let socket: FakeWebSocket | undefined;
	await vi.waitFor(() => {
		socket = sockets.findLast((candidate) => new URL(candidate.url).pathname === path);
		if (!socket) throw new Error(`No WebSocket to ${path} yet`);
	});
	socket!.open();
	return socket!;
};
