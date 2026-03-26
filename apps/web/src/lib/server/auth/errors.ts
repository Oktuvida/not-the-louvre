export class AuthFlowError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly code:
			| 'INVALID_NICKNAME'
			| 'NICKNAME_TAKEN'
			| 'INVALID_CREDENTIALS'
			| 'RECOVERY_FAILED'
			| 'RATE_LIMITED'
			| 'INTEGRITY_FAILURE'
	) {
		super(message);
	}
}
