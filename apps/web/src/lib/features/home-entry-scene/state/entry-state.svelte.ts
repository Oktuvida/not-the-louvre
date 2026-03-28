export type EntryFlowState =
	| 'outside'
	| 'transitioning-in'
	| 'auth-login'
	| 'auth-signup'
	| 'auth-recovery'
	| 'transitioning-out'
	| 'inside';

export type EntryFlowEvent =
	| 'COME_IN'
	| 'TRANSITION_DONE'
	| 'SHOW_LOGIN'
	| 'SHOW_SIGN_UP'
	| 'SHOW_RECOVERY'
	| 'AUTH_CANCEL'
	| 'AUTH_SUCCESS'
	| 'LOG_OUT'
	| 'TRANSITION_RESET_DONE'
	| 'SESSION_EXISTS';

const transitionTable: Partial<
	Record<EntryFlowState, Partial<Record<EntryFlowEvent, EntryFlowState>>>
> = {
	outside: {
		COME_IN: 'transitioning-in',
		SESSION_EXISTS: 'inside'
	},
	'transitioning-in': {
		TRANSITION_DONE: 'auth-login'
	},
	'auth-login': {
		SHOW_SIGN_UP: 'auth-signup',
		SHOW_RECOVERY: 'auth-recovery',
		AUTH_CANCEL: 'transitioning-out',
		AUTH_SUCCESS: 'inside'
	},
	'auth-signup': {
		SHOW_LOGIN: 'auth-login',
		SHOW_RECOVERY: 'auth-recovery',
		AUTH_CANCEL: 'transitioning-out',
		AUTH_SUCCESS: 'inside'
	},
	'auth-recovery': {
		SHOW_LOGIN: 'auth-login',
		SHOW_SIGN_UP: 'auth-signup',
		AUTH_CANCEL: 'transitioning-out'
	},
	inside: {
		LOG_OUT: 'outside'
	},
	'transitioning-out': {
		TRANSITION_RESET_DONE: 'outside'
	}
};

export function createEntryState(initialState: EntryFlowState = 'outside') {
	let state = $state<EntryFlowState>(initialState);

	return {
		get state() {
			return state;
		},
		dispatch(event: EntryFlowEvent) {
			const nextState = transitionTable[state]?.[event];

			if (nextState) {
				state = nextState;
			}
		}
	};
}
