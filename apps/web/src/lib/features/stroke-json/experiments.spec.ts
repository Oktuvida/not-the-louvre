import { describe, expect, it, vi } from 'vitest';
import { runBitmapCloneExperiment, runJsonCloneExperiment } from './experiments';

describe('stroke-json experiments', () => {
	it('runs the bitmap clone pipeline exactly 20 times before the final measurement export', async () => {
		const buildRenderedCanvas = vi.fn((document: { id: string }) => ({
			kind: 'canvas',
			source: document.id
		}));
		const measureCanvasExport = vi.fn(async (canvas: { source: string }) => ({
			blob: { source: canvas.source },
			bytes: 128,
			format: 'image/webp'
		}));
		const loadImageFromBlob = vi.fn(async (blob: { source: string }) => ({
			decodedFrom: blob.source
		}));
		const rebuildCanvasFromImage = vi.fn(
			(document: { id: string }, image: { decodedFrom: string }) => ({
				kind: 'canvas',
				source: `${document.id}:${image.decodedFrom}`
			})
		);

		await runBitmapCloneExperiment({
			buildRenderedCanvas,
			cloneIterations: 20,
			countPixelDiff: () => 42,
			document: { id: 'doc-1' },
			loadImageFromBlob,
			measureCanvasExport,
			rebuildCanvasFromImage,
			snapshotCanvas: () => 'preview'
		});

		expect(loadImageFromBlob).toHaveBeenCalledTimes(20);
		expect(rebuildCanvasFromImage).toHaveBeenCalledTimes(20);
		expect(measureCanvasExport).toHaveBeenCalledTimes(21);
	});

	it('runs the json clone pipeline exactly 20 serialize/parse cycles before the final measurement export', async () => {
		const buildRenderedCanvas = vi.fn((document: { revision: number }) => ({
			revision: document.revision
		}));
		const serializeDocument = vi.fn((document: { revision: number }) =>
			JSON.stringify({ revision: document.revision + 1 })
		);
		const parseDocument = vi.fn(
			(serialized: string) => JSON.parse(serialized) as { revision: number }
		);
		const measureCanvasExport = vi.fn(async (canvas: { revision: number }) => ({
			blob: { revision: canvas.revision },
			bytes: 64,
			format: 'image/webp'
		}));

		await runJsonCloneExperiment({
			buildRenderedCanvas,
			cloneIterations: 20,
			countPixelDiff: () => 0,
			document: { revision: 0 },
			measureCanvasExport,
			parseDocument,
			serializeDocument,
			snapshotCanvas: () => 'preview'
		});

		expect(serializeDocument).toHaveBeenCalledTimes(20);
		expect(parseDocument).toHaveBeenCalledTimes(20);
		expect(measureCanvasExport).toHaveBeenCalledTimes(1);
	});
});
