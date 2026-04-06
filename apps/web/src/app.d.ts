import type { Session, User } from 'better-auth';
import type { AuthIntegrityFailure, CanonicalUser } from '$lib/server/auth/types';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
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
		// interface Platform {}
	}
}

export {};
