<script lang="ts">
	import type { Artwork } from '$lib/features/artwork-presentation/model/artwork';
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';

	type Viewer = {
		id: string;
		role: 'admin' | 'moderator' | 'user';
	};

	type HotWallRoomProps = {
		adultContentEnabled?: boolean;
		artworks?: Artwork[];
		gridArtworks?: Artwork[];
		leadArtwork?: Artwork | null;
		onArtworkPatch?: (
			artworkId: string,
			patch: Partial<Pick<Artwork, 'isHidden' | 'isNsfw'>>
		) => void;
		onSelect?: (artwork: Artwork) => void;
		risers?: Artwork[];
		viewer?: Viewer | null;
	};
	let {
		adultContentEnabled = false,
		artworks = [],
		gridArtworks = [],
		leadArtwork = null,
		onArtworkPatch = () => {},
		onSelect = () => {},
		risers = [],
		viewer = null
	}: HotWallRoomProps = $props();

	$effect(() => {
		void adultContentEnabled;
		void artworks;
		void gridArtworks;
		void leadArtwork;
		void onArtworkPatch;
		void onSelect;
		void risers;
		void viewer;
	});
</script>

<div
	class="flex min-h-[28rem] items-center justify-center px-6 py-12"
	data-testid="hot-wall-coming-soon"
>
	<PostItNote
		attachment="pin"
		className="max-w-sm"
		color="#f4aacb"
		label="The Hot Wall"
		seedKey="hot-wall-coming-soon"
		text="Proximamente."
	/>
</div>
