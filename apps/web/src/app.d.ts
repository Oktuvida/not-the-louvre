import type { Session, User } from 'better-auth';
import type { AuthIntegrityFailure, CanonicalUser } from '#lib/server/auth/types.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Replaced at build time by vite.config.ts `define`: true only for the
	// Playwright e2e build, so the in-memory storage branches tree-shake away
	// everywhere else.
	const __PLAYWRIGHT__: boolean;

	interface Window {
		__ntlBypassClientContentFilters?: boolean;
	}

	namespace App {
		interface Locals {
			authUser?: User;
			integrityFailure?: AuthIntegrityFailure;
			session?: Session;
			user?: CanonicalUser;
		}

		// interface Error {}
		// interface PageData {}
		interface PageState {
			galleryDetail?: {
				artworkId: string;
				roomId: string;
				source: 'external' | 'local-room-selection';
			};
		}
	}
}

export {};
