import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
	const flattenConditions = (
		condition: unknown
	): Array<{ type: string; column: string; value: unknown }> => {
		if (!condition || typeof condition !== 'object') return [];

		const candidate = condition as {
			type?: string;
			conditions?: unknown[];
			column?: string;
			value?: unknown;
		};

		if (candidate.type === 'and') {
			return (candidate.conditions ?? []).flatMap(flattenConditions);
		}

		if (candidate.type === 'eq' && candidate.column) {
			return [candidate as { type: string; column: string; value: unknown }];
		}

		return [];
	};

	const findValue = (condition: unknown, column: string) =>
		flattenConditions(condition).find((entry) => entry.column === column)?.value;

	const schema = {
		users: {
			id: 'users.id',
			nickname: 'users.nickname'
		},
		account: {
			userId: 'account.userId'
		},
		authRateLimits: {
			id: 'authRateLimits.id',
			kind: 'authRateLimits.kind',
			actorKey: 'authRateLimits.actorKey'
		}
	};

	const state = {
		profiles: new Map<string, Record<string, unknown>>(),
		accounts: new Map<string, Record<string, unknown>>(),
		rateLimits: new Map<string, Record<string, unknown>>(),
		authApi: {
			signUpEmail: vi.fn(),
			isUsernameAvailable: vi.fn(),
			signInUsername: vi.fn(),
			signOut: vi.fn(),
			getSession: vi.fn()
		},
		reset() {
			this.profiles.clear();
			this.accounts.clear();
			this.rateLimits.clear();
			Object.values(this.authApi).forEach((mock) => mock.mockReset());
		}
	};

	const db = {
		query: {
			users: {
				findFirst: vi.fn(async ({ where }: { where: unknown }) => {
					const id = findValue(where, schema.users.id);
					if (typeof id === 'string') {
						return state.profiles.get(id) ?? null;
					}

					const nickname = findValue(where, schema.users.nickname);
					if (typeof nickname === 'string') {
						return (
							Array.from(state.profiles.values()).find(
								(profile) => profile.nickname === nickname
							) ?? null
						);
					}

					return null;
				})
			},
			authRateLimits: {
				findFirst: vi.fn(async ({ where }: { where: unknown }) => {
					const kind = findValue(where, schema.authRateLimits.kind);
					const actorKey = findValue(where, schema.authRateLimits.actorKey);

					if (typeof kind !== 'string' || typeof actorKey !== 'string') {
						return null;
					}

					return state.rateLimits.get(`${kind}:${actorKey}`) ?? null;
				})
			}
		},
		insert: vi.fn((table: unknown) => ({
			values: vi.fn(async (values: Record<string, unknown>) => {
				if (table === schema.users) {
					const profile: Record<string, unknown> = {
						avatarUrl: null,
						createdAt: new Date('2026-03-25T00:00:00.000Z'),
						updatedAt: new Date('2026-03-25T00:00:00.000Z'),
						...values
					};
					state.profiles.set(String(profile.id), profile);
					return [profile];
				}

				if (table === schema.authRateLimits) {
					const record: Record<string, unknown> = {
						createdAt: new Date('2026-03-25T00:00:00.000Z'),
						updatedAt: new Date('2026-03-25T00:00:00.000Z'),
						...values
					};
					state.rateLimits.set(`${String(record.kind)}:${String(record.actorKey)}`, record);
					return [record];
				}

				return [];
			})
		})),
		update: vi.fn((table: unknown) => ({
			set: (values: Record<string, unknown>) => ({
				where: async (where: unknown) => {
					if (table === schema.account) {
						const userId = findValue(where, schema.account.userId);
						if (typeof userId !== 'string') return [];

						const next = {
							...(state.accounts.get(userId) ?? { userId }),
							...values
						};
						state.accounts.set(userId, next);
						return [next];
					}

					if (table === schema.users) {
						const id = findValue(where, schema.users.id);
						if (typeof id !== 'string') return [];

						const next = {
							...(state.profiles.get(id) ?? { id }),
							...values
						};
						state.profiles.set(id, next);
						return [next];
					}

					if (table === schema.authRateLimits) {
						const id = findValue(where, schema.authRateLimits.id);
						const record = Array.from(state.rateLimits.values()).find((entry) => entry.id === id);
						if (!record) return [];

						const next = { ...record, ...values };
						state.rateLimits.set(`${next.kind}:${next.actorKey}`, next);
						return [next];
					}

					return [];
				}
			})
		}))
	};

	class APIError extends Error {
		constructor(message = 'API error') {
			super(message);
		}
	}

	return { db, schema, state, APIError };
});

const securityLogging = vi.hoisted(() => ({
	logSecurityEvent: vi.fn()
}));

vi.mock('drizzle-orm', () => ({
	eq: (column: string, value: unknown) => ({ type: 'eq', column, value }),
	and: (...conditions: unknown[]) => ({ type: 'and', conditions })
}));

vi.mock('$lib/server/db/schema', () => ({
	users: mocked.schema.users,
	account: mocked.schema.account,
	authRateLimits: mocked.schema.authRateLimits,
	authAttemptKind: {
		enumValues: ['login', 'recovery']
	}
}));

