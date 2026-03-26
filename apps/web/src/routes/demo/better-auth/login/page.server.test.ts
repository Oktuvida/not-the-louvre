import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actions } from './$types';

type LoginActionEvent = Parameters<Actions['signUp']>[0];
import { AuthFlowError } from '$lib/server/auth/errors';

const mocked = vi.hoisted(() => ({
	getNicknameAvailability: vi.fn(),
	recoverAccount: vi.fn(),
	signInWithNickname: vi.fn(),
	signUpWithNickname: vi.fn(),
	getIp: vi.fn(() => '127.0.0.1')
}));

vi.mock('$lib/server/auth/service', () => ({
	getNicknameAvailability: mocked.getNicknameAvailability,
	recoverAccount: mocked.recoverAccount,
	signInWithNickname: mocked.signInWithNickname,
	signUpWithNickname: mocked.signUpWithNickname
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		options: {}
	}
}));

vi.mock('better-auth/api', () => ({
	getIp: mocked.getIp
}));

const createEvent = (fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}

	return {
		locals: {},
		cookies: {} as RequestEvent['cookies'],
		fetch,
		getClientAddress: () => '127.0.0.1',
		isDataRequest: false,
		isRemoteRequest: false,
		isSubRequest: false,
		params: {},
		platform: undefined,
		request: new Request('http://localhost/demo/better-auth/login', {
			method: 'POST',
			body: formData
		}),
		route: { id: '/demo/better-auth/login' },
		setHeaders: vi.fn(),
		tracing: {} as LoginActionEvent['tracing'],
		url: new URL('http://localhost/demo/better-auth/login')
	} as unknown as LoginActionEvent;
};

describe('nickname auth page actions', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.getNicknameAvailability.mockReset();
		mocked.recoverAccount.mockReset();
		mocked.signInWithNickname.mockReset();
		mocked.signUpWithNickname.mockReset();
		mocked.getIp.mockClear();
	});

	it('rejects invalid nickname signup input before calling the signup service', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.signUp(
			createEvent({ nickname: 'Bad Nick!', password: 'password123' })
		);

		expect(result).toMatchObject({
			status: 400,
			data: {
				message:
					'Nickname must be 3-20 chars and use only lowercase letters, numbers, or underscores'
			}
		});
		expect(mocked.signUpWithNickname).not.toHaveBeenCalled();
	});

	it('returns duplicate nickname failures from signup without losing the domain error code', async () => {
		mocked.signUpWithNickname.mockRejectedValue(
			new AuthFlowError(409, 'Nickname is already taken', 'NICKNAME_TAKEN')
		);

		const { actions } = await import('./+page.server');
		const result = await actions.signUp(
			createEvent({ nickname: 'artist_1', password: 'password123' })
		);

		expect(result).toMatchObject({
			status: 409,
			data: {
				code: 'NICKNAME_TAKEN',
				message: 'Nickname is already taken'
			}
		});
	});

	it('reports invalid nickname availability input', async () => {
		const { actions } = await import('./+page.server');
		const result = await actions.checkNickname(createEvent({ nickname: 'Bad Nick!' }));

		expect(result).toMatchObject({
			status: 400,
			data: {
				message:
					'Nickname must be 3-20 chars and use only lowercase letters, numbers, or underscores'
			}
		});
		expect(mocked.getNicknameAvailability).not.toHaveBeenCalled();
	});

	it('maps available and taken nickname availability responses for valid inputs', async () => {
		mocked.getNicknameAvailability
			.mockResolvedValueOnce({ available: true, valid: true })
			.mockResolvedValueOnce({ available: false, valid: true });

		const { actions } = await import('./+page.server');

		await expect(actions.checkNickname(createEvent({ nickname: 'artist_1' }))).resolves.toEqual({
			availability: 'available'
		});
		await expect(actions.checkNickname(createEvent({ nickname: 'artist_1' }))).resolves.toEqual({
			availability: 'taken'
		});
	});
});
