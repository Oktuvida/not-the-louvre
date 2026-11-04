/// <reference types="node" />

import { statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { Euler, Matrix4, OrthographicCamera, Quaternion, Vector3 } from 'three';
import {
	chainStrokes,
	depthBuffer,
	featureEdges,
	sketchSvg,
	visibleRuns,
	type ProjectedMesh
} from '../src/lib/features/home-entry-scene/scene/room-sketch';
import {
	COMPOSED_FOR,
	SKETCH_FRAME
} from '../src/lib/features/home-entry-scene/scene/studio-framing';
import {
	RESTING_CAMERA,
	STUDIO_MODEL_PLACEMENT
} from '../src/lib/features/home-entry-scene/scene/studio-pose';

/*
 * The home page's studio, drawn in pencil from the model it loads
 * (`src/lib/assets/studio-model/studio.glb`), as the resting camera sees it on
 * the screen every pose was composed on. The page shows the drawing where the
 * room will stand while three.js and the model are on their way, and the room
 * fades in over it.
 *
 * Run it with `bun run studio:sketch` after `model:transform:studio`, or when
 * the resting pose changes. The drawing is committed: like the studio's desk,
 * a design asset to review by eye.
 */

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, '..');
const modelPath = resolve(appRoot, 'src/lib/assets/studio-model/studio.glb');
const outputPath = resolve(appRoot, 'src/lib/assets/studio-model/studio-sketch.svg');

/** Folds sharper than this are drawn; gentler ones are the shading of a curve. */
const CREASE_DEGREES = 30;
/** Raster pixels per composition pixel for the hidden-line test. */
const RASTER_SCALE = 2;
/** How far behind the nearest surface, in scene units, an edge still shows. */
const DEPTH_TOLERANCE = 0.3;
/** Strokes shorter than this, in composition pixels, are crumbs. */
const SHORTEST_STROKE = 4;

const pose = RESTING_CAMERA;
const camera = new OrthographicCamera(
	-COMPOSED_FOR.width / 2,
	COMPOSED_FOR.width / 2,
	COMPOSED_FOR.height / 2,
	-COMPOSED_FOR.height / 2,
	0.1,
	1000
);
camera.position.set(pose.cameraX, pose.cameraHeight, pose.cameraDepth);
camera.zoom = pose.zoom;
camera.updateProjectionMatrix();
camera.lookAt(pose.targetX, pose.targetY, pose.targetZ);
camera.rotateZ(pose.roll);
camera.translateY(pose.shiftY);
camera.updateMatrixWorld();

const placement = new Matrix4().compose(
	new Vector3(...STUDIO_MODEL_PLACEMENT.position),
	new Quaternion().setFromEuler(new Euler(pose.rotationX, pose.rotationY, 0)),
	new Vector3().setScalar(STUDIO_MODEL_PLACEMENT.scale)
);

const io = new NodeIO()
	.registerExtensions(ALL_EXTENSIONS)
	.registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const document = await io.read(modelPath);

const meshes: ProjectedMesh[] = [];
for (const node of document.getRoot().listNodes()) {
	const mesh = node.getMesh();
	if (!mesh) continue;
	const toView = new Matrix4()
		.fromArray(node.getWorldMatrix())
		.premultiply(placement)
		.premultiply(camera.matrixWorldInverse);

	for (const primitive of mesh.listPrimitives()) {
		// Only triangles make surfaces.
		if (primitive.getMode() !== 4) continue;
		const positions = primitive.getAttribute('POSITION');
		if (!positions) continue;
		const count = positions.getCount();
		const indices = primitive.getIndices();
		const projected: ProjectedMesh = {
			depth: new Float64Array(count),
			triangles: indices
				? Uint32Array.from({ length: indices.getCount() }, (_, k) => indices.getScalar(k))
				: Uint32Array.from({ length: count }, (_, k) => k),
			weld: new Int32Array(count),
			x: new Float64Array(count),
			y: new Float64Array(count)
		};
		const spots = new Map<string, number>();
		const local = [0, 0, 0];
		const seen = new Vector3();
		for (let k = 0; k < count; k++) {
			positions.getElement(k, local);
			const spot = local.map((value) => value.toFixed(4)).join(',');
			if (!spots.has(spot)) spots.set(spot, spots.size);
			(projected.weld as Int32Array)[k] = spots.get(spot)!;

			seen.fromArray(local).applyMatrix4(toView);
			projected.x[k] = COMPOSED_FOR.width / 2 + seen.x * pose.zoom;
			projected.y[k] = COMPOSED_FOR.height / 2 - seen.y * pose.zoom;
			projected.depth[k] = -seen.z * pose.zoom;
		}
		meshes.push(projected);
	}
}

const buffer = depthBuffer(meshes, SKETCH_FRAME, RASTER_SCALE);
const segments = meshes.flatMap((mesh) =>
	visibleRuns(mesh, featureEdges(mesh, CREASE_DEGREES), buffer, DEPTH_TOLERANCE * pose.zoom)
);
const strokes = chainStrokes(segments, SHORTEST_STROKE);
writeFileSync(outputPath, sketchSvg(strokes, SKETCH_FRAME));

console.log(
	`${meshes.length} surfaces -> ${strokes.length} strokes, src/lib/assets/studio-model/studio-sketch.svg (${Math.round(statSync(outputPath).size / 1024)} KB)`
);
