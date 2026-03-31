const extractFirstGlobalBlock = (config: string) => {
	const firstBraceIndex = config.search(/\S/);

	if (firstBraceIndex === -1 || config[firstBraceIndex] !== '{') {
		return null;
	}

	let depth = 0;

	for (let index = firstBraceIndex; index < config.length; index += 1) {
		const character = config[index];

		if (character === '{') {
			depth += 1;
		}

		if (character === '}') {
			depth -= 1;

			if (depth === 0) {
				return {
					end: index,
					start: firstBraceIndex,
					text: config.slice(firstBraceIndex, index + 1)
				};
			}
		}
	}

	throw new Error('Caddyfile starts with an unterminated global options block');
};

export const ensureCaddyGlobalEmail = (config: string, email: string, blockId: string) => {
	if (!email) {
		return config;
	}

	const existingGlobalBlock = extractFirstGlobalBlock(config);

	if (existingGlobalBlock) {
		if (/^\s*email\s+/m.test(existingGlobalBlock.text)) {
			return config;
		}

		const beforeClosingBrace = existingGlobalBlock.text.slice(0, -1).trimEnd();
		const nextGlobalBlock = `${beforeClosingBrace}\n\temail ${email}\n}`;

		return `${config.slice(0, existingGlobalBlock.start)}${nextGlobalBlock}${config.slice(
			existingGlobalBlock.end + 1
		)}`;
	}

	const managedGlobalBlock = [
		`# BEGIN ${blockId} managed block`,
		'{',
		`\temail ${email}`,
		'}',
		`# END ${blockId} managed block`
	].join('\n');

	return `${managedGlobalBlock}\n\n${config.trimStart()}`;
};