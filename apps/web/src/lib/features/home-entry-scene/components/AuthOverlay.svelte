<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { gsap } from 'gsap';
	import { NICKNAME_PATTERN, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '$lib/auth/config';
	import type {
		HomeAuthActionData,
		HomeAuthActionForm,
		HomeAuthUser,
		HomeAuthAvailability
	} from '$lib/features/home-entry-scene/auth-contract';
	import AvatarSketchpad from '$lib/features/home-entry-scene/components/AvatarSketchpad.svelte';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import StudioPanel from '$lib/features/shared-ui/components/StudioPanel.svelte';
	import type {
		EntryFlowEvent,
		EntryFlowState
	} from '$lib/features/home-entry-scene/state/entry-state.svelte';

	type AuthView =
		| 'login'
		| 'recover'
		| 'recover-success'
		| 'signup-account'
		| 'signup-avatar'
		| 'signup-success';
	type AvailabilityState = 'available' | 'checking' | 'idle' | 'invalid' | 'taken';

	let {
		entryState,
		dispatch,
		authenticatedUser = null,
		form,
		onAvatarDismiss,
		onAvatarSaved,
		resumeAvatarOnboarding = false,
		overlayElement = $bindable<HTMLDivElement | null>(null)
	}: {
		entryState: EntryFlowState;
		dispatch: (event: EntryFlowEvent) => void;
		authenticatedUser?: HomeAuthUser | null;
		form?: HomeAuthActionForm;
		onAvatarDismiss?: () => void;
		onAvatarSaved?: () => void;
		resumeAvatarOnboarding?: boolean;
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
	let lastHandledFormKey = $state('');
	let isSubmitting = $state(false);
	let debounceHandle: ReturnType<typeof setTimeout> | null = null;
	let loginFormElement = $state<HTMLFormElement | null>(null);
	let signupFormElement = $state<HTMLFormElement | null>(null);
	let recoveryFormElement = $state<HTMLFormElement | null>(null);

	const isInteractive = $derived(
		entryState === 'auth-login' || entryState === 'auth-signup' || entryState === 'auth-recovery'
	);
	const isSignUpFlow = $derived(
		view === 'signup-account' || view === 'signup-success' || view === 'signup-avatar'
	);

	const normalizeNickname = (value: string) => value.trim().toLowerCase();
	const isValidNickname = (value: string) => NICKNAME_PATTERN.test(normalizeNickname(value));

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
		if (resumeAvatarOnboarding && entryState === 'auth-signup') {
			view = 'signup-avatar';
			if (authenticatedUser?.nickname) {
				nickname = authenticatedUser.nickname;
			}
			return;
		}

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

	const applyAvailabilityResult = (availability: HomeAuthAvailability) => {
		availabilityState = availability;
		availabilityMessage =
			availability === 'available'
				? 'Nickname available'
				: availability === 'taken'
					? 'That nickname is already taken'
					: 'Choose a valid nickname first';
	};

	const applySubmitFailure = (result: Extract<HomeAuthActionData, { message: string }>) => {
		if (result.code === 'RATE_LIMITED') {
			rateLimitError = result.message ?? 'Too many attempts. Please wait a moment and try again.';
			return;
		}

		if (result.code === 'NICKNAME_TAKEN') {
			nicknameError = 'That nickname is already taken';
			return;
		}

		if (result.code === 'RECOVERY_FAILED') {
			formError = 'Recovery failed. Check your nickname, recovery key, and new password.';
			return;
		}

		formError = result.message ?? 'Network error. Please try again.';
	};

	const handleActionResult = (actionData: HomeAuthActionData) => {
		resetMessages();

		if (actionData.action === 'checkNickname' && 'availability' in actionData) {
			applyAvailabilityResult(actionData.availability);
			return;
		}

		if (actionData.action === 'signUp' && 'success' in actionData) {
			oneTimeKey = actionData.recoveryKey;
			view = 'signup-success';
			return;
		}

		if (actionData.action === 'recover' && 'success' in actionData) {
			oneTimeKey = actionData.recoveryKey;
			password = newPassword;
			view = 'recover-success';
			return;
		}

		if ('message' in actionData) {
			applySubmitFailure(actionData);
		}
	};

	const getFormKey = (actionData?: HomeAuthActionData) => JSON.stringify(actionData ?? null);

	const validateSignIn = () => {
		const trimmedNickname = normalizeNickname(nickname);
		nickname = trimmedNickname;
		nicknameError = validateNickname(trimmedNickname);
		passwordError = validatePassword(password);

		return !nicknameError && !passwordError;
	};

	const validateSignUp = () => {
		const trimmedNickname = normalizeNickname(nickname);
		nickname = trimmedNickname;
		nicknameError = validateNickname(trimmedNickname);
		passwordError = validatePassword(password);

		if (availabilityState === 'taken') {
			nicknameError = 'That nickname is already taken';
		}

		return !nicknameError && !passwordError;
	};

	const validateRecovery = () => {
		const trimmedNickname = normalizeNickname(nickname);
		nickname = trimmedNickname;
		nicknameError = validateNickname(trimmedNickname);
		recoveryKeyError = validateRecoveryKey(recoveryKey);
		newPasswordError = validatePassword(newPassword, 'New password');

		return !nicknameError && !recoveryKeyError && !newPasswordError;
	};

	const createEnhancer = () => {
		resetMessages();
		isSubmitting = true;

		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			isSubmitting = false;
		};
	};

	const handleLoginSubmit = (event: SubmitEvent) => {
		if (!validateSignIn()) {
			event.preventDefault();
		}
	};

	const handleSignupSubmit = (event: SubmitEvent) => {
		if (!validateSignUp()) {
			event.preventDefault();
		}
	};

	const handleRecoverySubmit = (event: SubmitEvent) => {
		if (!validateRecovery()) {
			event.preventDefault();
		}
	};

	const submitLogin = () => {
		if (!validateSignIn()) return;
		loginFormElement?.requestSubmit();
	};

	const submitSignup = () => {
		if (!validateSignUp()) return;
		signupFormElement?.requestSubmit();
	};

	const submitRecovery = () => {
		if (!validateRecovery()) return;
		recoveryFormElement?.requestSubmit();
	};

	const goToLogin = () => {
		resetMessages();
		resetAvailability();
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

	const enterStudio = () => {
		if (!authenticatedUser) {
			formError = 'Sign in before entering the studio.';
			return;
		}

		dispatch('AUTH_SUCCESS');
	};

	const runAvailabilityCheck = async (value: string) => {
		checkToken = value;
		availabilityState = 'checking';
		availabilityMessage = 'Checking nickname...';

		try {
			if (checkToken !== value) return;

			if (!isValidNickname(value)) {
				applyAvailabilityResult('invalid');
				return;
			}

			const formData = new FormData();
			formData.set('nickname', value);

			const response = await fetch('?/checkNickname', {
				body: formData,
				headers: {
					'x-sveltekit-action': 'true'
				},
				method: 'POST'
			});
			const result = deserialize(await response.text());

			if (checkToken !== value) return;

			if ((result.type === 'failure' || result.type === 'success') && result.data) {
				handleActionResult(result.data as HomeAuthActionData);
				return;
			}

			availabilityState = 'idle';
			availabilityMessage = 'Could not check nickname right now';
		} catch {
			if (checkToken !== value) return;
			availabilityState = 'idle';
			availabilityMessage = 'Could not check nickname right now';
		}
	};

	const saveAvatar = async (file: File) => {
		if (!authenticatedUser?.id) {
			return {
				message: 'Your session is not ready for avatar upload. Please sign in again.',
				success: false as const
			};
		}

		const formData = new FormData();
		formData.set('file', file);

		const response = await fetch(`/api/users/${authenticatedUser.id}/avatar`, {
			body: formData,
			method: 'PUT'
		});

		if (response.ok) {
			onAvatarSaved?.();
			return { success: true as const };
		}

		try {
			const data = (await response.json()) as { code?: string; message?: string };

			return {
				code: data.code,
				message: data.message ?? 'Avatar save failed. Please try again.',
				success: false as const
			};
		} catch {
			// Ignore invalid error bodies and fall back to a generic message.
		}

		return {
			message: 'Avatar save failed. Please try again.',
			success: false as const
		};
	};

	$effect(() => {
		syncViewWithState();
	});

	$effect(() => {
		if (!overlayElement) return;
		gsap.killTweensOf(overlayElement);
		if (isInteractive) {
			gsap.to(overlayElement, { duration: 0.34, ease: 'power2.out', opacity: 1, scale: 1 });
			return;
		}

		gsap.to(overlayElement, { duration: 0.24, ease: 'power2.in', opacity: 0, scale: 0.95 });
	});

	$effect(() => {
		if (!form) return;

		const nextFormKey = getFormKey(form);
		if (nextFormKey === lastHandledFormKey) return;

		lastHandledFormKey = nextFormKey;
		handleActionResult(form);
	});

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
					onclick={() => {
						if (view === 'signup-avatar') {
							onAvatarDismiss?.();
							dispatch('AUTH_SUCCESS');
							return;
						}

						dispatch('AUTH_CANCEL');
					}}
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

			{#if view === 'login'}
				<form
					bind:this={loginFormElement}
					method="POST"
					action="?/signIn"
					use:enhance={createEnhancer}
					onsubmit={handleLoginSubmit}
					class="space-y-4"
				>
					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Nickname</span
						>
						<input
							bind:value={nickname}
							name="nickname"
							type="text"
							placeholder="artist_123"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if nicknameError}<p class="text-sm text-[#8f3720]">{nicknameError}</p>{/if}

					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Password</span
						>
						<input
							bind:value={password}
							name="password"
							type="password"
							placeholder="Enter your password"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if passwordError}<p class="text-sm text-[#8f3720]">{passwordError}</p>{/if}

					<div class="flex items-center justify-between gap-3 pt-2">
						<button
							type="button"
							onclick={goToRecovery}
							class="text-xs tracking-[0.18em] text-[#8d6c52] uppercase underline-offset-4 hover:underline"
						>
							Use recovery key
						</button>

						<GameButton
							type="button"
							onclick={submitLogin}
							disabled={isSubmitting}
							className="gap-3 px-6 py-3 text-sm font-black"
						>
							<span>{isSubmitting ? 'Working...' : 'Sign In'}</span>
						</GameButton>
					</div>
				</form>
			{:else if view === 'signup-account'}
				<form
					bind:this={signupFormElement}
					method="POST"
					action="?/signUp"
					use:enhance={createEnhancer}
					onsubmit={handleSignupSubmit}
					class="space-y-4"
				>
					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Nickname</span
						>
						<input
							bind:value={nickname}
							name="nickname"
							type="text"
							placeholder="artist_123"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if nicknameError}
						<p class="text-sm text-[#8f3720]">{nicknameError}</p>
					{:else if availabilityMessage}
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
							name="password"
							type="password"
							placeholder="Enter your password"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if passwordError}<p class="text-sm text-[#8f3720]">{passwordError}</p>{/if}

					<div class="flex items-center justify-between gap-3 pt-2">
						<p class="text-xs tracking-[0.18em] text-[#8d6c52] uppercase">
							Step 1: claim your wall
						</p>

						<GameButton
							type="button"
							onclick={submitSignup}
							disabled={isSubmitting}
							className="gap-3 px-6 py-3 text-sm font-black"
						>
							<span>{isSubmitting ? 'Working...' : 'Start account'}</span>
						</GameButton>
					</div>
				</form>
			{:else if view === 'recover'}
				<form
					bind:this={recoveryFormElement}
					method="POST"
					action="?/recover"
					use:enhance={createEnhancer}
					onsubmit={handleRecoverySubmit}
					class="space-y-4"
				>
					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-[#86654b] uppercase"
							>Nickname</span
						>
						<input
							bind:value={nickname}
							name="nickname"
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
							name="recoveryKey"
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
							name="newPassword"
							type="password"
							placeholder="Choose a new password"
							class="w-full rounded-[1rem] border-2 border-[#c8af95] bg-[#f5f0e1] px-4 py-3 text-base transition outline-none focus:border-[#4ecdc4]"
						/>
					</label>
					{#if newPasswordError}<p class="text-sm text-[#8f3720]">{newPasswordError}</p>{/if}

					<div class="flex items-center justify-between gap-3 pt-2">
						<button
							type="button"
							onclick={goToLogin}
							class="text-xs tracking-[0.18em] text-[#8d6c52] uppercase underline-offset-4 hover:underline"
						>
							Log in
						</button>
						<GameButton
							type="button"
							onclick={submitRecovery}
							disabled={isSubmitting}
							className="gap-3 px-6 py-3 text-sm font-black"
						>
							<span>{isSubmitting ? 'Working...' : 'Recover Access'}</span>
						</GameButton>
					</div>
				</form>
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
				<AvatarSketchpad {nickname} {saveAvatar} onContinue={enterStudio} />
			{/if}
		</div>
	</StudioPanel>
</div>
