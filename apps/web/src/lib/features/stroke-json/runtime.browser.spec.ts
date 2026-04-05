import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createStrokeJsonBrowserRuntime,
	createStrokeJsonDraftCoordinator,
	registerStrokeJsonWorker,
	type StrokeJsonRuntime,
	type StrokeJsonWorkerRequest,
	type StrokeJsonWorkerScope
} from '@not-the-louvre/stroke-json-runtime/browser';

class FakeWorker {
	public messages: StrokeJsonWorkerRequest[] = [];
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public onerror: ((event: Event) => void) | null = null;

	postMessage(message: StrokeJsonWorkerRequest) {
		this.messages.push(message);
	}

	addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
		if (type === 'message') {
			this.onmessage = listener as (event: MessageEvent) => void;
		}
		if (type === 'error') {
			this.onerror = listener as (event: Event) => void;
		}
	}

	removeEventListener(type: string) {
		if (type === 'message') {
			this.onmessage = null;
		}
		if (type === 'error') {
			this.onerror = null;
		}
	}

	terminate() {}

	dispatchMessage(data: unknown) {
		this.onmessage?.({ data } as MessageEvent);
	}

	dispatchError(error: Error) {
		this.onerror?.(new ErrorEvent('error', { error, message: error.message }));
	}
}

class FakeWorkerScope implements StrokeJsonWorkerScope {
	public postedMessages: unknown[] = [];
	public onmessage: ((event: MessageEvent<StrokeJsonWorkerRequest>) => void) | null = null;

	postMessage(message: unknown) {
		this.postedMessages.push(message);
	}
}

describe('registerStrokeJsonWorker', () => {
	it('routes worker requests by id and returns structured errors', async () => {
		const runtime: StrokeJsonRuntime = {
			compactDocumentLosslesslyWithReport: vi.fn(async () => ({
				documentJson: '{"version":2}',
				height: 768,
				kind: 'artwork',
				largestSkippedStrokeCoveragePixels: 0,
				maxStrokeCoveragePixels: null,
				skippedPartialCompactionStrokeCount: 0,
				strokeCount: 1,
				totalPoints: 3,
				version: 2,
				width: 768
			})),
			decodeCanonicalDocument: vi.fn(async () => 'canonical'),
			decodeEditableDocument: vi.fn(async () => 'editable'),
			getVersion: vi.fn(async () => '0.1.0'),
			normalizeEditableDocument: vi.fn(async () => 'normalized'),
			preparePublishDocument: vi.fn(async () => {
				throw Object.assign(new Error('boom'), { code: 'internal_error' });
			}),
			prepareStorageDocument: vi.fn(async () => ({
				canonicalDocumentJson: 'canonical',
				compressedDocumentBase64: 'AA==',
				height: 768,
				kind: 'artwork',
				strokeCount: 1,
				totalPoints: 3,
				version: 2,
				width: 768
			})),
			runProdLikePipeline: vi.fn(async () => ({
				finalDocumentJson: '{"version":2}',
				height: 768,
				iterations: [],
				kind: 'artwork',
				strokeCount: 1,
				totalDurationMs: 1,
				totalPoints: 3,
				version: 2,
				width: 768
			})),
			serializeCanonicalDocument: vi.fn(async () => 'canonical'),
			validateDocument: vi.fn(async () => ({
				height: 768,
				kind: 'artwork',
				strokeCount: 1,
				totalPoints: 3,
				version: 2,
				width: 768
			}))
		};
		const scope = new FakeWorkerScope();

		registerStrokeJsonWorker(scope, runtime);
		await scope.onmessage?.({
			data: { id: 7, payload: { documentJson: '{"version":2}' }, type: 'validateDocument' }
		} as MessageEvent<StrokeJsonWorkerRequest>);
		await scope.onmessage?.({
			data: {
				id: 9,
				payload: { documentJson: '{"version":2}' },
				type: 'preparePublishDocument'
			}
		} as MessageEvent<StrokeJsonWorkerRequest>);

		expect(scope.postedMessages).toEqual([
			{
				id: 7,
				result: {
					height: 768,
					kind: 'artwork',
					strokeCount: 1,
					totalPoints: 3,
					version: 2,
					width: 768
				}
			},
			{
				error: {
					code: 'internal_error',
					message: 'boom'
				},
				id: 9
			}
		]);
	});
});

