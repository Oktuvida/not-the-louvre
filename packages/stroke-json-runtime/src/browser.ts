import initStrokeJsonBrowserWasm, {
	compact_document_losslessly_with_report,
	decode_canonical_document,
	decode_editable_document,
	normalize_editable_document,
	prepare_publish_document,
	prepare_storage_document,
	run_prod_like_pipeline,
	serialize_canonical_document,
	stroke_json_wasm_version,
	validate_document
} from '../generated/wasm/browser/stroke_json_wasm.js';
import {
	createStrokeJsonRuntime,
	type StrokeJsonBindings,
	type StrokeJsonDocumentMetadata,
	type StrokeJsonLosslessCompactionOptions,
	type StrokeJsonPreparedLosslessCompactionDocument,
	type StrokeJsonPreparedProdLikePipelineDocument,
	type StrokeJsonPreparedProdLikePipelineIteration,
	type StrokeJsonPreparedPublishDocument,
	type StrokeJsonProdLikePipelineOptions,
	type StrokeJsonPublishOptions,
	type StrokeJsonRuntime,
	StrokeJsonRuntimeError,
	type StrokeJsonRuntimeErrorCode,
	type StrokeJsonRuntimeLoader,
	type StrokeJsonStorageDocument,
	toStrokeJsonRuntimeError
} from './internal';

type StrokeJsonWorkerMessage = {
	id: number;
};

type StrokeJsonWorkerOperationMap = {
	compactDocumentLosslesslyWithReport: {
		payload: {
			documentJson: string;
			options?: StrokeJsonLosslessCompactionOptions;
		};
		result: StrokeJsonPreparedLosslessCompactionDocument;
	};
	decodeCanonicalDocument: {
		payload: { payloadBase64: string };
		result: string;
	};
	decodeEditableDocument: {
		payload: { payloadBase64: string };
		result: string;
	};
	getVersion: {
		payload: undefined;
		result: string;
	};
	normalizeEditableDocument: {
		payload: { documentJson: string };
		result: string;
	};
	preparePublishDocument: {
		payload: {
			documentJson: string;
			options?: StrokeJsonPublishOptions;
		};
		result: StrokeJsonPreparedPublishDocument;
	};
	prepareStorageDocument: {
		payload: { documentJson: string };
		result: StrokeJsonStorageDocument;
	};
	runProdLikePipeline: {
		payload: {
			documentJson: string;
			options?: StrokeJsonProdLikePipelineOptions;
		};
		result: StrokeJsonPreparedProdLikePipelineDocument;
	};
	serializeCanonicalDocument: {
		payload: { documentJson: string };
		result: string;
	};
	validateDocument: {
		payload: { documentJson: string };
		result: StrokeJsonDocumentMetadata;
	};
};

export type StrokeJsonWorkerRequest = StrokeJsonWorkerMessage & {
	[K in keyof StrokeJsonWorkerOperationMap]: {
		payload: StrokeJsonWorkerOperationMap[K]['payload'];
		type: K;
	};
}[keyof StrokeJsonWorkerOperationMap];

type StrokeJsonWorkerSerializedError = {
	code: StrokeJsonRuntimeErrorCode;
	message: string;
};

type StrokeJsonWorkerResponse = StrokeJsonWorkerMessage &
	(
		| {
			[K in keyof StrokeJsonWorkerOperationMap]: {
				result: StrokeJsonWorkerOperationMap[K]['result'];
			};
		}[keyof StrokeJsonWorkerOperationMap]
		| {
			error: StrokeJsonWorkerSerializedError;
		}
	);

export type StrokeJsonBrowserWorker = {
	addEventListener: (type: 'error' | 'message', listener: EventListenerOrEventListenerObject) => void;
	postMessage: (message: StrokeJsonWorkerRequest) => void;
	removeEventListener: (
		type: 'error' | 'message',
		listener: EventListenerOrEventListenerObject
	) => void;
	terminate: () => void;
};

export type StrokeJsonWorkerScope = {
	onmessage: ((event: MessageEvent<StrokeJsonWorkerRequest>) => void) | null;
	postMessage: (message: StrokeJsonWorkerResponse) => void;
};

const loadDefaultBrowserBindings = async (): Promise<StrokeJsonBindings> => {
	await initStrokeJsonBrowserWasm(new URL('../generated/wasm/browser/stroke_json_wasm_bg.wasm', import.meta.url));

	return {
		compact_document_losslessly_with_report,
		decode_canonical_document,
		decode_editable_document,
		normalize_editable_document,
		prepare_publish_document,
		prepare_storage_document,
		run_prod_like_pipeline,
		serialize_canonical_document,
		stroke_json_wasm_version,
		validate_document
	};
};

