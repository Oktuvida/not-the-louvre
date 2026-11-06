<script lang="ts">
	import { browser } from '$app/env';
	import { untrack } from 'svelte';
	import { gsap } from '#lib/client/gsap.js';
	import { Canvas, T } from '@threlte/core';
	import { GLTF } from '@threlte/extras';
	import {
		Color,
		Fog,
		TextureLoader,
		type Group,
		type Object3D,
		type OrthographicCamera
	} from 'three';
	import bookclothUrl from '#lib/assets/sketchbook/bookcloth.webp';
	import coverWearUrl from '#lib/assets/sketchbook/cover-wear.webp';
	import type { HomeSceneArtworkSlot } from '#lib/features/home-entry-scene/state/home-entry.svelte.js';
	import { studioCanvasShadowMap } from '#lib/features/home-entry-scene/scene/studio-renderer-config.js';
	import { getStudioDracoLoader } from '#lib/features/home-entry-scene/scene/studio-draco-loader.js';
	import { STUDIO_MODEL_URL } from '#lib/features/home-entry-scene/scene/studio-model.js';
	import SceneContextRelease from '#lib/features/home-entry-scene/scene/SceneContextRelease.svelte';
	import SceneFrameInvalidator from '#lib/features/home-entry-scene/scene/SceneFrameInvalidator.svelte';
	import SceneTextureBindings from '#lib/features/home-entry-scene/scene/SceneTextureBindings.svelte';
	import {
		createSketchbookCloth,
		dressStudioSurfaces,
		labelSketchbook,
		loadSketchbookCloth
	} from '#lib/features/home-entry-scene/scene/studio-surfaces.js';
	import { paintSketchbookLabel } from '#lib/features/home-entry-scene/scene/sketchbook-label.js';
	import { studioZoomScale } from '#lib/features/home-entry-scene/scene/studio-framing.js';
	import {
		DEFAULT_CAMERA,
		LEVEL,
		RESTING_CAMERA,
		STUDIO_MODEL_PLACEMENT
	} from '#lib/features/home-entry-scene/scene/studio-pose.js';
	import {
		deskSnapshotCameraPose,
		findSideTableBook,
		handoffCameraPose,
		type SideTableBook
	} from '#lib/features/home-entry-scene/scene/studio-handoff-pose.js';
	import { SIDE_TABLE_BOOK_STRETCH } from '#lib/features/shared-ui/studio-handoff.js';
	import { prefersReducedMotion } from '#lib/features/home-entry-scene/reduced-motion.js';
	import type { EntryFlowState } from '#lib/features/home-entry-scene/state/entry-state.svelte.js';

	type StudioSceneMediaState = 'error' | 'loaded' | 'pending';

	let {
		entryState = 'outside',
		initialPose = 'default',
		scenePose = 'default',
		artworkSlots = [],
		avatarUrl = null,
		deskSnapshot = false,
		dpr = 1.5,
		onMediaStateChange

		/*
		 * The loading card lives in HomeEntryPage, not here: this component is
		 * imported lazily so three.js stays off the home critical path, and the
		 * card has to be on screen from first paint — before this chunk lands.
		 */
	}: {
		entryState?: EntryFlowState;
		initialPose?: 'default' | 'left-wall' | 'top-close';
		scenePose?: 'default' | 'left-wall' | 'top-close';
		artworkSlots?: HomeSceneArtworkSlot[];
		avatarUrl?: string | null;
		/**
		 * Holds the camera where the studio's desk is rendered from
		 * (scripts/render-studio-desk.ts), with the side table's book left out.
		 */
		deskSnapshot?: boolean;
		dpr?: number;
		onMediaStateChange?: (state: StudioSceneMediaState) => void;
	} = $props();

	let sceneMediaState = $state<StudioSceneMediaState>('pending');

	const setSceneMediaState = (state: StudioSceneMediaState) => {
		sceneMediaState = state;
		onMediaStateChange?.(state);
	};

	const LEFT_WALL_CAMERA = {
		...LEVEL,
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
	/*
	 * The Studio move ends on the side table's sketchbook, lying on the spot
	 * the studio page lays its own (studio-handoff-pose.ts). Its zoom is set in
	 * screen pixels for this window, so it is handed over divided by the scale
	 * every other pose is drawn at.
	 */
	const topCloseCamera = (width: number, height: number) => {
		const { pixelsPerUnit, ...pose } = handoffCameraPose(width, height);
		return {
			...pose,
			bookStretch: SIDE_TABLE_BOOK_STRETCH,
			zoom: pixelsPerUnit / studioZoomScale(width, height)
		};
	};
	const deskSnapshotCamera = () => {
		const { pixelsPerUnit, ...pose } = deskSnapshotCameraPose();
		return { ...pose, bookStretch: 1, zoom: pixelsPerUnit };
	};
	const initialPoseValue = untrack(() => initialPose);
	const snapshot = untrack(() => deskSnapshot);
	const initialCamera = snapshot
		? deskSnapshotCamera()
		: initialPoseValue === 'left-wall'
			? LEFT_WALL_CAMERA
			: initialPoseValue === 'top-close'
				? topCloseCamera(browser ? window.innerWidth : 0, browser ? window.innerHeight : 0)
				: DEFAULT_CAMERA;

	/*
	 * The backdrop and the fog go to threlte as instances, not as <T.Color> and
	 * <T.Fog>: threlte only builds a class whose source starts with "class ", and
	 * the production build minifies both to anonymous classes ("class{"), so it
	 * attached the classes themselves and the room stood on a white clear.
	 */
	const backdrop = new Color('#d7c2a8');
	// It only softens the far corners; starting at 14 it washed the whole room,
	// which sits about 16 from the camera.
	const fog = new Fog('#d7c2a8', 26, 48);

	let studioCamera = $state<OrthographicCamera | undefined>(undefined);
	let sceneWidth = $state(0);
	let sceneHeight = $state(0);
	let studioNodes = $state<Record<string, Object3D>>({});
	let studioSceneRoot = $state<Group | null>(null);
	let sideTableBook: SideTableBook | null = null;
	let previousScenePose: 'default' | 'left-wall' | 'top-close' | undefined = initialPoseValue;
	let holdingInitialPose = snapshot || initialPoseValue !== 'default';
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
		rotationY: initialCamera.rotationY,
		roll: initialCamera.roll,
		shiftY: initialCamera.shiftY,
		bookStretch: initialCamera.bookStretch
	};
	const studioDracoLoader = browser ? getStudioDracoLoader() : undefined;
	const sceneReady = $derived(sceneMediaState === 'loaded');

	let invalidateFrame: (() => void) | undefined;

	/*
	 * The sketchbook on the side table wears the studio sketchbook's cloth, wear
	 * and label. It starts plain; each image asks for a frame as it arrives, and
	 * one that arrives after the room is gone is let go.
	 */
	const sketchbook = createSketchbookCloth();
	let sketchbookGone = false;
	const releaseSketchbook = () => {
		for (const uniform of Object.values(sketchbook)) uniform.value.dispose();
	};
	const showSketchbook = () => {
		if (sketchbookGone) releaseSketchbook();
		else invalidateFrame?.();
	};
	if (browser) {
		void loadSketchbookCloth(
			sketchbook,
			{ cloth: bookclothUrl, wear: coverWearUrl },
			new TextureLoader()
		).then(showSketchbook);
		void paintSketchbookLabel(document).then((label) => {
			if (!label) return;
			labelSketchbook(sketchbook, label);
			showSketchbook();
		});
	}
	$effect(() => () => {
		sketchbookGone = true;
		releaseSketchbook();
	});

	/**
	 * Applies studioMotion straight onto the three.js objects and requests a
	 * single frame. Routing this through Svelte state would invalidate the
	 * effect graph nine times per animation frame while GSAP drives the tween.
	 */
	const applyStudioMotion = () => {
		const camera = studioCamera;
		const sceneRoot = studioSceneRoot;

		if (camera) {
			camera.position.set(
				studioMotion.cameraX,
				studioMotion.cameraHeight,
				studioMotion.cameraDepth
			);
			// The desk is rendered at the zoom the studio measures it by, on any window.
			camera.zoom = snapshot
				? studioMotion.zoom
				: studioMotion.zoom * studioZoomScale(sceneWidth, sceneHeight);
			camera.updateProjectionMatrix();
			camera.lookAt(studioMotion.targetX, studioMotion.targetY, studioMotion.targetZ);
			camera.rotateZ(studioMotion.roll);
			camera.translateY(studioMotion.shiftY);
		}

		sceneRoot?.rotation.set(studioMotion.rotationX, studioMotion.rotationY, 0);
		sideTableBook?.stretch(studioMotion.bookStretch);

		if (camera || sceneRoot) {
			invalidateFrame?.();
		}
	};

	/** Cut straight to a pose. Used for reduced motion and for the outside snap. */
	const snapStudioMotion = (camera: typeof studioMotion) => {
		gsap.set(studioMotion, camera);
		// untrack: applyStudioMotion reads studioCamera/studioSceneRoot, which must
		// not become dependencies of the pose effect.
		untrack(applyStudioMotion);
	};

	/**
	 * Re-sync once the camera binds, the GLTF scene finishes loading mid-tween,
	 * or the screen changes size.
	 */
	$effect(() => {
		void studioCamera;
		void studioSceneRoot;
		void sceneWidth;
		void sceneHeight;
		applyStudioMotion();
	});

	/*
	 * Teardown-only effect. It must NOT live on the pose effect: that one has
	 * branches which deliberately return before killing the running timeline (the
	 * holdingInitialPose hold), so a teardown-based kill there would cut those
	 * animations short on an unrelated re-run. Without this, leaving home mid-move
	 * left a 3.3s camera timeline writing into a detached three.js camera and
	 * invalidating a torn-down render loop.
	 */
	$effect(() => () => {
		activeSceneTimeline?.kill();
		activeSceneTimeline = null;
		gsap.killTweensOf(studioMotion);
		invalidateFrame = undefined;
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

		const reducedMotion = prefersReducedMotion();

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

			if (reducedMotion) {
				snapStudioMotion(LEFT_WALL_CAMERA);
				return;
			}

			activeSceneTimeline = gsap
				.timeline()
				.to(studioMotion, {
					rotationY: 0,
					duration: LEFT_WALL_ROTATE_DURATION,
					ease: 'power3.inOut',
					onUpdate: applyStudioMotion
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
					onUpdate: applyStudioMotion
				});

			return;
		}

		if (isTopClosePose && isInside) {
			previousScenePose = scenePose;
			const topClose = untrack(() => topCloseCamera(sceneWidth, sceneHeight));

			if (reducedMotion) {
				snapStudioMotion(topClose);
				return;
			}

			activeSceneTimeline = gsap.to(studioMotion, {
				...topClose,
				duration: TOP_CLOSE_ENTER_DURATION,
				ease: 'power3.inOut',
				onUpdate: applyStudioMotion
			});

			return;
		}

		if (isLeavingLeftWall && isInside) {
			previousScenePose = scenePose;

			if (reducedMotion) {
				snapStudioMotion(RESTING_CAMERA);
				return;
			}

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
					onUpdate: applyStudioMotion
				})
				.to(studioMotion, {
					rotationY: -Math.PI / 4,
					duration: LEFT_WALL_EXIT_ROTATE_DURATION,
					ease: 'power3.inOut',
					onUpdate: applyStudioMotion
				});

			return;
		}

		if (isLeavingTopClose && isInside) {
			previousScenePose = scenePose;

			if (reducedMotion) {
				snapStudioMotion(RESTING_CAMERA);
				return;
			}

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
					...LEVEL,
					duration: TOP_CLOSE_EXIT_DURATION,
					ease: 'power3.inOut',
					onUpdate: applyStudioMotion
				})
				.to(studioMotion, {
					rotationY: -Math.PI / 4,
					duration: 0.8,
					ease: 'power3.inOut',
					onUpdate: applyStudioMotion
				});

			return;
		}

		if (entryState === 'transitioning-out') {
			previousScenePose = scenePose;

			if (reducedMotion) {
				snapStudioMotion(DEFAULT_CAMERA);
				return;
			}

			activeSceneTimeline = gsap.to(studioMotion, {
				...DEFAULT_CAMERA,
				duration: RESET_DURATION,
				ease: 'power3.out',
				onUpdate: applyStudioMotion
			});

			return;
		}

		if (!isInside) {
			previousScenePose = scenePose;
			snapStudioMotion(DEFAULT_CAMERA);
			return;
		}

		previousScenePose = scenePose;

		if (reducedMotion) {
			snapStudioMotion(RESTING_CAMERA);
			return;
		}

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
				onUpdate: applyStudioMotion
			})
			.to(
				studioMotion,
				{
					rotationY: -Math.PI / 4,
					duration: ENTER_DURATION - 0.55,
					ease: 'power3.inOut',
					onUpdate: applyStudioMotion
				},
				0.55
			);
	});
