import { DurableObject } from 'cloudflare:workers';

/**
 * One per artwork. Browsers with the artwork's detail open keep a WebSocket
 * here, and the web Worker posts every vote or comment change, which goes out
 * to all of them.
 *
 * Sockets go through the hibernation API: between changes the object is
 * evicted from memory while the connections stay open, and the browsers'
 * keep-alive pings are answered by the runtime without waking it, so viewers
 * sitting on a quiet artwork cost nothing.
 */
export class ArtworkTopic extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
			const { 0: browser, 1: server } = new WebSocketPair();
			this.ctx.acceptWebSocket(server);
			return new Response(null, { status: 101, webSocket: browser });
		}

		if (request.method === 'POST') {
			const change = await request.text();
			for (const socket of this.ctx.getWebSockets()) {
				try {
					socket.send(change);
				} catch {
					// The socket is closing; its close handler cleans it up.
				}
			}
			return new Response(null, { status: 204 });
		}

		return new Response('Not found', { status: 404 });
	}

	// Viewers only listen; anything they send besides the auto-answered ping
	// is ignored.
	async webSocketMessage() {}

	async webSocketClose(socket: WebSocket, code: number, reason: string) {
		try {
			socket.close(code, reason);
		} catch {
			// Already closed by the runtime.
		}
	}
}

export default {
	fetch: () => new Response('Not found', { status: 404 })
} satisfies ExportedHandler<Env>;
