<script lang="ts">
	import { untrack } from 'svelte';
	import { gsap } from 'gsap';
	import { Canvas, T } from '@threlte/core';
	import { GLTF, OrbitControls, useDraco } from '@threlte/extras';
	import type { Group, Object3D, OrthographicCamera } from 'three';
	import type { HomeSceneArtworkSlot } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import SceneTextureBindings from '$lib/features/home-entry-scene/scene/SceneTextureBindings.svelte';
	import StudioLoadingFallback from '$lib/features/shared-3d-world/components/StudioLoadingFallback.svelte';
	import type { EntryFlowState } from '$lib/features/home-entry-scene/state/entry-state.svelte';

	let {
		entryState = 'outside',
		initialPose = 'default',
		scenePose = 'default',
		artworkSlots = [],
		avatarUrl = null
	}: {
		entryState?: EntryFlowState;
		initialPose?: 'default' | 'left-wall' | 'top-close';
		scenePose?: 'default' | 'left-wall' | 'top-close';
		artworkSlots?: HomeSceneArtworkSlot[];
		avatarUrl?: string | null;
	} = $props();

	let loaded = $state(false);

	const LEFT_WALL_CAMERA = {
		cameraX: 0,
		cameraDepth: 16,
		cameraHeight: 0.8,
		rotationX: 0,
		rotationY: 0,
		targetX: 0,
		targetY: 0.8,
		targetZ: 0,
		zoom: 12000
	};
	const TOP_CLOSE_CAMERA = {
		cameraX: 1.8,
		cameraDepth: 0.6,
		cameraHeight: 0,
		rotationX: 0,
		rotationY: 0,
		targetX: 1.8,
		targetY: -1.8,
		targetZ: 0.6,
		zoom: 450
	};
	const DEFAULT_CAMERA = {
		cameraX: 0,
		cameraDepth: 16,
		cameraHeight: 7.8,
		rotationX: -0.22,
		rotationY: 0,
		targetX: 0,
		targetY: 0.8,
		targetZ: 0,
		zoom: 40
	};
	const initialPoseValue = untrack(() => initialPose);
	const initialCamera =
		initialPoseValue === 'left-wall'
			? LEFT_WALL_CAMERA
			: initialPoseValue === 'top-close'
				? TOP_CLOSE_CAMERA
				: DEFAULT_CAMERA;

	let cameraX = $state(initialCamera.cameraX);
	let cameraZoom = $state(initialCamera.zoom);
	let cameraHeight = $state(initialCamera.cameraHeight);
	let cameraDepth = $state(initialCamera.cameraDepth);
	let cameraTargetX = $state(initialCamera.targetX);
	let cameraTargetY = $state(initialCamera.targetY);
	let cameraTargetZ = $state(initialCamera.targetZ);
	let studioCamera = $state<OrthographicCamera | undefined>(undefined);
	let modelRotationX = $state(initialCamera.rotationX);
	let modelRotationY = $state(initialCamera.rotationY);
	let studioNodes = $state<Record<string, Object3D>>({});
	let studioSceneRoot = $state<Group | null>(null);
	let previousScenePose: 'default' | 'left-wall' | 'top-close' | undefined = initialPoseValue;
	let holdingInitialPose = initialPoseValue !== 'default';
	let activeSceneTimeline: gsap.core.Animation | null = null;
	const ENTER_DURATION = 2.08;
	const RESET_DURATION = 1.13;
	const LEFT_WALL_ROTATE_DURATION = 1.1;
	const LEFT_WALL_ZOOM_DURATION = 2.2;
	const LEFT_WALL_EXIT_ZOOM_DURATION = 1.1;
	const LEFT_WALL_EXIT_ROTATE_DURATION = 1.75;
	const TOP_CLOSE_ENTER_DURATION = 2;
	const TOP_CLOSE_EXIT_DURATION = 1.4;

	const studioMotion = {
		cameraX: initialCamera.cameraX,
		zoom: initialCamera.zoom,
		cameraDepth: initialCamera.cameraDepth,
		cameraHeight: initialCamera.cameraHeight,
		targetX: initialCamera.targetX,
		targetY: initialCamera.targetY,
		targetZ: initialCamera.targetZ,
		rotationX: initialCamera.rotationX,
		rotationY: initialCamera.rotationY
	};
	const studioDracoLoader = useDraco();

	const syncStudioMotion = () => {
		cameraX = studioMotion.cameraX;
		cameraZoom = studioMotion.zoom;
		cameraDepth = studioMotion.cameraDepth;
		cameraHeight = studioMotion.cameraHeight;
		cameraTargetX = studioMotion.targetX;
		cameraTargetY = studioMotion.targetY;
		cameraTargetZ = studioMotion.targetZ;
		modelRotationX = studioMotion.rotationX;
		modelRotationY = studioMotion.rotationY;
	};

	$effect(() => {
		void cameraX;
		void cameraDepth;
		void cameraHeight;
		void cameraTargetX;
		void cameraTargetY;
		void cameraTargetZ;
		if (!studioCamera) return;

		studioCamera.lookAt(cameraTargetX, cameraTargetY, cameraTargetZ);
	});

	$effect(() => {
		const isLeftWallPose = scenePose === 'left-wall';
		const isTopClosePose = scenePose === 'top-close';
		const isLeavingLeftWall = previousScenePose === 'left-wall' && scenePose === 'default';
		const isLeavingTopClose = previousScenePose === 'top-close' && scenePose === 'default';
		const isInside =
			entryState === 'transitioning-in' ||
			entryState === 'auth-login' ||
			entryState === 'auth-signup' ||
			entryState === 'auth-recovery' ||
			entryState === 'inside';

		// Hold the initial return pose — only on the first mount, not on subsequent visits
		if (holdingInitialPose && scenePose === initialPoseValue) {
			previousScenePose = scenePose;
			return;
		}
		if (holdingInitialPose && scenePose !== initialPoseValue) {
			holdingInitialPose = false;
		}

		activeSceneTimeline?.kill();
		activeSceneTimeline = null;
		gsap.killTweensOf(studioMotion);

		if (isLeftWallPose) {
			previousScenePose = scenePose;
			activeSceneTimeline = gsap
				.timeline()
				.to(studioMotion, {
					rotationY: 0,
					duration: LEFT_WALL_ROTATE_DURATION,
					ease: 'power3.inOut',
					onUpdate: syncStudioMotion
				})
				.to(studioMotion, {
					cameraX: LEFT_WALL_CAMERA.cameraX,
					cameraDepth: LEFT_WALL_CAMERA.cameraDepth,
					targetX: LEFT_WALL_CAMERA.targetX,
					targetY: LEFT_WALL_CAMERA.targetY,
					targetZ: LEFT_WALL_CAMERA.targetZ,
					zoom: 12000,
					cameraHeight: 0.8,
					rotationX: 0,
					duration: LEFT_WALL_ZOOM_DURATION,
					ease: 'power4.inOut',
					onUpdate: syncStudioMotion
				});

			return;
		}

		if (isTopClosePose && isInside) {
			previousScenePose = scenePose;
			activeSceneTimeline = gsap.to(studioMotion, {
				zoom: TOP_CLOSE_CAMERA.zoom,
				cameraX: TOP_CLOSE_CAMERA.cameraX,
				cameraDepth: TOP_CLOSE_CAMERA.cameraDepth,
				cameraHeight: TOP_CLOSE_CAMERA.cameraHeight,
				targetX: TOP_CLOSE_CAMERA.targetX,
				targetY: TOP_CLOSE_CAMERA.targetY,
				targetZ: TOP_CLOSE_CAMERA.targetZ,
				rotationX: TOP_CLOSE_CAMERA.rotationX,
				rotationY: TOP_CLOSE_CAMERA.rotationY,
				duration: TOP_CLOSE_ENTER_DURATION,
				ease: 'power3.inOut',
				onUpdate: syncStudioMotion
			});

			return;
		}

		if (isLeavingLeftWall && isInside) {
			previousScenePose = scenePose;
			activeSceneTimeline = gsap
				.timeline()
				.to(studioMotion, {
					cameraX: 0,
					zoom: 60,
					cameraDepth: 16,
					cameraHeight: 7.8,
					targetX: 0,
					targetY: 0.8,
					targetZ: 0,
					rotationX: -0.22,
					duration: LEFT_WALL_EXIT_ZOOM_DURATION,
					ease: 'power3.out',
					onUpdate: syncStudioMotion
				})
				.to(studioMotion, {
					rotationY: -Math.PI / 4,
					duration: LEFT_WALL_EXIT_ROTATE_DURATION,
					ease: 'power3.inOut',
					onUpdate: syncStudioMotion
				});

			return;
		}

		if (isLeavingTopClose && isInside) {
			previousScenePose = scenePose;
			activeSceneTimeline = gsap
				.timeline()
				.to(studioMotion, {
					cameraX: 0,
					zoom: 60,
					cameraDepth: 16,
					cameraHeight: 7.8,
					targetX: 0,
					targetY: 0.8,
					targetZ: 0,
					rotationX: -0.22,
					duration: TOP_CLOSE_EXIT_DURATION,
					ease: 'power3.inOut',
					onUpdate: syncStudioMotion
				})
				.to(studioMotion, {
					rotationY: -Math.PI / 4,
					duration: 0.8,
					ease: 'power3.inOut',
					onUpdate: syncStudioMotion
				});

			return;
		}

		if (entryState === 'transitioning-out') {
			previousScenePose = scenePose;
			gsap.to(studioMotion, {
				cameraX: 0,
				zoom: 40,
				cameraDepth: 16,
				cameraHeight: 7.8,
				targetX: 0,
				targetY: 0.8,
				targetZ: 0,
				rotationX: -0.22,
				rotationY: 0,
				duration: RESET_DURATION,
				ease: 'power3.out',
				onUpdate: syncStudioMotion
			});

			return;
		}

		if (!isInside) {
			previousScenePose = scenePose;
			gsap.set(studioMotion, {
				cameraX: 0,
				zoom: 40,
				cameraDepth: 16,
				cameraHeight: 7.8,
				targetX: 0,
				targetY: 0.8,
				targetZ: 0,
				rotationX: -0.22,
				rotationY: 0
			});
			cameraX = 0;
			cameraZoom = 40;
			cameraDepth = 16;
			cameraHeight = 7.8;
			cameraTargetX = 0;
			cameraTargetY = 0.8;
			cameraTargetZ = 0;
			modelRotationX = -0.22;
			modelRotationY = 0;
			return;
		}

		previousScenePose = scenePose;
		activeSceneTimeline = gsap
			.timeline()
			.to(studioMotion, {
				cameraX: 0,
				zoom: 60,
				cameraDepth: 16,
				cameraHeight: 7.8,
				targetX: 0,
				targetY: 0.8,
				targetZ: 0,
				rotationX: -0.22,
				duration: ENTER_DURATION,
				ease: 'power4.inOut',
				onUpdate: syncStudioMotion
			})
			.to(
				studioMotion,
				{
					rotationY: -Math.PI / 4,
					duration: ENTER_DURATION - 0.55,
					ease: 'power3.inOut',
					onUpdate: syncStudioMotion
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
			bind:ref={studioCamera}
			makeDefault
			position={[cameraX, cameraHeight, cameraDepth]}
			zoom={cameraZoom}
			oncreate={(camera) => camera.lookAt(cameraTargetX, cameraTargetY, cameraTargetZ)}
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
		<SceneTextureBindings
			{avatarUrl}
			{artworkSlots}
			nodes={studioNodes}
			sceneRoot={studioSceneRoot}
		/>
		<GLTF
			bind:nodes={studioNodes}
			bind:scene={studioSceneRoot}
			dracoLoader={studioDracoLoader}
			url="/models/studio-transformed.glb"
			scale={5.7}
			position={[0, -6, 0]}
			rotation={[modelRotationX, modelRotationY, 0]}
			castShadow
			receiveShadow
			onload={() => {
				loaded = true;
			}}
			onerror={() => {
				loaded = true;
			}}
		/>
		<T.Mesh rotation={[-Math.PI / 2, 0, 0.5]} position={[0, -2.62, 0]} receiveShadow>
			<T.CircleGeometry args={[18, 48]} />
			<T.ShadowMaterial transparent opacity={0.2} />
		</T.Mesh>
	</Canvas>
	<div
		class="pointer-events-none absolute inset-x-[7%] top-[8%] bottom-[6%] rounded-[1.6rem] border-2 border-white/18"
	></div>
</div>
