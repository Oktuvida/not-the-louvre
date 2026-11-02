import {
	BoxGeometry,
	Group,
	Mesh,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	ShaderLib,
	type WebGLProgramParametersWithUniforms,
	type WebGLRenderer
} from 'three';
import { describe, expect, it } from 'vitest';
import { dressStudioSurfaces } from './studio-surfaces';

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

describe('the studio model’s surfaces', () => {
	it('gives wood, plaster, cloth and clay to the pieces made of them and leaves the rest as modelled', () => {
		const table = piece('tahta');
		const frame = piece('tablo.004');
		const cabinet = piece('koyumavi');
		const wall = piece('duvar');
		const curtain = piece('perde');
		const pot = piece('saks');
		const bin = piece('metal');
		const room = new Group().add(table, frame, cabinet, wall, curtain, pot, bin);

		dressStudioSurfaces(room);

		expect(surfaceOf(table)).toBe('studio-surface-wood');
		expect(surfaceOf(frame)).toBe('studio-surface-wood');
		expect(surfaceOf(cabinet)).toBe('studio-surface-paintedWood');
		expect(surfaceOf(wall)).toBe('studio-surface-plaster');
		expect(surfaceOf(curtain)).toBe('studio-surface-fabric');
		expect(surfaceOf(pot)).toBe('studio-surface-clay');
		expect(surfaceOf(bin)).not.toMatch(/^studio-surface/);
	});

	it('weaves its pattern into three’s own shaders, which it has to find its way into', () => {
		for (const [Material, library] of [
			[MeshPhysicalMaterial, ShaderLib.physical],
			[MeshStandardMaterial, ShaderLib.standard]
		] as const) {
			const wall = piece('duvar', Material);
			dressStudioSurfaces(new Group().add(wall));
			const shader = {
				fragmentShader: library.fragmentShader,
				uniforms: {},
				vertexShader: library.vertexShader
			} as unknown as WebGLProgramParametersWithUniforms;

			(wall.material as MeshStandardMaterial).onBeforeCompile(shader, {} as WebGLRenderer);

			expect(shader.vertexShader).toContain('vSurfacePos = ');
			expect(shader.fragmentShader).toContain('diffuseColor.rgb *= shade');
		}
	});
});
