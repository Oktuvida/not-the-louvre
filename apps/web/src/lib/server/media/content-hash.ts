/**
 * The SHA-256 of some bytes, in hex. Naming stored objects by their content
 * means a name never points at different bytes, so any cache may keep them.
 */
export const contentHash = async (bytes: BufferSource): Promise<string> =>
	Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
