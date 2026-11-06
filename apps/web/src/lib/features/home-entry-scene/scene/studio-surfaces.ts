import {
	DataTexture,
	NoColorSpace,
	RepeatWrapping,
	type MeshStandardMaterial,
	type Material,
	type Mesh,
	type Object3D,
	type Texture
} from 'three';
import { SKETCHBOOK_COVER } from '#lib/features/shared-ui/sketchbook/cover.js';

/*
 * The studio model is flat colour, and only its floor carries UVs, so an image
 * texture has nowhere to go. Its wood, plaster, cloth and clay come instead
 * from a pattern woven into each material's own shader: projected from the
 * world position along the face's dominant axis, it needs no UVs and no image,
 * and adds nothing to download.
 *
 * The one exception is the sketchbook on the side table. The camera closes in
 * on it until the studio's own sketchbook takes over, so it wears that book's
 * bookcloth and wear (shared-ui/sketchbook) and its label, laid on through
 * coordinates worked out from the cover's own shape.
 */

/** The sketchbook's images, as shader uniforms whose textures can arrive later. */
export type SketchbookCloth = {
	cloth: { value: Texture };
	label: { value: Texture };
	wear: { value: Texture };
};

const solid = (rgba: [number, number, number, number]) => {
	const texture = new DataTexture(new Uint8Array(rgba), 1, 1);
	texture.needsUpdate = true;
	return texture;
};

/**
 * The sketchbook's uniforms, until its images arrive (and for good if they
 * never do): the cloth's plain colour, no wear, a blank label.
 */
export const createSketchbookCloth = (): SketchbookCloth => ({
	cloth: { value: solid([184, 170, 143, 255]) },
	label: { value: solid([237, 224, 195, 255]) },
	wear: { value: solid([0, 0, 0, 0]) }
});

type TextureSource = { loadAsync: (url: string) => Promise<Texture> };

/**
 * Loads the bookcloth tile and the cover's wear into the sketchbook's
 * uniforms. Both are mixed as stored, in sRGB, the way the browser composites
 * the CSS cover's layers; the shader turns the result to linear light. A
 * failed image keeps its plain stand-in, and never fails the room.
 */
export const loadSketchbookCloth = async (
	sketchbook: SketchbookCloth,
	urls: { cloth: string; wear: string },
	loader: TextureSource
) => {
	const [cloth, wear] = await Promise.allSettled([
		loader.loadAsync(urls.cloth),
		loader.loadAsync(urls.wear)
	]);
	if (cloth.status === 'fulfilled') {
		cloth.value.wrapS = RepeatWrapping;
		cloth.value.wrapT = RepeatWrapping;
		cloth.value.colorSpace = NoColorSpace;
		cloth.value.anisotropy = 4;
		sketchbook.cloth.value = cloth.value;
	}
	if (wear.status === 'fulfilled') {
		wear.value.colorSpace = NoColorSpace;
		sketchbook.wear.value = wear.value;
	}
};

/** Gives the sketchbook its painted label, in place of the blank one. */
export const labelSketchbook = (sketchbook: SketchbookCloth, label: Texture) => {
	label.colorSpace = NoColorSpace;
	label.anisotropy = 4;
	sketchbook.label.value = label;
};

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

/** A number as GLSL reads it. */
const glsl = (value: number) => value.toFixed(5);

/*
 * The side table's sketchbook, in its mesh's own units: the cover runs from
 * x = 0.0388 at the spine to 0.7727 at the fore-edge and from y = -0.5 at the
 * tail to 0.5 at the head, the front board faces +z, and with the node's
 * scale the board measures 0.6585 across and 0.7484 along.
 */
