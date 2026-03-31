import { describe, expect, it } from 'vitest';
import { ensureCaddyGlobalEmail } from './caddy';

describe('ensureCaddyGlobalEmail', () => {
	it('prepends a managed global block when none exists', () => {
		const result = ensureCaddyGlobalEmail(
			'app.example.com {\n\treverse_proxy 127.0.0.1:3000\n}\n',
			'ops@example.com',
			'not-the-louvre:global'
		);

		expect(result).toContain('# BEGIN not-the-louvre:global managed block');
		expect(result).toContain('email ops@example.com');
		expect(result).toContain('app.example.com {');
	});

	it('injects email into an existing global block without creating a second one', () => {
		const result = ensureCaddyGlobalEmail(
			'{\n\tdebug\n}\n\napp.example.com {\n\treverse_proxy 127.0.0.1:3000\n}\n',
			'ops@example.com',
			'not-the-louvre:global'
		);

		expect(result.match(/\{\n/g)?.length).toBe(2);
		expect(result).toContain('{\n\tdebug\n\temail ops@example.com\n}');
		expect(result).not.toContain('# BEGIN not-the-louvre:global managed block');
	});

	it('leaves an existing email untouched', () => {
		const original =
			'{\n\temail existing@example.com\n}\n\napp.example.com {\n\treverse_proxy 127.0.0.1:3000\n}\n';

		expect(ensureCaddyGlobalEmail(original, 'ops@example.com', 'not-the-louvre:global')).toBe(
			original
		);
	});
});
