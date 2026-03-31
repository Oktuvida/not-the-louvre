<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { gsap } from '$lib/client/gsap';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import { parseDrawingDocument } from '$lib/features/stroke-json/document';
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
	import { dispatchAvatarFaviconUpdate } from '$lib/favicon';

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
		checkTextContent = defaultCheckTextContent,
		form,
		onAvatarDismiss,
		onAvatarSaved,
		resumeAvatarOnboarding = false,
		overlayElement = $bindable<HTMLDivElement | null>(null)
	}: {
		entryState: EntryFlowState;
		dispatch: (event: EntryFlowEvent) => void;
		authenticatedUser?: HomeAuthUser | null;
		checkTextContent?: TextContentChecker;
		form?: HomeAuthActionForm;
		onAvatarDismiss?: () => void;
		onAvatarSaved?: (payload: {
			avatarDrawingDocument?: import('$lib/features/stroke-json/document').DrawingDocumentV1 | null;
			avatarOnboardingCompletedAt: Date;
			avatarUrl: string;
		}) => void;
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
	let allowValidatedSignupSubmit = $state(false);

	const isInteractive = $derived(
		entryState === 'auth-login' || entryState === 'auth-signup' || entryState === 'auth-recovery'
	);
	const isSignUpFlow = $derived(
		view === 'signup-account' || view === 'signup-success' || view === 'signup-avatar'
	);
	const isAvatarView = $derived(view === 'signup-avatar');
	const panelClassName = $derived(
		isAvatarView
			? 'w-full max-w-[50rem] border-[var(--color-ink)] bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(247,239,228,0.98))] text-[var(--color-ink)]'
			: 'w-full max-w-[44rem] border-[var(--color-ink)] bg-[linear-gradient(180deg,rgba(255,252,246,0.97),rgba(248,241,230,0.97))] text-[var(--color-ink)]'
	);
	const contentClassName = $derived(
		isAvatarView ? 'space-y-4 p-4 md:p-5 lg:p-6' : 'min-h-[26rem] space-y-5 p-6 md:p-8'
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

	const validateSignUp = async () => {
		const trimmedNickname = normalizeNickname(nickname);
		nickname = trimmedNickname;
		nicknameError = validateNickname(trimmedNickname);
		passwordError = validatePassword(password);

		if (availabilityState === 'taken') {
			nicknameError = 'That nickname is already taken';
		}

		if (nicknameError || passwordError) {
			return false;
		}

		const moderationResult = await checkTextContent(trimmedNickname, 'nickname');
		if (moderationResult.status !== 'allowed') {
			nicknameError = moderationResult.message;
			return false;
		}

		return true;
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

	const handleSignupSubmit = async (event: SubmitEvent) => {
		if (allowValidatedSignupSubmit) {
			allowValidatedSignupSubmit = false;
			return;
		}

		event.preventDefault();

		if (!(await validateSignUp())) {
			return;
		}

		allowValidatedSignupSubmit = true;
		signupFormElement?.requestSubmit();
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

	const submitSignup = async () => {
		if (isSubmitting || allowValidatedSignupSubmit) return;
		if (!(await validateSignUp())) return;
		allowValidatedSignupSubmit = true;
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

	const saveAvatar = async (drawingDocument: string) => {
		if (!authenticatedUser?.id) {
			return {
				message: 'Your session is not ready for avatar upload. Please sign in again.',
				success: false as const
			};
		}

		const formData = new FormData();
		formData.set('drawingDocument', drawingDocument);

		const response = await fetch(`/api/users/${authenticatedUser.id}/avatar`, {
			body: formData,
			method: 'PUT'
		});

		if (response.ok) {
			const data = (await response.json()) as { avatarUrl?: string };

			if (!data.avatarUrl) {
				return {
					message: 'Avatar save succeeded but no avatar URL was returned.',
					success: false as const
				};
			}

			dispatchAvatarFaviconUpdate(authenticatedUser.id);
			onAvatarSaved?.({
				avatarDrawingDocument: parseDrawingDocument(drawingDocument),
				avatarOnboardingCompletedAt: new Date(),
				avatarUrl: data.avatarUrl
			});
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
	class={`absolute inset-0 z-[40] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,240,214,0.24),rgba(24,15,8,0.58))] px-4 py-6 opacity-0 md:px-6 md:py-10 ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
	style="transform: scale(0.95);"
	aria-hidden={!isInteractive}
>
	<StudioPanel
		tone="paper"
		className={`${panelClassName} ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
	>
		<div
			class="pointer-events-none absolute inset-x-8 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_72%)]"
		></div>
		<div class={contentClassName}>
			<div class="flex items-start justify-between gap-4">
				<div class="space-y-2">
					<p
						class="font-display text-xs font-semibold tracking-[0.28em] text-[var(--color-muted)] uppercase"
					>
						Studio Access
					</p>
					<h2
						class="font-display text-3xl tracking-[0.06em] text-[var(--color-ink)] uppercase md:text-4xl"
					>
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
					<p class="max-w-2xl text-sm text-[var(--color-muted)] md:text-base">
						{view === 'login'
							? 'The room missed you. Probably.'
							: view === 'signup-account'
								? 'Claim a nickname, sketch an avatar and step inside.'
								: view === 'recover'
									? 'Use your one-time recovery key to get back inside.'
									: 'One more step and you are in.'}
					</p>
				</div>
				<GameButton
					type="button"
					variant="ghost"
					size="sm"
					onclick={() => {
						if (view === 'signup-avatar') {
							onAvatarDismiss?.();
							dispatch('AUTH_SUCCESS');
							return;
						}

						dispatch('AUTH_CANCEL');
					}}
				>
					<span>Close</span>
				</GameButton>
			</div>

			{#if view === 'login' || view === 'signup-account'}
				<div class="grid grid-cols-2 gap-3">
					<GameButton
						type="button"
						variant={view === 'login' ? 'secondary' : 'ghost'}
						size="sm"
						onclick={goToLogin}
					>
						<span>Log in</span>
					</GameButton>
					<GameButton
						type="button"
						variant={view === 'signup-account' ? 'primary' : 'ghost'}
						size="sm"
						onclick={goToSignup}
					>
						<span>Sign up</span>
					</GameButton>
				</div>
			{/if}

			<div
				class="rounded-[1.25rem] border border-[rgb(141_108_82_/_0.2)] bg-[linear-gradient(180deg,rgb(255_248_238_/_0.92),rgb(245_235_220_/_0.92))] p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.45)] md:p-5"
			>
				{#if rateLimitError || formError}
					<div class="mb-4 space-y-2">
						{#if rateLimitError}
							<div
								class="rounded-[1rem] border-2 border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] px-4 py-3 text-sm text-[var(--color-danger)]"
							>
								{rateLimitError}
							</div>
						{/if}
						{#if formError}
							<div
								class="rounded-[1rem] border-2 border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] px-4 py-3 text-sm text-[var(--color-danger)]"
							>
								{formError}
							</div>
						{/if}
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
							<div class="flex items-start justify-between gap-3">
								<span
									class="font-display text-xs font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase"
									>Nickname</span
								>
								{#if nicknameError}
									<p class="text-right text-xs text-[var(--color-danger)]">{nicknameError}</p>
								{/if}
							</div>
							<input
								bind:value={nickname}
								name="nickname"
								type="text"
								placeholder="artist_123"
								class="font-body w-full rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)] px-4 py-3 text-base text-[var(--color-ink)] transition outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
							/>
						</label>

						<label class="block space-y-2">
							<div class="flex items-start justify-between gap-3">
								<span
									class="font-display text-xs font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase"
									>Password</span
								>
								{#if passwordError}
									<p class="text-right text-xs text-[var(--color-danger)]">{passwordError}</p>
								{/if}
							</div>
							<input
								bind:value={password}
								name="password"
								type="password"
								placeholder="Enter your password"
								class="font-body w-full rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)] px-4 py-3 text-base text-[var(--color-ink)] transition outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
							/>
						</label>

						<div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
							<GameButton
								type="button"
								variant="ghost"
								size="sm"
								className="w-full min-w-0 sm:w-auto sm:[--sticker-min-width:0px]"
								onclick={goToRecovery}
							>
								<span>Use recovery key</span>
							</GameButton>

							<GameButton
								type="button"
								onclick={submitLogin}
								disabled={isSubmitting}
								size="md"
								className="w-full min-w-0 sm:w-auto sm:[--sticker-min-width:0px]"
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
							<div class="flex items-start justify-between gap-3">
								<span
									class="font-display text-xs font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase"
									>Nickname</span
								>
								{#if nicknameError}
									<p class="text-right text-xs text-[var(--color-danger)]">{nicknameError}</p>
								{:else if availabilityMessage}
									<p
										class={`text-right text-xs ${availabilityState === 'taken' ? 'text-[var(--color-danger)]' : availabilityState === 'available' ? 'text-[var(--color-secondary)]' : 'text-[var(--color-muted)]'}`}
									>
										{availabilityMessage}
									</p>
								{/if}
							</div>
							<input
								bind:value={nickname}
								name="nickname"
								type="text"
								placeholder="artist_123"
								class="font-body w-full rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)] px-4 py-3 text-base text-[var(--color-ink)] transition outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
							/>
						</label>

						<label class="block space-y-2">
							<div class="flex items-start justify-between gap-3">
								<span
									class="font-display text-xs font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase"
									>Password</span
								>
								{#if passwordError}
									<p class="text-right text-xs text-[var(--color-danger)]">{passwordError}</p>
								{/if}
							</div>
							<input
								bind:value={password}
								name="password"
								type="password"
								placeholder="Enter your password"
								class="font-body w-full rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)] px-4 py-3 text-base text-[var(--color-ink)] transition outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
							/>
						</label>

						<div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
							<p class="font-display text-xs tracking-[0.18em] text-[var(--color-muted)] uppercase">
								Step 1: claim your wall
							</p>

							<GameButton
								type="button"
								onclick={submitSignup}
								disabled={isSubmitting}
								size="md"
								className="w-full min-w-0 sm:w-auto sm:[--sticker-min-width:0px]"
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
							<div class="flex items-start justify-between gap-3">
								<span
									class="font-display text-xs font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase"
									>Nickname</span
								>
								{#if nicknameError}
									<p class="text-right text-xs text-[var(--color-danger)]">{nicknameError}</p>
								{/if}
							</div>
							<input
								bind:value={nickname}
								name="nickname"
								type="text"
								placeholder="artist_123"
								class="font-body w-full rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)] px-4 py-3 text-base text-[var(--color-ink)] transition outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
							/>
						</label>

						<label class="block space-y-2">
							<span
								class="font-display text-xs font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase"
								>Recovery Key</span
							>
							<input
								bind:value={recoveryKey}
								name="recoveryKey"
								type="text"
								placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
								class="font-body w-full rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)] px-4 py-3 text-base text-[var(--color-ink)] transition outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
							/>
						</label>
						{#if recoveryKeyError}<p class="text-sm text-[var(--color-danger)]">
								{recoveryKeyError}
							</p>{/if}

						<label class="block space-y-2">
							<div class="flex items-start justify-between gap-3">
								<span
									class="font-display text-xs font-semibold tracking-[0.18em] text-[var(--color-muted)] uppercase"
									>New Password</span
								>
								{#if newPasswordError}
									<p class="text-right text-xs text-[var(--color-danger)]">{newPasswordError}</p>
								{/if}
							</div>
							<input
								bind:value={newPassword}
								name="newPassword"
								type="password"
								placeholder="Choose a new password"
								class="font-body w-full rounded-[1rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper-deep)] px-4 py-3 text-base text-[var(--color-ink)] transition outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
							/>
						</label>

						<div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
							<GameButton
								type="button"
								variant="ghost"
								size="sm"
								className="w-full min-w-0 sm:w-auto sm:[--sticker-min-width:0px]"
								onclick={goToLogin}
							>
								<span>Log in</span>
							</GameButton>
							<GameButton
								type="button"
								onclick={submitRecovery}
								disabled={isSubmitting}
								size="md"
								className="w-full min-w-0 sm:w-auto sm:[--sticker-min-width:0px]"
							>
								<span>{isSubmitting ? 'Working...' : 'Recover Access'}</span>
							</GameButton>
						</div>
					</form>
				{:else if view === 'signup-success' || view === 'recover-success'}
					<div
						class="space-y-4 rounded-[1.4rem] border-2 border-[var(--color-accent)] bg-[var(--color-paper)] p-5"
					>
						<p class="font-display text-sm tracking-[0.18em] text-[var(--color-muted)] uppercase">
							One-time key
						</p>
						<div class="relative">
							<p
								class="rounded-[1rem] border-2 border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-4 pr-16 font-mono text-sm break-all text-[var(--color-paper-deep)] select-all"
							>
								{oneTimeKey}
							</p>
							<button
								type="button"
								class="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg border border-[rgb(255_255_255_/_0.2)] bg-[rgb(255_255_255_/_0.1)] px-2 py-1.5 text-xs text-[var(--color-paper-deep)] transition hover:bg-[rgb(255_255_255_/_0.2)] active:scale-95"
								onclick={async () => {
									try {
										await navigator.clipboard.writeText(oneTimeKey);
									} catch {
										// Fallback: the text is already select-all
									}
								}}
							>
								Copy
							</button>
						</div>
						<p class="text-sm text-[var(--color-muted)]">
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
							size="md"
						>
							<span>{view === 'signup-success' ? 'I Stored It' : 'Back To Sign In'}</span>
						</GameButton>
					</div>
				{:else}
					<AvatarSketchpad
						draftUserKey={authenticatedUser?.id ?? authenticatedUser?.nickname ?? null}
						initialDrawingDocument={authenticatedUser?.avatarDrawingDocument ?? null}
						{nickname}
						{saveAvatar}
						onContinue={enterStudio}
					/>
				{/if}
			</div>
		</div>
	</StudioPanel>
</div>
