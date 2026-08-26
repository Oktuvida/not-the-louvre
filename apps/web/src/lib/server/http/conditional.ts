export const etagMatches = (request: Request, etag: string) =>
	(request.headers.get('if-none-match') ?? '')
		.split(',')
		.some((candidate) => candidate.trim().replace(/^W\//, '') === etag);

export const notModified = (source: Headers) => {
	const headers = new Headers();

	for (const name of ['cache-control', 'etag']) {
		const value = source.get(name);
		if (value) headers.set(name, value);
	}

	return new Response(null, { headers, status: 304 });
};
