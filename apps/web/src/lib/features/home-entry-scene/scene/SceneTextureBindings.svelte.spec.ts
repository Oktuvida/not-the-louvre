import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three';
import SceneTextureBindings from './SceneTextureBindings.svelte';

const invalidate = vi.fn();
const loadAsync = vi.fn<(url: string) => Promise<Texture>>(async () => new Texture());

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

		await render(SceneTextureBindings, {
			avatarUrl: '/api/users/product-user-1/avatar?v=123',
			sceneRoot
		});

		await vi.waitFor(() => {
			expect(loadAsync).toHaveBeenCalledWith('/api/users/product-user-1/avatar?v=123');
			expect(invalidate).toHaveBeenCalled();
			expect(avatarMesh.material).not.toBe(originalMaterial);
		});
	});

	it('keeps the working walls textured when one artwork media response fails', async () => {
		loadAsync.mockImplementation(async (url: string) => {
			if (url === '/api/artworks/artwork-1/media') {
				throw new Error('media unavailable');
			}

			return new Texture();
		});

		const sceneRoot = new Group();
		const meshFor = (name: string) => {
			const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: '#ffffff' }));
			mesh.name = name;
			sceneRoot.add(mesh);
			return mesh;
		};
		const avatarMesh = meshFor('avatar');
		const failedMesh = meshFor('a1');
		const healthyMesh = meshFor('a2');
		const originalFailedMaterial = failedMesh.material;

		await render(SceneTextureBindings, {
			artworkSlots: [
				{ id: 'artwork-1', imageUrl: '/api/artworks/artwork-1/media', slotName: 'a1', title: 'A' },
				{ id: 'artwork-2', imageUrl: '/api/artworks/artwork-2/media', slotName: 'a2', title: 'B' }
			],
			avatarUrl: '/api/users/product-user-1/avatar?v=123',
			sceneRoot
		});

		await vi.waitFor(() => {
			expect((avatarMesh.material as MeshBasicMaterial).map).toBeInstanceOf(Texture);
			expect((healthyMesh.material as MeshBasicMaterial).map).toBeInstanceOf(Texture);
		});

		expect(failedMesh.material).toBe(originalFailedMaterial);
	});

	it('disposes the replaced avatar texture and leaves the artwork walls alone', async () => {
		const textures: Texture[] = [];
		loadAsync.mockImplementation(async () => {
			const texture = new Texture();
			textures.push(texture);
			return texture;
		});

		const sceneRoot = new Group();
		for (const name of ['avatar', 'a1']) {
			const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: '#ffffff' }));
			mesh.name = name;
			sceneRoot.add(mesh);
		}

		const artworkSlots = [
			{
				id: 'artwork-1',
				imageUrl: '/api/artworks/artwork-1/media',
				slotName: 'a1' as const,
				title: 'A'
			}
		];

		const { rerender } = await render(SceneTextureBindings, {
			artworkSlots,
			avatarUrl: '/api/users/product-user-1/avatar?v=1',
			sceneRoot
		});

		await vi.waitFor(() => {
			expect(loadAsync).toHaveBeenCalledTimes(2);
		});

		const firstAvatarTexture = textures[0]!;
		const disposed = vi.fn();
		firstAvatarTexture.addEventListener('dispose', disposed);

		await rerender({ artworkSlots, avatarUrl: '/api/users/product-user-1/avatar?v=2', sceneRoot });

		await vi.waitFor(() => {
			expect(disposed).toHaveBeenCalled();
		});

		// Only the avatar URL moved, so the artwork wall is not re-fetched.
		expect(loadAsync).toHaveBeenCalledTimes(3);
	});
});
