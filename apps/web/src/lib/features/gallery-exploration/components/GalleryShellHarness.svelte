<script lang="ts">
	import type { GalleryRoomId } from '$lib/features/gallery-exploration/model/rooms';
	import GalleryShell from './GalleryShell.svelte';

	interface Props {
		roomId: GalleryRoomId;
		viewer: { id: string; role: 'admin' | 'moderator' | 'user' } | null;
	}

	let { roomId, viewer }: Props = $props();
</script>

<GalleryShell {roomId} {viewer}>
	<div data-testid="shell-content">Room content goes here</div>
</GalleryShell>
