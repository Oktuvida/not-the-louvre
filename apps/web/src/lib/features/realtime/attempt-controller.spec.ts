import { describe, expect, it } from 'vitest';
import { createRealtimeAttemptController } from './attempt-controller';

describe('createRealtimeAttemptController', () => {
	it('invalidates the previous attempt when a new one begins', () => {
		const controller = createRealtimeAttemptController();
		const first = controller.begin();
		const second = controller.begin();

		expect(controller.isCurrent(first.id)).toBe(false);
		expect(first.signal.aborted).toBe(true);
		expect(controller.isCurrent(second.id)).toBe(true);
		expect(second.signal.aborted).toBe(false);
	});

	it('aborts and invalidates the current attempt when cancelled', () => {
		const controller = createRealtimeAttemptController();
		const attempt = controller.begin();

		controller.cancel();

		expect(controller.isCurrent(attempt.id)).toBe(false);
		expect(attempt.signal.aborted).toBe(true);
	});
});
