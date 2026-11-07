import type { Mesh, Object3D } from 'three';
import { Vector3 } from 'three';
import {
	HANDOFF_BOOK_TILT,
	HANDOFF_REFERENCE_ZOOM,
	handoffBookRect,
	handoffZoom
} from '#lib/features/shared-ui/studio-handoff.js';

/*
 * Where the camera ends the Studio move: straight above the side table's
 * sketchbook, turned and zoomed so the book lies on the spot the studio page
 * lays its own closed book (shared-ui/studio-handoff.ts).
 *
 * The book's place is measured off the model with the room unturned: its
 * cover's centre on the floor plan, and how far it lies turned (anticlockwise
 * on screen, in degrees) under a camera whose top points away from the window.
 */
const SIDE_TABLE_BOOK_PLAN = { turn: 6.62, x: 1.73628, z: 0.66394 };
/** The camera hangs at this height and looks straight down to this one. */
const CAMERA_HEIGHT = 0;
const LOOK_DOWN_TO = -1.8;

export type HandoffCameraPose = {
	cameraX: number;
	cameraDepth: number;
	cameraHeight: number;
	targetX: number;
	targetY: number;
	targetZ: number;
	rotationX: number;
	rotationY: number;
	/** The camera's turn about its line of sight, in radians. */
	roll: number;
	/** How far the camera slides towards the top of the screen, in scene units. */
	shiftY: number;
	/** CSS px per scene unit. */
	pixelsPerUnit: number;
};

const pose = (pixelsPerUnit: number, shiftY: number): HandoffCameraPose => ({
	cameraDepth: SIDE_TABLE_BOOK_PLAN.z,
	cameraHeight: CAMERA_HEIGHT,
	cameraX: SIDE_TABLE_BOOK_PLAN.x,
	pixelsPerUnit,
	// Turning the camera one way turns the picture the other: this leaves the
	// book at the studio's slant instead of its own.
	roll: ((SIDE_TABLE_BOOK_PLAN.turn + HANDOFF_BOOK_TILT) * Math.PI) / 180,
	rotationX: 0,
	rotationY: 0,
	shiftY,
	targetX: SIDE_TABLE_BOOK_PLAN.x,
	targetY: LOOK_DOWN_TO,
	targetZ: SIDE_TABLE_BOOK_PLAN.z
});

/** The camera the studio's desk is rendered from: the same, at the reference zoom, on the book. */
export const deskSnapshotCameraPose = () => pose(HANDOFF_REFERENCE_ZOOM, 0);

/** The end of the Studio move on a scene this many CSS px across and down. */
export const handoffCameraPose = (width: number, height: number) => {
	if (width <= 0 || height <= 0) return deskSnapshotCameraPose();
	const rect = handoffBookRect(width, height);
	const pixelsPerUnit = handoffZoom(rect);
	return pose(pixelsPerUnit, (rect.cy - height / 2) / pixelsPerUnit);
};

/*
 * The book's two meshes (its cover, and the block of pages inside) share one
 * transform, in units where the cover runs from x = 0.0388 at the spine to
 * 0.7727 at the fore-edge. Stretching them across pivots on the cover's
 * middle, so the book widens about its centre and stays on its spot.
 */
const BOOK_MIDDLE_X = (0.0388 + 0.7727) / 2;
const BOOK_MATERIALS = new Set(['Architexture.001', 'Bookpage.001']);

type BookMesh = { mesh: Mesh; position: Vector3; scaleX: number };

/** The side table's sketchbook, ready to be widened or hidden. */
export const findSideTableBook = (root: Object3D) => {
	const meshes: BookMesh[] = [];
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh || Array.isArray(mesh.material)) return;
		if (!BOOK_MATERIALS.has(mesh.material.name)) return;
		meshes.push({ mesh, position: mesh.position.clone(), scaleX: mesh.scale.x });
	});

	const across = new Vector3();
	return {
		/** Draws the book this many times its own width. */
		stretch(amount: number) {
			for (const { mesh, position, scaleX } of meshes) {
				mesh.scale.x = scaleX * amount;
				across.set(scaleX * (amount - 1) * BOOK_MIDDLE_X, 0, 0).applyQuaternion(mesh.quaternion);
				mesh.position.copy(position).sub(across);
			}
		},
		hide() {
			for (const { mesh } of meshes) mesh.visible = false;
		}
	};
};

export type SideTableBook = ReturnType<typeof findSideTableBook>;
