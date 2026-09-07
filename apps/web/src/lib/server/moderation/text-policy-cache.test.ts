import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextModerationPolicyRecord } from './types';

const now = new Date('2026-03-29T12:00:00.000Z');

const mocked = vi.hoisted(() => ({
	listTextPolicies: vi.fn(),
	updateTextPolicy: vi.fn()
}));

vi.mock('./repository', () => ({
	moderationRepository: {
		findViewerContentPreference: vi.fn(),
		listTextPolicies: mocked.listTextPolicies,
		updateTextPolicy: mocked.updateTextPolicy,
		upsertViewerContentPreference: vi.fn()
	}
}));

const policy = (blocklist: string[]): TextModerationPolicyRecord[] => [
	{
		allowlist: [],
		blocklist,
		context: 'comment',
		createdAt: now,
		updatedAt: now,
		updatedBy: null,
		version: 1
	}
];

describe('text moderation policy cache', () => {
	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		mocked.listTextPolicies.mockReset();
		mocked.updateTextPolicy.mockReset();
		mocked.listTextPolicies.mockResolvedValue(policy(['nube']));

		const { resetTextModerationPolicyCache } = await import('./service');
		resetTextModerationPolicyCache();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('reads the policy table once for a burst of checks instead of once per check', async () => {
		const { checkTextModeration } = await import('./service');

		await expect(checkTextModeration('nube blanca', 'comment')).resolves.toMatchObject({
			status: 'blocked'
		});
		await expect(checkTextModeration('cielo despejado', 'comment')).resolves.toMatchObject({
			status: 'allowed'
		});
		await expect(checkTextModeration('nube gris', 'comment')).resolves.toMatchObject({
			status: 'blocked'
		});

		expect(mocked.listTextPolicies).toHaveBeenCalledOnce();
	});

	it('serves the public snapshot from the same cache entry', async () => {
		const { checkTextModeration, getTextModerationSnapshot } = await import('./service');

		await checkTextModeration('cielo', 'comment');
		await expect(getTextModerationSnapshot()).resolves.toMatchObject({
			policies: { comment: { blocklist: ['nube'] } }
		});

		expect(mocked.listTextPolicies).toHaveBeenCalledOnce();
	});

	it('picks up an admin edit once the window elapses', async () => {
		const { checkTextModeration } = await import('./service');

		await checkTextModeration('nube blanca', 'comment');
		mocked.listTextPolicies.mockResolvedValue(policy(['tormenta']));

		await expect(checkTextModeration('nube blanca', 'comment')).resolves.toMatchObject({
			status: 'blocked'
		});

		vi.setSystemTime(new Date(now.getTime() + 60_001));

		await expect(checkTextModeration('nube blanca', 'comment')).resolves.toMatchObject({
			status: 'allowed'
		});
		expect(mocked.listTextPolicies).toHaveBeenCalledTimes(2);
	});

	it('drops the cache as soon as an admin updates the policies', async () => {
		const { checkTextModeration, updateTextModerationPolicies } = await import('./service');

		await checkTextModeration('nube blanca', 'comment');

		mocked.updateTextPolicy.mockResolvedValue(policy(['tormenta'])[0]);
		mocked.listTextPolicies.mockResolvedValue(policy(['tormenta']));

		await updateTextModerationPolicies(
			{ policies: { comment: { allowlist: [], blocklist: ['tormenta'], expectedVersion: 1 } } },
			{ user: { id: 'admin-1', isBanned: false, role: 'admin' } }
		);

		await expect(checkTextModeration('nube blanca', 'comment')).resolves.toMatchObject({
			status: 'allowed'
		});
		await expect(checkTextModeration('tormenta seca', 'comment')).resolves.toMatchObject({
			status: 'blocked'
		});
	});

	it('never serves a cached policy to a caller that injected its own repository', async () => {
		const { checkTextModeration } = await import('./service');

		await checkTextModeration('nube blanca', 'comment');

		const repository = {
			findViewerContentPreference: vi.fn(),
			listTextPolicies: vi.fn().mockResolvedValue(policy(['tormenta'])),
			updateTextPolicy: vi.fn(),
			upsertViewerContentPreference: vi.fn()
		};

		await expect(
			checkTextModeration('tormenta seca', 'comment', { repository })
		).resolves.toMatchObject({ status: 'blocked' });
		expect(repository.listTextPolicies).toHaveBeenCalledOnce();
		expect(mocked.listTextPolicies).toHaveBeenCalledOnce();
	});
});
