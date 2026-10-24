import { artworkTopics, runAfterResponse } from '#lib/server/platform.js';

/*
 * Live updates for an open artwork. Each artwork has a Durable Object in the
 * realtime Worker (apps/realtime) that holds the WebSockets of everyone with
 * its detail open; the services post every vote and comment change to it, and
 * it passes the change on.
 */

export type ArtworkChange = 'comments' | 'votes';

const topicFor = (artworkId: string) => {
	const topics = artworkTopics();
	return topics ? topics.get(topics.idFromName(artworkId)) : null;
};

/** Tells everyone watching the artwork that it changed. Never fails the caller. */
export const publishArtworkChange = (artworkId: string, change: ArtworkChange) => {
	const topic = topicFor(artworkId);
	if (!topic) return;

	runAfterResponse(
		topic
			.fetch('https://artwork-topic/changes', {
				body: JSON.stringify({ artworkId, change }),
				method: 'POST'
			})
			.catch(() => {})
	);
};

/** Hands a browser's WebSocket upgrade to the artwork's topic. */
export const connectToArtworkTopic = async (artworkId: string, request: Request) => {
	const topic = topicFor(artworkId);
	return topic ? topic.fetch(request) : null;
};