type PendingRequest = {
	reject: (reason: unknown) => void;
	resolve: (value: any) => void;
};

type DraftHydrationRequest = {
	applyHydratedDocument: (documentJson: string) => void;
	documentJson: string;
	revision: number;
};

type DraftAutosaveRequest = {
	documentJson: string;
	revision: number;
};

type DraftCoordinatorOptions = {
	debounceMs?: number;
	persistSerializedDraft: (serializedDraft: string) => void;
	runtime: Pick<StrokeJsonRuntime, 'normalizeEditableDocument'>;
};

const serializeWorkerError = (error: unknown): StrokeJsonWorkerSerializedError => {
	const runtimeError = toStrokeJsonRuntimeError(error);
	return {
		code: runtimeError.code,
		message: runtimeError.message
	};
};

const deserializeWorkerError = (error: StrokeJsonWorkerSerializedError) =>
	new StrokeJsonRuntimeError(error.code, error.message);

const dispatchWorkerRequest = async (
	runtime: StrokeJsonRuntime,
	request: StrokeJsonWorkerRequest
) => {
	switch (request.type) {
		case 'compactDocumentLosslesslyWithReport':
			return runtime.compactDocumentLosslesslyWithReport(
				request.payload.documentJson,
				request.payload.options
			);
		case 'decodeCanonicalDocument':
			return runtime.decodeCanonicalDocument(request.payload.payloadBase64);
		case 'decodeEditableDocument':
			return runtime.decodeEditableDocument(request.payload.payloadBase64);
		case 'getVersion':
			return runtime.getVersion();
		case 'normalizeEditableDocument':
			return runtime.normalizeEditableDocument(request.payload.documentJson);
		case 'preparePublishDocument':
			return runtime.preparePublishDocument(request.payload.documentJson, request.payload.options);
		case 'prepareStorageDocument':
			return runtime.prepareStorageDocument(request.payload.documentJson);
		case 'runProdLikePipeline':
			return runtime.runProdLikePipeline(request.payload.documentJson, request.payload.options);
		case 'serializeCanonicalDocument':
			return runtime.serializeCanonicalDocument(request.payload.documentJson);
		case 'validateDocument':
			return runtime.validateDocument(request.payload.documentJson);
	}
	};

export const createDirectStrokeJsonBrowserRuntime = (options: {
	loadBindings?: StrokeJsonRuntimeLoader;
} = {}): StrokeJsonRuntime => createStrokeJsonRuntime(options.loadBindings ?? loadDefaultBrowserBindings);

export const registerStrokeJsonWorker = (
	scope: StrokeJsonWorkerScope,
	runtime: StrokeJsonRuntime
) => {
	scope.onmessage = async (event) => {
		const request = event.data;

		try {
			const result = await dispatchWorkerRequest(runtime, request);
			scope.postMessage({ id: request.id, result } as StrokeJsonWorkerResponse);
		} catch (error) {
			scope.postMessage({
				error: serializeWorkerError(error),
				id: request.id
			});
		}
	};
};