</script>

<div
	bind:clientWidth={sceneWidth}
	bind:clientHeight={sceneHeight}
	class={`h-full w-full transition-opacity duration-500 ${sceneReady ? 'opacity-100' : 'opacity-0'}`}
>
	<Canvas {dpr} shadows={studioCanvasShadowMap}>
		<T.OrthographicCamera
			bind:ref={studioCamera}
			makeDefault
			position={[initialCamera.cameraX, initialCamera.cameraHeight, initialCamera.cameraDepth]}
			zoom={initialCamera.zoom}
			oncreate={(camera) =>
				camera.lookAt(initialCamera.targetX, initialCamera.targetY, initialCamera.targetZ)}
		/>
		<SceneFrameInvalidator
			onready={(invalidate) => {
				invalidateFrame = invalidate;
			}}
		/>
		<SceneContextRelease />
		<T is={backdrop} attach="background" />
		<T is={fog} attach="fog" />
		<T.AmbientLight intensity={0.08} />
		<!-- A warm sky and a wood-brown floor bounce, so the shaded sides keep their colour. -->
		<T.HemisphereLight args={['#fff1dc', '#6b4f3a', 0.55]} />
		<T.DirectionalLight position={[5, 16, 6]} intensity={1.25} color="#fff0da" castShadow />
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
			url={STUDIO_MODEL_URL}
			scale={STUDIO_MODEL_PLACEMENT.scale}
			position={STUDIO_MODEL_PLACEMENT.position}
			rotation={[initialCamera.rotationX, initialCamera.rotationY, 0]}
			castShadow
			receiveShadow
			onload={() => {
				if (studioSceneRoot) {
					dressStudioSurfaces(studioSceneRoot, sketchbook);
					sideTableBook = findSideTableBook(studioSceneRoot);
					if (snapshot) sideTableBook.hide();
					applyStudioMotion();
				}
				setSceneMediaState('loaded');
			}}
			onerror={() => {
				setSceneMediaState('error');
			}}
		/>
		<T.Mesh rotation={[-Math.PI / 2, 0, 0.5]} position={[0, -2.62, 0]} receiveShadow>
			<T.CircleGeometry args={[18, 48]} />
			<T.ShadowMaterial transparent opacity={0.2} />
		</T.Mesh>
	</Canvas>
</div>
