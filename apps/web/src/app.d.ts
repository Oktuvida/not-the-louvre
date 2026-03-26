import type { Session, User } from 'better-auth';
import type { AuthIntegrityFailure, CanonicalUser } from '$lib/server/auth/types';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			authUser?: User;
			integrityFailure?: AuthIntegrityFailure;
			session?: Session;
			user?: CanonicalUser;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
