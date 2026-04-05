import {
	parseEditableDrawingDocumentV2,
	serializeEditableDrawingDocument,
	type DrawingDocumentV2
} from './document';

type DraftKeyInput = {
	schemaVersion: number;
	scope: string;
	surface: 'artwork' | 'avatar';
	userKey: string;
};

const getStorage = () => {
	if (typeof window === 'undefined') return null;
	return window.localStorage;
};

export const buildDrawingDraftKey = ({ schemaVersion, scope, surface, userKey }: DraftKeyInput) =>
	`drawing-draft:v${schemaVersion}:${surface}:${userKey}:${scope}`;

export const loadDrawingDraft = async (
	key: string,
	legacyKey?: string | null
): Promise<DrawingDocumentV2 | null> => {
	const storage = getStorage();
	if (!storage) return null;

	const raw = storage.getItem(key) ?? (legacyKey ? storage.getItem(legacyKey) : null);
	if (!raw) return null;

	try {
		const document = parseEditableDrawingDocumentV2(raw);

		if (legacyKey && storage.getItem(key) === null && storage.getItem(legacyKey) !== null) {
			try {
				storage.setItem(key, serializeEditableDrawingDocument(document));
				storage.removeItem(legacyKey);
			} catch {
				// Keep the converted document in memory even if draft migration cannot be persisted.
			}
		}

		return document;
	} catch {
		try {
			parseEditableDrawingDocumentV2(raw);
		} catch {
			// Keep behavior aligned with previous draft cleanup when the stored payload is invalid.
		}
		storage.removeItem(key);
		if (legacyKey) {
			storage.removeItem(legacyKey);
		}
		return null;
	}
};

export const saveDrawingDraft = (key: string, document: DrawingDocumentV2) => {
	const storage = getStorage();
	if (!storage) return;

	storage.setItem(key, serializeEditableDrawingDocument(document));
};

export const clearDrawingDraft = (key: string) => {
	const storage = getStorage();
	if (!storage) return;

	storage.removeItem(key);
};
