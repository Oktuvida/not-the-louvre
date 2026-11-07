<script lang="ts">
	import StaffDeskPage from '#lib/features/staff-desk/StaffDeskPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<StaffDeskPage {data} />
