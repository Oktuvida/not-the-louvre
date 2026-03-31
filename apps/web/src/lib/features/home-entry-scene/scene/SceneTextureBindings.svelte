<script lang="ts">
	import { useThrelte } from '@threlte/core';
	import { DoubleSide, Mesh, MeshBasicMaterial, SRGBColorSpace, TextureLoader } from 'three';
	import type { Object3D, Texture } from 'three';
	import type {
		HomeSceneArtworkSlot,
		HomeSceneArtworkSlotName
	} from '$lib/features/home-entry-scene/state/home-entry.svelte';

	const DEBUG_SHOW_AVATAR_MESH = false;
	const FALLBACK_AVATAR_SVG = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
			<rect width="256" height="256" fill="#f3eadf" />
			<rect x="18" y="18" width="220" height="220" rx="28" fill="#fbf6ef" stroke="#8f6b4f" stroke-width="10" />
			<circle cx="128" cy="96" r="38" fill="#d1b08f" />
			<path d="M70 196c8-35 33-53 58-53s50 18 58 53" fill="none" stroke="#8f6b4f" stroke-width="18" stroke-linecap="round" />
			<path d="M86 70c9-18 25-28 42-28 21 0 38 11 47 31" fill="none" stroke="#5c4332" stroke-width="12" stroke-linecap="round" />
		</svg>
	`;
	const FALLBACK_AVATAR_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FALLBACK_AVATAR_SVG)}`;

	let {
		avatarUrl = null,
		artworkSlots = [],
		nodes = {},
		sceneRoot = null
	}: {
		avatarUrl?: string | null;
		artworkSlots?: HomeSceneArtworkSlot[];
		nodes?: Record<string, Object3D>;
		sceneRoot?: Object3D | null;
	} = $props();

	type SceneTextureTargetName = 'avatar' | HomeSceneArtworkSlotName;
	type AppliedMaterial = {
		artifact: Mesh;
		material: MeshBasicMaterial;
		originalMaterial: Mesh['material'];
	};

	let textureByTarget = $state<Partial<Record<SceneTextureTargetName, Texture>>>({});
	const { invalidate } = useThrelte();
	const textureLoader = new TextureLoader();
	const textureTargets = $derived.by(
		() =>
			[
				{ name: 'avatar' as const, url: avatarUrl || FALLBACK_AVATAR_URL },
				...artworkSlots.map((slot) => ({ name: slot.slotName, url: slot.imageUrl }))
			] satisfies Array<{ name: SceneTextureTargetName; url: string }>
	);

	$effect(() => {
		let cancelled = false;

		void Promise.all(
			textureTargets.map(async ({ name, url }) => {
				const texture = await textureLoader.loadAsync(url);
				texture.colorSpace = SRGBColorSpace;
				texture.flipY = false;
				texture.needsUpdate = true;

				return [name, texture] as const;
			})
		)
			.then((entries) => {
				if (!cancelled) {
					textureByTarget = Object.fromEntries(entries) as Partial<
						Record<SceneTextureTargetName, Texture>
					>;
					invalidate();
				}
			})
			.catch(() => {
				if (!cancelled) {
					textureByTarget = {};
					invalidate();
				}
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const applied: AppliedMaterial[] = [];

		for (const { name } of textureTargets) {
			const artifact = sceneRoot?.getObjectByName(name) ?? nodes[name];
			const texture = textureByTarget[name];

			if (!(artifact instanceof Mesh) || Array.isArray(artifact.material) || !texture) {
				continue;
			}

			const originalMaterial = artifact.material;
			const material = new MeshBasicMaterial({
				color: DEBUG_SHOW_AVATAR_MESH && name === 'avatar' ? '#ff00ff' : '#ffffff',
				map: DEBUG_SHOW_AVATAR_MESH && name === 'avatar' ? null : texture,
				side: DoubleSide,
				transparent: true
			});

			artifact.material = material;
			applied.push({ artifact, material, originalMaterial });
		}

		if (applied.length > 0) {
			invalidate();
		}

		return () => {
			for (const { artifact, material, originalMaterial } of applied) {
				if (artifact.material === material) {
					artifact.material = originalMaterial;
				}

				material.dispose();
			}
		};
	});
</script>