describe('createStrokeJsonBrowserRuntime', () => {
	it('reuses one worker and resolves responses by request id', async () => {
		const fakeWorker = new FakeWorker();
		const runtime = createStrokeJsonBrowserRuntime({ createWorker: () => fakeWorker as never });

		const versionPromise = runtime.getVersion();
		const validatePromise = runtime.validateDocument('{"version":2}');

		expect(fakeWorker.messages).toEqual([
			{ id: 1, payload: undefined, type: 'getVersion' },
			{ id: 2, payload: { documentJson: '{"version":2}' }, type: 'validateDocument' }
		]);

		fakeWorker.dispatchMessage({
			id: 2,
			result: {
				height: 768,
				kind: 'artwork',
				strokeCount: 4,
				totalPoints: 12,
				version: 2,
				width: 768
			}
		});
		fakeWorker.dispatchMessage({ id: 1, result: '0.1.0' });

		await expect(versionPromise).resolves.toBe('0.1.0');
		await expect(validatePromise).resolves.toMatchObject({ strokeCount: 4, totalPoints: 12 });
	});

	it('surfaces worker init failures without retrying through another implementation', async () => {
		const createWorker = vi.fn(() => new FakeWorker() as never);
		const runtime = createStrokeJsonBrowserRuntime({ createWorker });
		const worker = createWorker.mock.results[0]?.value as unknown as FakeWorker | undefined;

		const firstCall = runtime.getVersion();
		const liveWorker = worker ?? (createWorker.mock.results[0]!.value as unknown as FakeWorker);
		liveWorker.dispatchMessage({
			error: { code: 'init_failed', message: 'worker bootstrap failed' },
			id: 1
		});

		await expect(firstCall).rejects.toMatchObject({
			code: 'init_failed',
			message: 'worker bootstrap failed'
		});
		expect(createWorker).toHaveBeenCalledTimes(1);
	});
});

describe('createStrokeJsonDraftCoordinator', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('discards stale hydration responses and only persists the newest completed autosave', async () => {
		const pendingNormalizations: Array<{
			documentJson: string;
			resolve: (value: string) => void;
		}> = [];
		const runtime = {
			normalizeEditableDocument: vi.fn(
				(documentJson: string) =>
					new Promise<string>((resolve) => {
						pendingNormalizations.push({ documentJson, resolve });
					})
			),
			compactDocumentLosslesslyWithReport: vi.fn(),
			decodeCanonicalDocument: vi.fn(),
			decodeEditableDocument: vi.fn(),
			getVersion: vi.fn(),
			preparePublishDocument: vi.fn(),
			prepareStorageDocument: vi.fn(),
			runProdLikePipeline: vi.fn(),
			serializeCanonicalDocument: vi.fn(),
			validateDocument: vi.fn()
		} as unknown as StrokeJsonRuntime;
		const appliedHydrations: string[] = [];
		const persistedDrafts: string[] = [];
		const coordinator = createStrokeJsonDraftCoordinator({
			debounceMs: 25,
			persistSerializedDraft: (serializedDraft) => {
				persistedDrafts.push(serializedDraft);
			},
			runtime
		});

		const hydrateFirst = coordinator.hydrateDraft({
			applyHydratedDocument: (documentJson) => {
				appliedHydrations.push(documentJson);
			},
			documentJson: 'draft-v1',
			revision: 1
		});
		const hydrateSecond = coordinator.hydrateDraft({
			applyHydratedDocument: (documentJson) => {
				appliedHydrations.push(documentJson);
			},
			documentJson: 'draft-v2',
			revision: 2
		});

		pendingNormalizations[1]!.resolve('normalized-v2');
		await hydrateSecond;
		pendingNormalizations[0]!.resolve('normalized-v1');
		await hydrateFirst;

		coordinator.scheduleAutosave({ documentJson: 'save-v1', revision: 1 });
		await vi.advanceTimersByTimeAsync(25);
		coordinator.scheduleAutosave({ documentJson: 'save-v2', revision: 2 });
		await vi.advanceTimersByTimeAsync(25);

		pendingNormalizations[2]!.resolve('serialized-v1');
		await Promise.resolve();
		pendingNormalizations[3]!.resolve('serialized-v2');
		await Promise.resolve();

		expect(appliedHydrations).toEqual(['normalized-v2']);
		expect(persistedDrafts).toEqual(['serialized-v2']);
	});
});
