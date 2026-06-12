<script lang="ts">
	import { useThrelte } from '@threlte/core';

	let {
		onready
	}: {
		onready: (invalidate: () => void) => void;
	} = $props();

	const { invalidate } = useThrelte();

	$effect(() => {
		onready(invalidate);
	});
</script>
