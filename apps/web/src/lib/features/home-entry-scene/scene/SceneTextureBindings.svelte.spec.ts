import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three';
import SceneTextureBindings from './SceneTextureBindings.svelte';

const invalidate = vi.fn();
const loadAsync = vi.fn(async () => new Texture());

vi.mock('@threlte/core', () => ({
	useThrelte: () => ({ invalidate })
}));

vi.mock('three', async (importOriginal) => {
	const actual = await importOriginal<typeof import('three')>();

	class MockTextureLoader {
		loadAsync = loadAsync;
	}

	return {
		...actual,
		TextureLoader: MockTextureLoader
	};
});

describe('SceneTextureBindings', () => {
	beforeEach(() => {
		invalidate.mockReset();
		loadAsync.mockClear();
	});

	it('invalidates the Threlte canvas after applying a newly loaded avatar texture', async () => {
		const originalMaterial = new MeshBasicMaterial({ color: '#ffffff' });
		const avatarMesh = new Mesh(new PlaneGeometry(1, 1), originalMaterial);
		avatarMesh.name = 'avatar';
		const sceneRoot = new Group();
		sceneRoot.add(avatarMesh);

		render(SceneTextureBindings, {
			avatarUrl: '/api/users/product-user-1/avatar?v=123',
			sceneRoot
		});

		await vi.waitFor(() => {
			expect(loadAsync).toHaveBeenCalledWith('/api/users/product-user-1/avatar?v=123');
			expect(invalidate).toHaveBeenCalled();
			expect(avatarMesh.material).not.toBe(originalMaterial);
		});
	});
});
