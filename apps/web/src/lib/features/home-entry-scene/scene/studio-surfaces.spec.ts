import {
	BoxGeometry,
	Group,
	Mesh,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	NoColorSpace,
	RepeatWrapping,
	ShaderLib,
	Texture,
	type WebGLProgramParametersWithUniforms,
	type WebGLRenderer
} from 'three';
import { describe, expect, it } from 'vitest';
import { createSketchbookCloth, dressStudioSurfaces, loadSketchbookCloth } from './studio-surfaces';

// The studio model is flat colour, and only its floor carries UVs: the
// furniture, walls and curtains get their wood, plaster and cloth from a
// pattern woven into their own shader.

const piece = (
	materialName: string,
	Material: typeof MeshPhysicalMaterial | typeof MeshStandardMaterial = MeshPhysicalMaterial
) => {
	const material = new Material();
	material.name = materialName;
	return new Mesh(new BoxGeometry(), material);
};

const surfaceOf = (mesh: Mesh) => (mesh.material as MeshPhysicalMaterial).customProgramCacheKey();

/** Runs a dressed material's shader hook on three's own shader, as the renderer would. */
const compile = (mesh: Mesh, library: (typeof ShaderLib)['physical']) => {
	const shader = {
		fragmentShader: library.fragmentShader,
		uniforms: {},
		vertexShader: library.vertexShader
	} as unknown as WebGLProgramParametersWithUniforms;
	(mesh.material as MeshStandardMaterial).onBeforeCompile(shader, {} as WebGLRenderer);
	return shader;
};

describe('the studio model’s surfaces', () => {
	it('gives wood, plaster, cloth and clay to the pieces made of them and leaves the rest as modelled', () => {
		const table = piece('tahta');
		const frame = piece('tablo.004');
		const cabinet = piece('koyumavi');
		const wall = piece('duvar');
		const curtain = piece('perde');
		const pot = piece('saks');
		const bin = piece('metal');
		// The sketchbook on the side table, which the camera closes in on before
		// the studio's own sketchbook takes over: its cover, and the pages' edge.
		const sketchbook = piece('Architexture.001');
		const pages = piece('Bookpage.001');
		const room = new Group().add(table, frame, cabinet, wall, curtain, pot, bin, sketchbook, pages);

		dressStudioSurfaces(room);

		expect(surfaceOf(table)).toBe('studio-surface-wood');
		expect(surfaceOf(frame)).toBe('studio-surface-wood');
		expect(surfaceOf(cabinet)).toBe('studio-surface-paintedWood');
		expect(surfaceOf(wall)).toBe('studio-surface-plaster');
		expect(surfaceOf(curtain)).toBe('studio-surface-fabric');
		expect(surfaceOf(pot)).toBe('studio-surface-clay');
		expect(surfaceOf(sketchbook)).toBe('studio-surface-sketchbookCover');
		expect(surfaceOf(pages)).toBe('studio-surface-pages');
		expect(surfaceOf(bin)).not.toMatch(/^studio-surface/);
	});

	it('weaves its pattern into three’s own shaders, which it has to find its way into', () => {
		for (const [Material, library] of [
			[MeshPhysicalMaterial, ShaderLib.physical],
			[MeshStandardMaterial, ShaderLib.standard]
		] as const) {
			const wall = piece('duvar', Material);
			dressStudioSurfaces(new Group().add(wall));
			const shader = compile(wall, library);

			expect(shader.vertexShader).toContain('vSurfacePos = ');
			expect(shader.fragmentShader).toContain('diffuseColor.rgb *= shade');
		}
	});
});

// The camera closes in on the side table's sketchbook and hands over to the
// studio's own, so the 3D one wears the same bookcloth, wear and label.
describe('the sketchbook on the side table', () => {
	it('wears the studio sketchbook’s bookcloth, wear and label, in either of three’s shaders', () => {
		for (const [Material, library] of [
			[MeshPhysicalMaterial, ShaderLib.physical],
			[MeshStandardMaterial, ShaderLib.standard]
		] as const) {
			const sketchbook = createSketchbookCloth();
			const cover = piece('Architexture.001', Material);
			dressStudioSurfaces(new Group().add(cover), sketchbook);

			const { uniforms } = compile(cover, library);

			expect(uniforms.sketchbookCloth).toBe(sketchbook.cloth);
			expect(uniforms.sketchbookWear).toBe(sketchbook.wear);
			expect(uniforms.sketchbookLabel).toBe(sketchbook.label);
		}
	});

	it('takes the cloth and the wear once they arrive, the cloth repeating across the cover', async () => {
		const sketchbook = createSketchbookCloth();
		const tile = new Texture();
		const wear = new Texture();
		const loader = {
			loadAsync: async (url: string) => (url === '/bookcloth.webp' ? tile : wear)
		};

		await loadSketchbookCloth(sketchbook, { cloth: '/bookcloth.webp', wear: '/wear.webp' }, loader);

		expect(sketchbook.cloth.value).toBe(tile);
		expect(sketchbook.wear.value).toBe(wear);
		expect([tile.wrapS, tile.wrapT]).toEqual([RepeatWrapping, RepeatWrapping]);
		// Mixed as stored, the way the browser composites the CSS cover's layers.
		expect([tile.colorSpace, wear.colorSpace]).toEqual([NoColorSpace, NoColorSpace]);
	});

	it('keeps a plain cloth, and the room loading, when the images never arrive', async () => {
		const sketchbook = createSketchbookCloth();
		const plainCloth = sketchbook.cloth.value;
		const noWear = sketchbook.wear.value;
		const loader = {
			loadAsync: async () => {
				throw new Error('offline');
			}
		};

		await expect(
			loadSketchbookCloth(sketchbook, { cloth: '/bookcloth.webp', wear: '/wear.webp' }, loader)
		).resolves.toBeUndefined();

		expect(sketchbook.cloth.value).toBe(plainCloth);
		expect(sketchbook.wear.value).toBe(noWear);
	});
});
