<script lang="ts">
	import { useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import type { Material, Mesh, Texture } from 'three';

	/*
	 * Gives the room's GPU memory back the moment the room leaves the page.
	 * threlte disposes the renderer, but the WebGL context itself stayed alive
	 * until the garbage collector reached the detached canvas, so every visit
	 * to the front door left one more behind (Safari reloads a page that holds
	 * too much). The scene's own buffers and textures go first, then the
	 * context.
	 */
	const { renderer, scene } = useThrelte();

	const releaseMaterial = (material: Material) => {
		for (const value of Object.values(material)) {
			if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
		}
		material.dispose();
	};

	onDestroy(() => {
		scene.traverse((object) => {
			const mesh = object as Mesh;
			if (!mesh.isMesh) return;
			mesh.geometry.dispose();
			for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
				releaseMaterial(material);
			}
		});
		renderer.forceContextLoss();
	});
</script>
