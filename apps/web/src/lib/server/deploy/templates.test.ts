import { describe, expect, it } from 'vitest';
import { renderCaddySite, renderSystemdUnit } from './templates';

describe('deploy template rendering', () => {
	it('renders a systemd unit for the compiled node server', () => {
		const unit = renderSystemdUnit({
			envFile: '/etc/not-the-louvre/not-the-louvre.env',
			nodePath: '/usr/bin/node',
			serviceName: 'not-the-louvre',
			serviceUser: 'notthelouvre',
			workingDirectory: '/opt/not-the-louvre/current/apps/web'
		});

		expect(unit).toContain('Description=not-the-louvre');
		expect(unit).toContain('User=notthelouvre');
		expect(unit).toContain('Group=notthelouvre');
		expect(unit).toContain('WorkingDirectory=/opt/not-the-louvre/current/apps/web');
		expect(unit).toContain('EnvironmentFile=/etc/not-the-louvre/not-the-louvre.env');
		expect(unit).toContain('ExecStart=/usr/bin/node build');
	});

	it('renders a minimal caddy site block with reverse proxy and compression', () => {
		const config = renderCaddySite({
			domain: 'app.example.com',
			host: '127.0.0.1',
			port: '3000'
		});

		expect(config).toContain('app.example.com {');
		expect(config).toContain('encode zstd gzip');
		expect(config).toContain('reverse_proxy 127.0.0.1:3000');
	});
});