const BOOK = { across: 0.6585, along: 0.7484, scaleZ: 0.8973, spineX: 0.0388, widthX: 0.7339 };
const { elastic, label, tile } = SKETCHBOOK_COVER;

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
	// The studio's own sketchbook: its bookcloth and wear, the label and the thin
	// elastic, placed as on the desk's CSS cover. u runs across the cover from
	// the spine, v along it from the tail; colours mix in sRGB, as the browser
	// mixes the CSS cover's layers, and turn to linear light at the end.
	sketchbookCover: /* glsl */ `
	float u = clamp((vSurfaceLocal.x - ${glsl(BOOK.spineX)}) / ${glsl(BOOK.widthX)}, 0.0, 1.0);
	float v = clamp(vSurfaceLocal.y + 0.5, 0.0, 1.0);
	vec3 facing = abs(normalize(vSurfaceLocalNormal));
	vec2 board = vec2(u * ${glsl(BOOK.across)}, v * ${glsl(BOOK.along)});
	// Over the boards' edges the cloth runs on round their thickness.
	vec2 weave = board;
	if (facing.z < 0.6) {
		float round = vSurfaceLocal.z * ${glsl(BOOK.scaleZ)};
		weave = facing.x > facing.y ? vec2(round, board.y) : vec2(board.x, round);
	}
	// The tile starts at the head, as on the desk.
	vec3 cover = texture2D(sketchbookCloth, (weave - vec2(0.0, ${glsl(BOOK.along)})) / ${glsl(tile * BOOK.across)}).rgb;
	vec4 wear = texture2D(sketchbookWear, vec2(u, v));
	cover = mix(cover, wear.rgb, wear.a);

	if (normalize(vSurfaceLocalNormal).z > 0.6) {
		// The label, glued on a little crooked, a hairline of shadow under it.
		vec2 halfLabel = vec2(${glsl((label.width * BOOK.across) / 2)}, ${glsl((label.height * BOOK.across) / 2)});
		vec2 fromLabel = board - vec2(${glsl(label.centre * BOOK.across)}, ${glsl(label.foot * BOOK.along)} + halfLabel.y);
		float turn = radians(${glsl(label.turn)});
		fromLabel = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * fromLabel;
		vec2 outside = abs(fromLabel + vec2(0.0, 0.0012)) - halfLabel;
		float gap = length(max(outside, 0.0)) + min(max(outside.x, outside.y), 0.0);
		cover *= 1.0 - 0.32 * (1.0 - smoothstep(-0.0006, 0.0032, gap));
		if (all(lessThan(abs(fromLabel), halfLabel))) {
			cover = texture2D(sketchbookLabel, fromLabel / (2.0 * halfLabel) + 0.5).rgb;
		}
	}

	// The thin elastic, round the head, the tail and both boards, and its shadow.
	float strap = (u - ${glsl(1 - elastic.fromEdge)}) / ${glsl(elastic.width / 2)};
	if (facing.x < 0.6) {
		if (abs(strap) < 1.0) {
			float rib = step(0.67, fract(weave.y * ${glsl(1 / (0.004 * BOOK.across))}));
			cover = vec3(0.169, 0.137, 0.114) * (1.0 + 0.1 * rib) * (1.0 - 0.35 * smoothstep(0.5, 1.0, strap));
		} else if (strap > 1.0) {
			cover *= 1.0 - 0.45 * (1.0 - smoothstep(1.0, 2.3, strap));
		}
	}

	// The room's lamp and tone mapping flatten the book, its linen darker and
	// its dark cloth lighter than on the desk; stretched back here, so the zoom
	// hands over a book of the same colour.
	cover = clamp((cover - 0.5) * 1.6 + 0.55, 0.0, 1.0);
	diffuseColor.rgb = pow(cover, vec3(2.2));
	float shade = 1.0;`,
	// Cream paper on the faces, fine page lines along the edges, as the desk's.
	pages: /* glsl */ `
	float side = 1.0 - step(0.6, abs(normalize(vSurfaceLocalNormal).z));
	float line = step(0.55, fract((vSurfaceLocal.z + 0.08) * 420.0));
	diffuseColor.rgb = pow(vec3(0.925, 0.89, 0.815), vec3(2.2)) * (1.0 - side * line * 0.16);
	float shade = 1.0;`
};

// The images only the sketchbook's cover samples.
const UNIFORMS: Partial<Record<Surface, string>> = {
	sketchbookCover: /* glsl */ `
uniform sampler2D sketchbookCloth;
uniform sampler2D sketchbookWear;
uniform sampler2D sketchbookLabel;
`
};

const dress = (material: Material, surface: Surface, sketchbook: SketchbookCloth) => {
	material.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>\n${VARYINGS}`)
			.replace(
				'#include <begin_vertex>',
				'#include <begin_vertex>\nvSurfacePos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSurfaceNormal = normalize(mat3(modelMatrix) * objectNormal);\nvSurfaceLocal = transformed;\nvSurfaceLocalNormal = objectNormal;'
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>\n${VARYINGS}${UNIFORMS[surface] ?? ''}${NOISE}`
			)
			.replace(
				'#include <color_fragment>',
				`#include <color_fragment>\n{${PATTERN[surface]}\n\tdiffuseColor.rgb *= shade;\n}`
			);
		if (surface === 'sketchbookCover') {
			shader.uniforms.sketchbookCloth = sketchbook.cloth;
			shader.uniforms.sketchbookWear = sketchbook.wear;
			shader.uniforms.sketchbookLabel = sketchbook.label;
		}
	};
	if (surface === 'sketchbookCover' && 'roughness' in material) {
		// Cloth, not a laminated board: no sheen under the lamp.
		(material as MeshStandardMaterial).roughness = 0.95;
	}
	// One compiled program per surface, shared by every piece made of it.
	material.customProgramCacheKey = () => `studio-surface-${surface}`;
	material.needsUpdate = true;
};

/**
 * Gives the model's wooden, plastered, cloth and clay pieces their surface,
 * and the side table's sketchbook the studio sketchbook's cloth.
 */
export const dressStudioSurfaces = (
	root: Object3D,
	sketchbook: SketchbookCloth = createSketchbookCloth()
) => {
	const dressed = new Set<Material>();
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh) return;
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			const surface = surfaceFor(material.name);
			if (!surface || dressed.has(material)) continue;
			dress(material, surface, sketchbook);
			dressed.add(material);
		}
	});
};
