import type { Material, Mesh, Object3D } from 'three';

/*
 * The studio model is flat colour, and only its floor carries UVs, so an image
 * texture has nowhere to go. Its wood, plaster, cloth and clay come instead
 * from a pattern woven into each material's own shader: projected from the
 * world position along the face's dominant axis, it needs no UVs and no image,
 * and adds nothing to download.
 */

type Surface = 'wood' | 'paintedWood' | 'plaster' | 'fabric' | 'clay';

// Keyed by the model's own (Turkish) material names.
const SURFACE_BY_MATERIAL: Record<string, Surface> = {
	tahta: 'wood',
	tahtapalet: 'wood',
	sehpa: 'wood',
	sandalye_tahta: 'wood',
	pencere: 'wood',
	koyumavi: 'paintedWood',
	duvar: 'plaster',
	'Architexture.001': 'plaster',
	perde: 'fabric',
	sandalye_koltuk: 'fabric',
	abajur: 'fabric',
	saks: 'clay',
	'saks.001': 'clay'
};

const surfaceFor = (materialName: string): Surface | null =>
	SURFACE_BY_MATERIAL[materialName] ?? (materialName.startsWith('tablo') ? 'wood' : null);

const NOISE = /* glsl */ `
varying vec3 vSurfacePos;
varying vec3 vSurfaceNormal;
float surfaceHash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float surfaceNoise(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(mix(surfaceHash(i), surfaceHash(i + vec3(1, 0, 0)), f.x),
			mix(surfaceHash(i + vec3(0, 1, 0)), surfaceHash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(surfaceHash(i + vec3(0, 0, 1)), surfaceHash(i + vec3(1, 0, 1)), f.x),
			mix(surfaceHash(i + vec3(0, 1, 1)), surfaceHash(i + vec3(1, 1, 1)), f.x), f.y),
		f.z);
}
float surfaceFbm(vec3 p) {
	float value = 0.0;
	float amplitude = 0.5;
	for (int octave = 0; octave < 4; octave++) {
		value += amplitude * surfaceNoise(p);
		p *= 2.03;
		amplitude *= 0.5;
	}
	return value;
}
vec2 surfacePlane(vec3 p, vec3 n) {
	vec3 a = abs(n);
	return a.x > a.y && a.x > a.z ? p.zy : (a.y > a.z ? p.xz : p.xy);
}
`;

// Each pattern sets `shade`, which multiplies the material's own colour.
const PATTERN: Record<Surface, string> = {
	wood: /* glsl */ `
	vec2 q = surfacePlane(vSurfacePos, vSurfaceNormal) * 2.2;
	float grain = sin((q.x + surfaceFbm(vec3(q * vec2(0.6, 5.0), 1.7)) * 2.2) * 9.0) * 0.5 + 0.5;
	float fine = surfaceFbm(vec3(q * vec2(1.0, 40.0), 3.1));
	float shade = mix(0.82, 1.12, grain * 0.7 + fine * 0.3);`,
	paintedWood: /* glsl */ `
	vec2 q = surfacePlane(vSurfacePos, vSurfaceNormal) * 2.2;
	float grain = sin((q.x + surfaceFbm(vec3(q * vec2(0.6, 5.0), 1.7)) * 2.2) * 9.0) * 0.5 + 0.5;
	float shade = mix(0.93, 1.05, grain) * mix(0.96, 1.03, surfaceFbm(vec3(q * 12.0, 0.4)));`,
	plaster: /* glsl */ `
	vec3 p = vSurfacePos * 1.6;
	float shade = mix(0.9, 1.06, surfaceFbm(p)) * mix(0.97, 1.02, surfaceNoise(p * 18.0));`,
	fabric: /* glsl */ `
	vec2 q = surfacePlane(vSurfacePos, vSurfaceNormal);
	float weave = sin(q.x * 140.0) * sin(q.y * 140.0) * 0.5 + 0.5;
	float folds = sin(q.x * 9.0 + surfaceNoise(vec3(q * 2.0, 0.0)) * 2.0) * 0.5 + 0.5;
	float shade = mix(0.82, 1.08, folds) * mix(0.95, 1.03, weave);`,
	clay: /* glsl */ `
	vec3 p = vSurfacePos * 3.0;
	float shade = mix(0.88, 1.08, surfaceFbm(p)) * mix(0.96, 1.03, surfaceNoise(p * 25.0));`
};

const dress = (material: Material, surface: Surface) => {
	material.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				'#include <common>\nvarying vec3 vSurfacePos;\nvarying vec3 vSurfaceNormal;'
			)
			.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>\nvSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSurfaceNormal = normalize(mat3(modelMatrix) * objectNormal);'
			);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>\n${NOISE}`)
			.replace(
				'#include <color_fragment>',
				`#include <color_fragment>\n{${PATTERN[surface]}\n\tdiffuseColor.rgb *= shade;\n}`
			);
	};
	// One compiled program per surface, shared by every piece made of it.
	material.customProgramCacheKey = () => `studio-surface-${surface}`;
	material.needsUpdate = true;
};

/** Gives the model's wooden, plastered, cloth and clay pieces their surface. */
export const dressStudioSurfaces = (root: Object3D) => {
	const dressed = new Set<Material>();
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh) return;
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			const surface = surfaceFor(material.name);
			if (!surface || dressed.has(material)) continue;
			dress(material, surface);
			dressed.add(material);
		}
	});
};