vi.mock('$lib/server/db', () => ({
	db: mocked.db
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		api: mocked.state.authApi
	}
}));

vi.mock('better-auth', () => ({
	generateId: vi.fn(() => 'generated-rate-limit-id')
}));

vi.mock('better-auth/api', () => ({
	APIError: mocked.APIError
}));

vi.mock('better-auth/crypto', () => ({
	hashPassword: vi.fn(async (password: string) => `hash:${password}`),
	verifyPassword: vi.fn(
		async ({ hash, password }: { hash: string; password: string }) => hash === `hash:${password}`
	)
}));

vi.mock('$lib/server/security/logging', () => securityLogging);

describe('auth service', () => {
	beforeEach(() => {
		vi.resetModules();
		mocked.state.reset();
		securityLogging.logSecurityEvent.mockReset();
	});

	it('issues a recovery key and default role on signup', async () => {
		mocked.state.authApi.signUpEmail.mockResolvedValue({
			user: {
				id: 'auth-user-1',
				name: 'artist_1',
				email: 'artist_1@not-the-louvre.local',
				emailVerified: false,
				image: null
			}
		});

		const { signUpWithNickname } = await import('./service');
		const result = await signUpWithNickname({ nickname: 'artist_1', password: 'password123' });

		expect(result.response.user.role).toBe('user');
		expect(result.response.user.nickname).toBe('artist_1');
		expect(result.response.recoveryKey).toHaveLength(36);
		expect(mocked.state.profiles.get('auth-user-1')).toMatchObject({
			id: 'auth-user-1',
			nickname: 'artist_1',
			role: 'user',
			recoveryHash: `hash:${result.response.recoveryKey}`
		});
		expect(mocked.state.authApi.signUpEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					email: 'artist_1@not-the-louvre.local',
					username: 'artist_1',
					nickname: 'artist_1'
				})
			})
		);
	});

	it('rejects duplicate nicknames before creating auth records', async () => {
		mocked.state.profiles.set('auth-user-1', {
			id: 'auth-user-1',
			nickname: 'artist_1',
			recoveryHash: 'hash:old-key',
			role: 'user',
			avatarUrl: null,
			createdAt: new Date('2026-03-25T00:00:00.000Z'),
			updatedAt: new Date('2026-03-25T00:00:00.000Z')
		});

		const { signUpWithNickname } = await import('./service');

		await expect(
			signUpWithNickname({ nickname: 'artist_1', password: 'password123' })
		).rejects.toMatchObject({
			code: 'NICKNAME_TAKEN',
			status: 409
		});
		expect(mocked.state.authApi.signUpEmail).not.toHaveBeenCalled();
	});

	it('returns a non-enumerating credential error on failed login attempts', async () => {
		mocked.state.authApi.signInUsername.mockRejectedValue(new mocked.APIError('wrong password'));

		const { signInWithNickname } = await import('./service');

		await expect(
			signInWithNickname({ nickname: 'artist_1', password: 'password123' }, '127.0.0.1')
		).rejects.toMatchObject({
			code: 'INVALID_CREDENTIALS',
			message: 'Invalid nickname or password',
			status: 401
		});

		expect(mocked.state.rateLimits.size).toBe(1);
	});

	it('returns canonical user identity when a session has a companion product user', async () => {
		mocked.state.profiles.set('auth-user-1', {
			id: 'auth-user-1',
			nickname: 'artist_1',
			recoveryHash: 'hash:old-key',
			role: 'moderator',
			avatarUrl: null,
			createdAt: new Date('2026-03-25T00:00:00.000Z'),
			updatedAt: new Date('2026-03-25T00:00:00.000Z')
		});
		mocked.state.authApi.getSession.mockResolvedValue({
			session: { id: 'session-1' },
			user: {
				id: 'auth-user-1',
				name: 'artist_1',
				email: 'artist_1@not-the-louvre.local',
				emailVerified: true,
				image: null
			}
		});

		const { resolveSessionContext } = await import('./service');
		const sessionContext = await resolveSessionContext(new Headers());

		expect(sessionContext).toMatchObject({
			user: {
				id: 'auth-user-1',
				authUserId: 'auth-user-1',
				nickname: 'artist_1',
				role: 'moderator'
			}
		});
	});

	it('flags integrity failures when a session has no companion product user', async () => {
		mocked.state.authApi.getSession.mockResolvedValue({
			session: { id: 'session-1' },
			user: {
				id: 'auth-user-1',
				name: 'artist_1',
				email: 'artist_1@not-the-louvre.local',
				emailVerified: true,
				image: null
			}
		});

		const { resolveSessionContext } = await import('./service');
		const sessionContext = await resolveSessionContext(new Headers());

		expect(sessionContext).toMatchObject({
			reason: 'missing-product-user'
		});
	});

	it('treats invalid auth sessions as unauthenticated', async () => {
		mocked.state.authApi.getSession.mockRejectedValue(new mocked.APIError('session expired'));

		const { resolveSessionContext } = await import('./service');
		const sessionContext = await resolveSessionContext(new Headers());

		expect(sessionContext).toBeNull();
	});

	it('rejects invalid recovery keys without changing password or rotating the stored hash', async () => {
		mocked.state.profiles.set('auth-user-1', {
			id: 'auth-user-1',
			nickname: 'artist_1',
			recoveryHash: 'hash:correct-recovery-key-1234567890',
			role: 'user',
			avatarUrl: null,
			createdAt: new Date('2026-03-25T00:00:00.000Z'),
			updatedAt: new Date('2026-03-25T00:00:00.000Z')
		});
		mocked.state.accounts.set('auth-user-1', {
			userId: 'auth-user-1',
			password: 'hash:oldpassword123'
		});

		const { recoverAccount } = await import('./service');

		await expect(
			recoverAccount(
				{
					nickname: 'artist_1',
					recoveryKey: 'wrong-recovery-key-123456789012345',
					newPassword: 'newpassword123'
				},
				'127.0.0.1'
			)
		).rejects.toMatchObject({
			code: 'RECOVERY_FAILED',
			status: 401
		});

		expect(mocked.state.accounts.get('auth-user-1')).toMatchObject({
			password: 'hash:oldpassword123'
		});
		expect(mocked.state.profiles.get('auth-user-1')).toMatchObject({
			recoveryHash: 'hash:correct-recovery-key-1234567890'
		});
	});

	it('rotates the recovery key and invalidates the previous key after a successful recovery', async () => {
		mocked.state.profiles.set('auth-user-1', {
			id: 'auth-user-1',
			nickname: 'artist_1',
			recoveryHash: 'hash:old-recovery-key-1234567890123456',
			role: 'user',
			avatarUrl: null,
			createdAt: new Date('2026-03-25T00:00:00.000Z'),
			updatedAt: new Date('2026-03-25T00:00:00.000Z')
		});
		mocked.state.accounts.set('auth-user-1', {
			userId: 'auth-user-1',
			password: 'hash:oldpassword123'
		});

		const { recoverAccount } = await import('./service');
		const result = await recoverAccount(
			{
				nickname: 'artist_1',
				recoveryKey: 'old-recovery-key-1234567890123456',
				newPassword: 'newpassword123'
			},
			'127.0.0.1'
		);

		expect(result.recoveryKey).toHaveLength(36);
		expect(mocked.state.accounts.get('auth-user-1')).toMatchObject({
			password: 'hash:newpassword123'
		});
		expect(mocked.state.profiles.get('auth-user-1')).toMatchObject({
			recoveryHash: `hash:${result.recoveryKey}`
		});

		await expect(
			recoverAccount(
				{
					nickname: 'artist_1',
					recoveryKey: 'old-recovery-key-1234567890123456',
					newPassword: 'anotherpassword123'
				},
				'127.0.0.1'
			)
		).rejects.toMatchObject({
			code: 'RECOVERY_FAILED',
			status: 401
		});
	});

	it('keeps login rate limiting active after a module reload to simulate process restart', async () => {
		mocked.state.authApi.signInUsername.mockRejectedValue(new mocked.APIError('wrong password'));

		const { signInWithNickname } = await import('./service');

		for (let attempt = 0; attempt < 4; attempt += 1) {
			await expect(
				signInWithNickname({ nickname: 'artist_1', password: 'wrongpassword123' }, '127.0.0.1')
			).rejects.toMatchObject({
				code: 'INVALID_CREDENTIALS',
				status: 401
			});
		}

		await expect(
			signInWithNickname({ nickname: 'artist_1', password: 'wrongpassword123' }, '127.0.0.1')
		).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			status: 429
		});

		vi.resetModules();

		const { signInWithNickname: signInAfterRestart } = await import('./service');

		await expect(
			signInAfterRestart({ nickname: 'artist_1', password: 'wrongpassword123' }, '127.0.0.1')
		).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			status: 429
		});

		expect(mocked.state.authApi.signInUsername).toHaveBeenCalledTimes(5);
	});

	it('logs auth abuse-limit denials without leaking secrets', async () => {
		mocked.state.authApi.signInUsername.mockRejectedValue(new mocked.APIError('wrong password'));

		const { signInWithNickname } = await import('./service');

		for (let attempt = 0; attempt < 4; attempt += 1) {
			await expect(
				signInWithNickname({ nickname: 'artist_1', password: 'wrongpassword123' }, '127.0.0.1')
			).rejects.toMatchObject({
				code: 'INVALID_CREDENTIALS',
				status: 401
			});
		}

		await expect(
			signInWithNickname({ nickname: 'artist_1', password: 'wrongpassword123' }, '127.0.0.1')
		).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			status: 429
		});

		expect(securityLogging.logSecurityEvent).toHaveBeenCalledWith(
			'auth.abuse_limit_denied',
			expect.objectContaining({
				identifier: 'artist_1',
				ipAddress: '127.0.0.1',
				kind: 'login'
			})
		);
		expect(securityLogging.logSecurityEvent).not.toHaveBeenCalledWith(
			'auth.abuse_limit_denied',
			expect.objectContaining({
				password: expect.any(String)
			})
		);
	});
});
