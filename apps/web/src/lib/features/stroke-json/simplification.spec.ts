import { describe, expect, it } from 'vitest';
import { serializeCanonicalDrawingDocument, type DrawingDocumentV2 } from './document';
import {
	DEFAULT_SIMPLIFY_JS_PHASE1_OPTIONS,
	simplifyDocumentWithSimplifyJs
} from './simplification';

describe('stroke-json simplify-js phase 1', () => {
	it('simplifies base and tail strokes without mutating the input document', () => {
		const document: DrawingDocumentV2 = {
			background: '#fdfbf7',
			base: [
				{
					color: '#2d2420',
					points: [
						[10, 10],
						[10, 10],
						[20, 20],
						[30, 30],
						[40, 40]
					],
					size: 4
				}
			],
			height: 768,
			kind: 'artwork',
			tail: [
				{
					color: '#c84f4f',
					points: [
						[50, 50],
						[60, 70],
						[70, 50],
						[80, 70],
						[90, 50]
					],
					size: 6
				}
			],
			version: 2,
			width: 768
		};
		const before = serializeCanonicalDrawingDocument(document);

		const simplifyJs = simplifyDocumentWithSimplifyJs(document, {
			simplifyJsTolerance: 24
		});

		expect(simplifyJs.base[0]?.points).toEqual([
			[10, 10],
			[40, 40]
		]);
		expect(simplifyJs.tail[0]?.points).toEqual([
			[50, 50],
			[90, 50]
		]);
		expect(serializeCanonicalDrawingDocument(document)).toBe(before);
	});

	it('exposes the simplify-js defaults used outside the demo', () => {
		expect(DEFAULT_SIMPLIFY_JS_PHASE1_OPTIONS).toEqual({
			simplifyJsHighQuality: false,
			simplifyJsTolerance: 1
		});
	});
});
