export const SYSTEMD_UNIT_TEMPLATE = `[Unit]
Description={{SERVICE_NAME}}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={{SERVICE_USER}}
Group={{SERVICE_USER}}
WorkingDirectory={{WORKING_DIRECTORY}}
EnvironmentFile={{ENV_FILE}}
ExecStart={{NODE_PATH}} build
Restart=always
RestartSec=5
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
`;

export const CADDY_SITE_TEMPLATE = `{{DOMAIN}} {
	encode zstd gzip
	reverse_proxy {{HOST}}:{{PORT}}
}
`;

type TemplateValues = Record<string, string>;

export type SystemdUnitOptions = {
	envFile: string;
	nodePath: string;
	serviceName: string;
	serviceUser: string;
	workingDirectory: string;
};

export type CaddySiteOptions = {
	domain: string;
	host: string;
	port: string;
};

export const renderTemplate = (template: string, values: TemplateValues) =>
	Object.entries(values).reduce(
		(result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
		template
	);

export const renderSystemdUnit = (options: SystemdUnitOptions) =>
	renderTemplate(SYSTEMD_UNIT_TEMPLATE, {
		ENV_FILE: options.envFile,
		NODE_PATH: options.nodePath,
		SERVICE_NAME: options.serviceName,
		SERVICE_USER: options.serviceUser,
		WORKING_DIRECTORY: options.workingDirectory
	});

export const renderCaddySite = (options: CaddySiteOptions) => {
	if (!options.domain) {
		throw new Error('domain is required to render the Caddy site');
	}

	return renderTemplate(CADDY_SITE_TEMPLATE, {
		DOMAIN: options.domain,
		HOST: options.host,
		PORT: options.port
	});
};
