import { VSMShadowMap } from 'three';
import { describe, expect, it } from 'vitest';
import { studioCanvasShadowMap } from './studio-renderer-config';

describe('studioCanvasShadowMap', () => {
	it('pins the studio scene to a Firefox-safe shadow-map type', () => {
		expect(studioCanvasShadowMap).toBe(VSMShadowMap);
	});
});
