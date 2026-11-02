import type { Material, Mesh, Object3D } from 'three';

/*
 * The studio model is flat colour, and only its floor carries UVs, so an image
 * texture has nowhere to go. Its wood, plaster, cloth and clay come instead
 * from a pattern woven into each material's own shader: projected from the
 * world position along the face's dominant axis, it needs no UVs and no image,
 * and adds nothing to download.
 */

type Surface = 'wood' | 'paintedWood' | 'plaster' | 'fabric' | 'clay' | 'sketchbookCover' | 'pages';

// Keyed by the model's own (Turkish) material names.
const SURFACE_BY_MATERIAL: Record<string, Surface> = {
	tahta: 'wood',
	tahtapalet: 'wood',
	sehpa: 'wood',
	sandalye_tahta: 'wood',
	pencere: 'wood',
	koyumavi: 'paintedWood',
	duvar: 'plaster',
	// The sketchbook on the side table: its cover, and the block of pages inside.
	'Architexture.001': 'sketchbookCover',
	'Bookpage.001': 'pages',
	perde: 'fabric',
	sandalye_koltuk: 'fabric',
	abajur: 'fabric',
	saks: 'clay',
	'saks.001': 'clay'
};

const surfaceFor = (materialName: string): Surface | null =>
	SURFACE_BY_MATERIAL[materialName] ?? (materialName.startsWith('tablo') ? 'wood' : null);

const VARYINGS = /* glsl */ `
varying vec3 vSurfacePos;
varying vec3 vSurfaceNormal;
varying vec3 vSurfaceLocal;
varying vec3 vSurfaceLocalNormal;
`;

const NOISE = /* glsl */ `
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

// Each pattern sets `shade`, which multiplies the material's own colour; the
// sketchbook's patterns paint their own colours (in linear light, as the
// shader works) and leave `shade` at 1.
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
	float shade = mix(0.88, 1.08, surfaceFbm(p)) * mix(0.96, 1.03, surfaceNoise(p * 25.0));`,
	// The studio's own sketchbook, in the model's units: across the cover (u)
	// and along it (v). Linen with a dark spine, the orange strap, the label.
	sketchbookCover: /* glsl */ `
	float u = clamp((vSurfaceLocal.x - 0.0388) / 0.7339, 0.0, 1.0);
	float v = clamp(vSurfaceLocal.y + 0.5, 0.0, 1.0);
	vec3 cover = pow(vec3(0.847, 0.812, 0.753), vec3(2.2));
	cover *= 1.0 + 0.012 * (sin(u * 260.0) + sin(v * 340.0));
	cover *= mix(0.97, 1.02, surfaceNoise(vec3(u, v, 0.0) * 40.0));
	if (u < 0.06) cover = pow(vec3(0.165, 0.133, 0.106), vec3(2.2));
	if (abs(u - 0.9) < 0.012) cover = pow(vec3(0.831, 0.514, 0.29), vec3(2.2));
	if (u > 0.3 && u < 0.72 && v > 0.1 && v < 0.24) {
		cover = pow(vec3(0.984, 0.973, 0.949), vec3(2.2));
		if (abs(v - 0.19) < 0.006 && u > 0.38 && u < 0.64) cover = pow(vec3(0.176, 0.141, 0.125), vec3(2.2));
		if (abs(v - 0.145) < 0.004 && u > 0.44 && u < 0.58) cover = pow(vec3(0.541, 0.478, 0.4), vec3(2.2));
	}
	diffuseColor.rgb = cover;
	float shade = 1.0;`,
	// Cream paper on the faces, fine page lines along the edges.
	pages: /* glsl */ `
	float side = 1.0 - step(0.6, abs(normalize(vSurfaceLocalNormal).z));
	float line = step(0.55, fract((vSurfaceLocal.z + 0.08) * 420.0));
	diffuseColor.rgb = pow(vec3(0.973, 0.957, 0.925), vec3(2.2)) * (1.0 - side * line * 0.14);
	float shade = 1.0;`
};

const dress = (material: Material, surface: Surface) => {
	material.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>\n${VARYINGS}`)
			.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>\nvSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSurfaceNormal = normalize(mat3(modelMatrix) * objectNormal);\nvSurfaceLocal = transformed;\nvSurfaceLocalNormal = objectNormal;'
			);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>\n${VARYINGS}${NOISE}`)
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
