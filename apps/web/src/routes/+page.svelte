<script lang="ts">
	import type {
		HomeAuthActionForm,
		HomeAuthBootstrap
	} from '$lib/features/home-entry-scene/auth-contract';
	import EntrySceneController from '$lib/features/home-entry-scene/components/EntrySceneController.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<EntrySceneController auth={data.auth as HomeAuthBootstrap} form={form as HomeAuthActionForm} />
