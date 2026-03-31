import { describe, expect, it } from 'vitest';
import { createEntryState } from './entry-state.svelte';

describe('createEntryState', () => {
	it('starts outside and follows the allowed transitions', () => {
		const entryState = createEntryState();

		expect(entryState.state).toBe('outside');

		entryState.dispatch('COME_IN');
		expect(entryState.state).toBe('transitioning-in');

		entryState.dispatch('TRANSITION_DONE');
		expect(entryState.state).toBe('auth-login');

		entryState.dispatch('SHOW_SIGN_UP');
		expect(entryState.state).toBe('auth-signup');

		entryState.dispatch('AUTH_CANCEL');
		expect(entryState.state).toBe('transitioning-out');

		entryState.dispatch('TRANSITION_RESET_DONE');
		expect(entryState.state).toBe('outside');
	});

	it('returns from inside to outside after logout', () => {
		const entryState = createEntryState('inside');

		entryState.dispatch('LOG_OUT');

		expect(entryState.state).toBe('outside');
	});

	it('moves from auth-login to inside after AUTH_SUCCESS', () => {
		const entryState = createEntryState();

		entryState.dispatch('COME_IN');
		entryState.dispatch('TRANSITION_DONE');
		entryState.dispatch('AUTH_SUCCESS');

		expect(entryState.state).toBe('inside');
	});

	it('moves from auth-recovery to inside after AUTH_SUCCESS', () => {
		const entryState = createEntryState('auth-recovery');

		entryState.dispatch('AUTH_SUCCESS');

		expect(entryState.state).toBe('inside');
	});

	it('switches between login, signup, and recovery auth states explicitly', () => {
		const entryState = createEntryState('auth-login');

		entryState.dispatch('SHOW_SIGN_UP');
		expect(entryState.state).toBe('auth-signup');

		entryState.dispatch('SHOW_RECOVERY');
		expect(entryState.state).toBe('auth-recovery');

		entryState.dispatch('SHOW_LOGIN');
		expect(entryState.state).toBe('auth-login');
	});

	it('ignores invalid events for the current state', () => {
		const entryState = createEntryState();

		entryState.dispatch('TRANSITION_DONE');
		expect(entryState.state).toBe('outside');

		entryState.dispatch('COME_IN');
		expect(entryState.state).toBe('transitioning-in');

		entryState.dispatch('COME_IN');
		expect(entryState.state).toBe('transitioning-in');

		entryState.dispatch('TRANSITION_RESET_DONE');
		expect(entryState.state).toBe('transitioning-in');
	});

	it('short-circuits to inside when SESSION_EXISTS arrives on mount', () => {
		const entryState = createEntryState();

		entryState.dispatch('SESSION_EXISTS');

		expect(entryState.state).toBe('inside');
	});
});
