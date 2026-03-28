<script lang="ts">
	import { gsap } from 'gsap';
	import { Canvas, T } from '@threlte/core';
	import { GLTF, OrbitControls } from '@threlte/extras';
	import StudioLoadingFallback from '$lib/features/shared-3d-world/components/StudioLoadingFallback.svelte';
	import type { EntryFlowState } from '$lib/features/home-entry-scene/state/entry-state.svelte';

	let { entryState = 'outside' }: { entryState?: EntryFlowState } = $props();

	let loaded = $state(false);
	let cameraZoom = $state(40);
	let modelRotationY = $state(0);
	const ENTER_DURATION = 2.08;
	const RESET_DURATION = 1.13;

	const studioMotion = {
		zoom: 40,
		rotationY: 0
	};

	$effect(() => {
		const isInside =
			entryState === 'transitioning-in' ||
			entryState === 'auth-login' ||
			entryState === 'auth-signup' ||
			entryState === 'auth-recovery' ||
			entryState === 'inside';

		gsap.killTweensOf(studioMotion);

		if (entryState === 'transitioning-out') {
			gsap.to(studioMotion, {
				zoom: 40,
				rotationY: 0,
				duration: RESET_DURATION,
				ease: 'power3.out',
				onUpdate: () => {
					cameraZoom = studioMotion.zoom;
					modelRotationY = studioMotion.rotationY;
				}
			});

			return;
		}

		if (!isInside) {
			gsap.set(studioMotion, { zoom: 40, rotationY: 0 });
			cameraZoom = 40;
			modelRotationY = 0;
			return;
		}

		gsap
			.timeline()
			.to(studioMotion, {
				zoom: 60,
				duration: ENTER_DURATION,
				ease: 'power4.inOut',
				onUpdate: () => {
					cameraZoom = studioMotion.zoom;
					modelRotationY = studioMotion.rotationY;
				}
			})
			.to(
				studioMotion,
				{
					rotationY: -Math.PI / 4,
					duration: ENTER_DURATION - 0.55,
					ease: 'power3.inOut',
					onUpdate: () => {
						cameraZoom = studioMotion.zoom;
						modelRotationY = studioMotion.rotationY;
					}
				},
				0.55
			);
	});
</script>

<div
	class="relative h-full w-full overflow-hidden rounded-[2rem] border-[var(--border-frame)] bg-[radial-gradient(circle_at_50%_18%,_rgba(255,255,255,0.44),_transparent_30%),linear-gradient(180deg,_#ccb194_0%,_#8b6f57_100%)] shadow-[var(--shadow-strong)]"
>
	{#if !loaded}
		<StudioLoadingFallback />
	{/if}
	<Canvas dpr={1.5} shadows>
		<T.OrthographicCamera
			makeDefault
			position={[0, 7.8, 16]}
			zoom={cameraZoom}
			oncreate={(camera) => camera.lookAt(0, 0.8, 0)}
		>
			<OrbitControls
				autoRotate={false}
				enablePan={false}
				enableZoom={false}
				enableRotate={false}
				enableDamping
			/>
		</T.OrthographicCamera>
		<T.Color attach="background" args={['#d7c2a8']} />
		<T.Fog args={['#d7c2a8', 14, 32]} />
		<T.AmbientLight intensity={0.08} />
		<T.DirectionalLight position={[5, 16, 6]} intensity={1.4} castShadow />
		<GLTF
			url="/models/not-the-louvre-studio.glb"
			scale={5.7}
			position={[0, -6, 0]}
			rotation={[-0.22, modelRotationY, 0]}
			castShadow
			receiveShadow
			onload={() => {
				loaded = true;
			}}
			onerror={() => {
				loaded = true;
			}}
		/>
		<T.Mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.62, 0]} receiveShadow>
			<T.CircleGeometry args={[18, 48]} />
			<T.ShadowMaterial transparent opacity={0.2} />
		</T.Mesh>
	</Canvas>
	<div
		class="pointer-events-none absolute inset-x-[7%] top-[8%] bottom-[6%] rounded-[1.6rem] border-2 border-white/18"
	></div>
</div>
