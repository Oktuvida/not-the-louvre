import { parseDrawingDocument, serializeDrawingDocument, type DrawingDocumentV1 } from './document';

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

export const loadDrawingDraft = (key: string): DrawingDocumentV1 | null => {
	const storage = getStorage();
	if (!storage) return null;

	const raw = storage.getItem(key);
	if (!raw) return null;

	try {
		return parseDrawingDocument(raw);
	} catch {
		storage.removeItem(key);
		return null;
	}
};

export const saveDrawingDraft = (key: string, document: DrawingDocumentV1) => {
	const storage = getStorage();
	if (!storage) return;

	storage.setItem(key, serializeDrawingDocument(document));
};

export const clearDrawingDraft = (key: string) => {
	const storage = getStorage();
	if (!storage) return;

	storage.removeItem(key);
};