export const createStrokeJsonBrowserRuntime = (options: {
	createWorker: () => StrokeJsonBrowserWorker;
}): StrokeJsonRuntime & { dispose: () => void } => {
	let nextRequestId = 0;
	let worker: StrokeJsonBrowserWorker | null = null;
	const pendingRequests = new Map<number, PendingRequest>();

	const failPendingRequests = (error: unknown) => {
		for (const pending of pendingRequests.values()) {
			pending.reject(error);
		}
		pendingRequests.clear();
	};

	const handleWorkerMessage = (event: MessageEvent<StrokeJsonWorkerResponse>) => {
		const { data } = event;
		const pending = pendingRequests.get(data.id);
		if (!pending) {
			return;
		}

		pendingRequests.delete(data.id);

		if ('error' in data) {
			pending.reject(deserializeWorkerError(data.error));
			return;
		}

		pending.resolve(data.result);
	};

	const handleWorkerError = (event: Event) => {
		const message =
			event instanceof ErrorEvent && event.message
				? event.message
				: 'stroke-json worker failed';
		failPendingRequests(new StrokeJsonRuntimeError('init_failed', message, { cause: event }));
	};

	const getWorker = () => {
		if (worker) {
			return worker;
		}

		worker = options.createWorker();
		worker.addEventListener('message', handleWorkerMessage as EventListener);
		worker.addEventListener('error', handleWorkerError as EventListener);
		return worker;
	};

	const request = <TType extends keyof StrokeJsonWorkerOperationMap>(
		type: TType,
		payload: StrokeJsonWorkerOperationMap[TType]['payload']
	) =>
		new Promise<StrokeJsonWorkerOperationMap[TType]['result']>((resolve, reject) => {
			const requestId = ++nextRequestId;
			pendingRequests.set(requestId, { reject, resolve });
			getWorker().postMessage({ id: requestId, payload, type } as StrokeJsonWorkerRequest);
		});

	return {
		compactDocumentLosslesslyWithReport: (documentJson, options) =>
			request('compactDocumentLosslesslyWithReport', { documentJson, options }),
		decodeCanonicalDocument: (payloadBase64) =>
			request('decodeCanonicalDocument', { payloadBase64 }),
		decodeEditableDocument: (payloadBase64) => request('decodeEditableDocument', { payloadBase64 }),
		dispose: () => {
			if (!worker) {
				return;
			}

			worker.removeEventListener('message', handleWorkerMessage as EventListener);
			worker.removeEventListener('error', handleWorkerError as EventListener);
			worker.terminate();
			worker = null;
			failPendingRequests(new StrokeJsonRuntimeError('internal_error', 'stroke-json worker disposed'));
		},
		getVersion: () => request('getVersion', undefined),
		normalizeEditableDocument: (documentJson) =>
			request('normalizeEditableDocument', { documentJson }),
		preparePublishDocument: (documentJson, options) =>
			request('preparePublishDocument', { documentJson, options }),
		prepareStorageDocument: (documentJson) => request('prepareStorageDocument', { documentJson }),
		runProdLikePipeline: (documentJson, options) =>
			request('runProdLikePipeline', { documentJson, options }),
		serializeCanonicalDocument: (documentJson) =>
			request('serializeCanonicalDocument', { documentJson }),
		validateDocument: (documentJson) => request('validateDocument', { documentJson })
	};
};

export const createStrokeJsonDraftCoordinator = (options: DraftCoordinatorOptions) => {
	let latestHydrationRevision = 0;
	let latestAutosaveRevision = 0;
	let latestPersistedRevision = 0;
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

	const persistIfCurrent = async (documentJson: string, revision: number) => {
		const serializedDraft = await options.runtime.normalizeEditableDocument(documentJson);
		if (revision !== latestAutosaveRevision || revision < latestPersistedRevision) {
			return false;
		}

		latestPersistedRevision = revision;
		options.persistSerializedDraft(serializedDraft);
		return true;
	};

	return {
		dispose: () => {
			if (autosaveTimer) {
				clearTimeout(autosaveTimer);
				autosaveTimer = null;
			}
		},
		hydrateDraft: async (request: DraftHydrationRequest) => {
			latestHydrationRevision = Math.max(latestHydrationRevision, request.revision);
			const hydratedDocument = await options.runtime.normalizeEditableDocument(request.documentJson);

			if (request.revision !== latestHydrationRevision) {
				return false;
			}

			request.applyHydratedDocument(hydratedDocument);
			return true;
		},
		scheduleAutosave: (request: DraftAutosaveRequest) => {
			latestAutosaveRevision = Math.max(latestAutosaveRevision, request.revision);
			if (autosaveTimer) {
				clearTimeout(autosaveTimer);
			}

			autosaveTimer = setTimeout(() => {
				autosaveTimer = null;
				void persistIfCurrent(request.documentJson, request.revision);
			}, options.debounceMs ?? 250);
		}
	};
};

export type {
	DraftAutosaveRequest,
	DraftCoordinatorOptions,
	DraftHydrationRequest,
	StrokeJsonBindings,
	StrokeJsonDocumentMetadata,
	StrokeJsonLosslessCompactionOptions,
	StrokeJsonPreparedLosslessCompactionDocument,
	StrokeJsonPreparedProdLikePipelineDocument,
	StrokeJsonPreparedProdLikePipelineIteration,
	StrokeJsonPreparedPublishDocument,
	StrokeJsonProdLikePipelineOptions,
	StrokeJsonPublishOptions,
	StrokeJsonRuntime,
	StrokeJsonRuntimeErrorCode,
	StrokeJsonRuntimeLoader,
	StrokeJsonStorageDocument
};
export { StrokeJsonRuntimeError, toStrokeJsonRuntimeError };