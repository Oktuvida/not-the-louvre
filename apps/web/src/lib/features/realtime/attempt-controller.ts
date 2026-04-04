export type RealtimeAttempt = {
	id: number;
	signal: AbortSignal;
};

export const createRealtimeAttemptController = () => {
	let currentAttemptId = 0;
	let currentAbortController: AbortController | null = null;

	return {
		begin(): RealtimeAttempt {
			currentAttemptId += 1;
			currentAbortController?.abort();

			const abortController = new AbortController();
			currentAbortController = abortController;

			return {
				id: currentAttemptId,
				signal: abortController.signal
			};
		},

		cancel() {
			currentAttemptId += 1;
			currentAbortController?.abort();
			currentAbortController = null;
		},

		isCurrent(attemptId: number) {
			return currentAttemptId === attemptId;
		}
	};
};
