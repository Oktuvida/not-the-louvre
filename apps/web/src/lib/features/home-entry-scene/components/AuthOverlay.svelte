<script lang="ts">
	import { gsap } from 'gsap';
	import { NICKNAME_PATTERN, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '$lib/auth/config';
	import AvatarSketchpad from '$lib/features/home-entry-scene/components/AvatarSketchpad.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import StudioPanel from '$lib/features/shared-ui/components/StudioPanel.svelte';
	import type {
		EntryFlowEvent,
		EntryFlowState
	} from '$lib/features/home-entry-scene/state/entry-state.svelte';

	type AuthView =
		| 'login'
		| 'signup-account'
		| 'signup-success'
		| 'signup-avatar'
		| 'recover'
		| 'recover-success';
	type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

	let {
		entryState,
		dispatch,
		onAuthResolved,
		overlayElement = $bindable<HTMLDivElement | null>(null)
	}: {
		entryState: EntryFlowState;
		dispatch: (event: EntryFlowEvent) => void;
		onAuthResolved?: (nickname: string) => void;
		overlayElement?: HTMLDivElement | null;
	} = $props();

	let view = $state<AuthView>('login');
	let nickname = $state('');
	let password = $state('');
	let recoveryKey = $state('');
	let newPassword = $state('');
	let oneTimeKey = $state('');
	let nicknameError = $state('');
	let passwordError = $state('');
	let recoveryKeyError = $state('');
	let newPasswordError = $state('');
	let formError = $state('');
	let rateLimitError = $state('');
	let availabilityState = $state<AvailabilityState>('idle');
	let availabilityMessage = $state('');
	let checkToken = $state('');
	let isSubmitting = $state(false);
	let debounceHandle: ReturnType<typeof setTimeout> | null = null;

	const takenNicknames = new Set(['artist_1', 'museum_owner', 'curator']);
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	const normalizeNickname = (value: string) => value.trim().toLowerCase();
	const isValidNickname = (value: string) => NICKNAME_PATTERN.test(normalizeNickname(value));
	const createMockRecoveryKey = (value: string, prefix: 'studio' | 'recovery') => {
		const seed = normalizeNickname(value) || 'guest';
		return `${prefix}-${seed}-key`;
	};

	const isInteractive = $derived(
		entryState === 'auth-login' || entryState === 'auth-signup' || entryState === 'auth-recovery'
	);
	const isSignUpFlow = $derived(
		view === 'signup-account' || view === 'signup-success' || view === 'signup-avatar'
	);

	const resetMessages = () => {
		nicknameError = '';
		passwordError = '';
		recoveryKeyError = '';
		newPasswordError = '';
		formError = '';
		rateLimitError = '';
	};

	const resetAvailability = () => {
		availabilityState = 'idle';
		availabilityMessage = '';
	};

	const syncViewWithState = () => {
		if (entryState === 'auth-login') {
			view = 'login';
			return;
		}

		if (entryState === 'auth-signup' && !isSignUpFlow) {
			view = 'signup-account';
			return;
		}

		if (entryState === 'auth-recovery' && view !== 'recover' && view !== 'recover-success') {
			view = 'recover';
		}
	};

	$effect(() => {
		syncViewWithState();
	});

	$effect(() => {
		if (!overlayElement) return;
		gsap.killTweensOf(overlayElement);
		if (isInteractive) {
			gsap.to(overlayElement, { opacity: 1, scale: 1, duration: 0.34, ease: 'power2.out' });
		}
	});

	const validateNickname = (value: string) => {
		if (!value.trim()) return 'Nickname is required';
		if (!isValidNickname(value)) return 'Use 3-20 lowercase letters, numbers, or underscores';
		return '';
	};

	const validatePassword = (value: string, label = 'Password') => {
		if (!value) return `${label} is required`;
		if (value.length < PASSWORD_MIN_LENGTH) {
			return `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`;
		}
		if (value.length > PASSWORD_MAX_LENGTH) {
			return `${label} must be at most ${PASSWORD_MAX_LENGTH} characters`;
		}
		return '';
	};

	const validateRecoveryKey = (value: string) => {
		if (!value.trim()) return 'Recovery key is required';
		if (value.trim().length !== 36) return 'Recovery key must be a UUIDv4 string';
		return '';
	};

	const applySubmitError = (error: unknown) => {
		const authError = error as { code?: string; message?: string; status?: number } | undefined;
		if (authError?.status === 429 || authError?.code === 'RATE_LIMITED') {
			rateLimitError =
				authError.message ?? 'Too many attempts. Please wait a moment and try again.';
			return;
		}
		if (authError?.code === 'NICKNAME_TAKEN') {
			nicknameError = 'That nickname is already taken';
			return;
		}
		if (authError?.code === 'RECOVERY_FAILED') {
			formError = 'Recovery failed. Check your nickname, recovery key, and new password.';
			return;
		}
		formError = authError?.message ?? 'Network error. Please try again.';
	};

	const runAvailabilityCheck = async (value: string) => {
		checkToken = value;
		availabilityState = 'checking';
		availabilityMessage = 'Checking nickname...';

		try {
			await wait(180);
			if (checkToken !== value) return;

			if (!isValidNickname(value)) {
				availabilityState = 'invalid';
				availabilityMessage = 'Choose a valid nickname first';
				return;
			}

			if (!takenNicknames.has(value)) {
				availabilityState = 'available';
				availabilityMessage = 'Nickname available';
				return;
			}

			availabilityState = 'taken';
			availabilityMessage = 'That nickname is already taken';
		} catch {
			if (checkToken !== value) return;
			availabilityState = 'idle';
			availabilityMessage = 'Could not check nickname right now';
		}
	};

	$effect(() => {
		if (debounceHandle) clearTimeout(debounceHandle);

		if (view !== 'signup-account') {
			resetAvailability();
			return;
		}

		const trimmedNickname = nickname.trim().toLowerCase();
		const error = validateNickname(trimmedNickname);
		if (error) {
			availabilityState = trimmedNickname ? 'invalid' : 'idle';
			availabilityMessage = trimmedNickname ? 'Choose a valid nickname first' : '';
			return;
		}

		debounceHandle = setTimeout(() => {
			void runAvailabilityCheck(trimmedNickname);
		}, 300);

		return () => {
			if (debounceHandle) clearTimeout(debounceHandle);
		};
	});

	const submitSignIn = async () => {
		const trimmedNickname = normalizeNickname(nickname);
		nickname = trimmedNickname;
		nicknameError = validateNickname(trimmedNickname);
		passwordError = validatePassword(password);

		if (nicknameError || passwordError) return;

		await wait(220);
		onAuthResolved?.(trimmedNickname);
		dispatch('AUTH_SUCCESS');
	};

	const submitSignUp = async () => {
		const trimmedNickname = normalizeNickname(nickname);
		nickname = trimmedNickname;
		nicknameError = validateNickname(trimmedNickname);
		passwordError = validatePassword(password);

		if (availabilityState === 'taken' || takenNicknames.has(trimmedNickname)) {
			nicknameError = 'That nickname is already taken';
		}

		if (nicknameError || passwordError) return;

		await wait(260);
		onAuthResolved?.(trimmedNickname);
		oneTimeKey = createMockRecoveryKey(trimmedNickname, 'studio');
		view = 'signup-success';
	};

	const submitRecovery = async () => {
		const trimmedNickname = normalizeNickname(nickname);
		nickname = trimmedNickname;
		nicknameError = validateNickname(trimmedNickname);
		recoveryKeyError = validateRecoveryKey(recoveryKey);
		newPasswordError = validatePassword(newPassword, 'New password');

		if (nicknameError || recoveryKeyError || newPasswordError) return;

		await wait(240);
		oneTimeKey = createMockRecoveryKey(trimmedNickname, 'recovery');
		password = newPassword;
		view = 'recover-success';
	};

	const handleSubmit = async () => {
		resetMessages();
		isSubmitting = true;

		try {
			if (view === 'login') await submitSignIn();
			else if (view === 'signup-account') await submitSignUp();
			else if (view === 'recover') await submitRecovery();
		} catch (error) {
			applySubmitError(error);
		} finally {
			isSubmitting = false;
		}
	};

	const goToLogin = () => {
		resetMessages();
		view = 'login';
		dispatch('SHOW_LOGIN');
	};

	const goToSignup = () => {
		resetMessages();
		view = 'signup-account';
		dispatch('SHOW_SIGN_UP');
	};

	const goToRecovery = () => {
		resetMessages();
		view = 'recover';
		dispatch('SHOW_RECOVERY');
	};
</script>

<div
	bind:this={overlayElement}
	data-testid="auth-overlay"
	class={`absolute inset-0 z-[40] flex items-center justify-center bg-[rgba(24,15,8,0.16)] px-6 py-10 opacity-0 ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
	style="transform: scale(0.95);"
	aria-hidden={!isInteractive}
>
	<StudioPanel
		tone="paper"
		className="pointer-events-auto w-full max-w-[40rem] border-[#2d2a26] bg-[rgba(255,252,246,0.97)] text-[#2d2a26]"
	>
		<div class="space-y-5 p-6 md:p-8">
			<div class="flex items-start justify-between gap-4">
				<div class="space-y-2">
					<p class="text-xs font-semibold tracking-[0.22em] text-[#8d6c52] uppercase">
						Studio Access
					</p>
					<h2 class="font-display text-3xl tracking-[0.06em] text-[#2d2a26] uppercase">
						{view === 'signup-account'
							? 'Draw yourself'
							: view === 'signup-success'
								? 'Keep this key'
								: view === 'signup-avatar'
									? 'Finish your avatar'
									: view === 'recover'
										? 'Recover access'
										: view === 'recover-success'
											? 'Replacement key'
											: 'Welcome back'}
					</h2>
					<p class="text-sm text-[#5a554d]">
						{view === 'login'
							? 'The room missed you. Probably.'
							: view === 'signup-account'
								? 'Claim your nickname, then sketch the avatar that walks into the gallery.'
								: view === 'recover'
									? 'Use your one-time recovery key to get back inside.'
									: 'One more step and you are in.'}
					</p>
				</div>
				<button
					type="button"
					onclick={() => dispatch('AUTH_CANCEL')}
					class="rounded-full border-2 border-[#2d2a26] bg-white/80 px-3 py-2 text-xs font-semibold tracking-[0.18em] text-[#5d4737] uppercase transition hover:-translate-y-0.5"
				>
					Close
				</button>
			</div>

			{#if view === 'login' || view === 'signup-account'}
				<div
					class="grid grid-cols-2 gap-2 rounded-[1rem] border-2 border-[#2d2a26] bg-[#f3ebdd] p-1.5"
				>
					<button
						type="button"
						onclick={goToLogin}
						class={`rounded-[0.8rem] px-4 py-2 text-sm font-bold tracking-[0.12em] uppercase transition ${view === 'login' ? 'bg-[#2d2a26] text-[#f5f0e1]' : 'text-[#5a554d]'}`}
					>
						Log in
					</button>
					<button
						type="button"
						onclick={goToSignup}
						class={`rounded-[0.8rem] px-4 py-2 text-sm font-bold tracking-[0.12em] uppercase transition ${view === 'signup-account' ? 'bg-[#2d2a26] text-[#f5f0e1]' : 'text-[#5a554d]'}`}
					>
						Sign up
					</button>
				</div>
			{/if}

			{#if rateLimitError}
				<div
					class="rounded-[1rem] border-2 border-[#9c432b] bg-[#f4d0bf] px-4 py-3 text-sm text-[#6f2413]"
				>
					{rateLimitError}
				</div>
			{/if}
			{#if formError}
				<div
					class="rounded-[1rem] border-2 border-[#9c432b] bg-[#f7e1d7] px-4 py-3 text-sm text-[#6f2413]"
				>
					{formError}
				</div>
			{/if}

			{#if view === 'login' || view === 'signup-account'}
				<div class="space-y-4">
					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Nickname</span
						>
						<input
							bind:value={nickname}
							type="text"
							placeholder="artist_123"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if nicknameError}
						<p class="text-sm text-[#8f3720]">{nicknameError}</p>
					{:else if view === 'signup-account' && availabilityMessage}
						<p
							class={`text-sm ${availabilityState === 'taken' ? 'text-[#8f3720]' : availabilityState === 'available' ? 'text-[#35613f]' : 'text-[#6f5846]'}`}
						>
							{availabilityMessage}
						</p>
					{/if}

					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Password</span
						>
						<input
							bind:value={password}
							type="password"
							placeholder="Enter your password"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if passwordError}
						<p class="text-sm text-[#8f3720]">{passwordError}</p>
					{/if}
				</div>

				<div class="flex items-center justify-between gap-3 pt-2">
					{#if view === 'login'}
						<button
							type="button"
							onclick={goToRecovery}
							class="text-xs tracking-[0.18em] text-[#8d6c52] uppercase underline-offset-4 hover:underline"
						>
							Use recovery key
						</button>
					{:else}
						<p class="text-xs tracking-[0.18em] text-[#8d6c52] uppercase">
							Step 1: claim your wall
						</p>
					{/if}

					<GameButton
						onclick={handleSubmit}
						disabled={isSubmitting}
						className="gap-3 px-6 py-3 text-sm font-black"
					>
						<span
							>{isSubmitting ? 'Working...' : view === 'login' ? 'Sign In' : 'Start account'}</span
						>
					</GameButton>
				</div>
			{:else if view === 'recover'}
				<div class="space-y-4">
					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Nickname</span
						>
						<input
							bind:value={nickname}
							type="text"
							placeholder="artist_123"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if nicknameError}<p class="text-sm text-[#8f3720]">{nicknameError}</p>{/if}

					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Recovery Key</span
						>
						<input
							bind:value={recoveryKey}
							type="text"
							placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if recoveryKeyError}<p class="text-sm text-[#8f3720]">{recoveryKeyError}</p>{/if}

					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>New Password</span
						>
						<input
							bind:value={newPassword}
							type="password"
							placeholder="Choose a new password"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if newPasswordError}<p class="text-sm text-[#8f3720]">{newPasswordError}</p>{/if}
				</div>

				<div class="flex items-center justify-between gap-3 pt-2">
					<button
						type="button"
						onclick={goToLogin}
						class="text-xs tracking-[0.18em] text-[#8d6c52] uppercase underline-offset-4 hover:underline"
					>
						Log in
					</button>
					<GameButton
						onclick={handleSubmit}
						disabled={isSubmitting}
						className="gap-3 px-6 py-3 text-sm font-black"
					>
						<span>{isSubmitting ? 'Working...' : 'Recover Access'}</span>
					</GameButton>
				</div>
			{:else if view === 'signup-success' || view === 'recover-success'}
				<div class="space-y-4 rounded-[1.4rem] border-2 border-[#d7c2ab] bg-[#fff8ef] p-5">
					<p class="text-sm tracking-[0.18em] text-[#8d6c52] uppercase">One-time key</p>
					<p
						class="rounded-[1rem] border-2 border-[#2d2a26] bg-[#2d2a26] px-4 py-4 font-mono text-sm text-[#f5f0e1]"
					>
						{oneTimeKey}
					</p>
					<p class="text-sm text-[#5d4737]">
						{view === 'signup-success'
							? 'Store this recovery key now. It will not be shown again after you continue.'
							: 'Your password was reset and your old recovery key is now invalid. Store this replacement key now.'}
					</p>
				</div>

				<div class="flex items-center justify-end pt-2">
					<GameButton
						onclick={() => {
							if (view === 'signup-success') {
								view = 'signup-avatar';
								return;
							}

							goToLogin();
						}}
						className="gap-3 px-6 py-3 text-sm font-black"
					>
						<span>{view === 'signup-success' ? 'I Stored It' : 'Back To Sign In'}</span>
					</GameButton>
				</div>
			{:else}
				<AvatarSketchpad {nickname} onContinue={() => dispatch('AUTH_SUCCESS')} />
			{/if}
		</div>
	</StudioPanel>
</div>
