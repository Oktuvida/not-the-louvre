<script lang="ts">
	import PostItNote from '$lib/features/shared-ui/components/PostItNote.svelte';
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
