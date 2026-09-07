<script lang="ts">
	import { browser } from '$app/environment';
	import { deserialize, enhance } from '$app/forms';
	import { gsap } from '$lib/client/gsap';
	import {
		checkTextContent as defaultCheckTextContent,
		type TextContentChecker
	} from '$lib/client/content-filter';
	import { prefersReducedMotion } from '$lib/features/home-entry-scene/reduced-motion';
	import { parseEditableDrawingDocumentV2 } from '$lib/features/stroke-json/document';
	import {
		NICKNAME_PATTERN,
		PASSWORD_MAX_LENGTH,
		PASSWORD_MIN_LENGTH,
		normalizeNickname
	} from '$lib/auth/config';
	import type {
		HomeAuthActionData,
		HomeAuthActionForm,
		HomeAuthUser,
		HomeAuthAvailability
	} from '$lib/features/home-entry-scene/auth-contract';
	import AvatarSketchpad from '$lib/features/home-entry-scene/components/AvatarSketchpad.svelte';
	import { focusTrap } from '$lib/features/shared-ui/actions/focus-trap';
	import GameButton from '$lib/features/shared-ui/components/GameButton.svelte';
	import WashiTape from '$lib/features/shared-ui/components/WashiTape.svelte';
	import type {
		EntryFlowEvent,
		EntryFlowState
	} from '$lib/features/home-entry-scene/state/entry-state.svelte';
	import { dispatchAvatarFaviconUpdate } from '$lib/favicon';
	import { uploadViewerAvatar } from '$lib/client/avatar-upload';
	import { onMount } from 'svelte';
	import { waitForPageLayoutReady } from '$lib/features/home-entry-scene/components/page-layout-ready';

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
			avatarDrawingDocument?: import('$lib/features/stroke-json/document').DrawingDocumentV2 | null;
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
	let backdropElement = $state<HTMLDivElement | null>(null);
	let authSheetElement = $state<HTMLDivElement | null>(null);
	/** Whatever the visitor was on when the sheet took focus, to give it back. */
	let opener: HTMLElement | null = null;
	let pageLayoutReady = $state(!browser || document.readyState === 'complete');
	/** Well under WALL_ZOOM_IN_DURATION_MS (2080), so the panel always beats the reveal. */
	const PAGE_LAYOUT_READY_TIMEOUT_MS = 600;
	/** The sheet's heading is its accessible name, so it needs a stable id. */
	const AUTH_SHEET_TITLE_ID = 'auth-sheet-title';

	const isInteractive = $derived(
		pageLayoutReady &&
			(entryState === 'auth-login' ||
				entryState === 'auth-signup' ||
				entryState === 'auth-recovery')
	);
	const showLiveAuthContent = $derived(
		entryState === 'auth-login' || entryState === 'auth-signup' || entryState === 'auth-recovery'
	);
	const isSignUpFlow = $derived(
		view === 'signup-account' || view === 'signup-success' || view === 'signup-avatar'
	);
	const isAvatarView = $derived(view === 'signup-avatar');
	const panelClassName = $derived(isAvatarView ? 'w-full max-w-[50rem]' : 'w-full max-w-[44rem]');
	const contentClassName = $derived(
		isAvatarView ? 'space-y-5 p-6 md:p-8 lg:pl-16 lg:p-10' : 'min-h-[26rem] space-y-5 p-6 md:p-8'
	);

	/** One exit for the sheet: the close tape and Escape take the same one. */
	const dismissSheet = () => {
		if (view === 'signup-avatar') {
			onAvatarDismiss?.();
			dispatch('AUTH_SUCCESS');
			return;
		}

		dispatch('AUTH_CANCEL');
	};

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
		availabilityMessage = 'Checking nickname…';

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
		const userId = authenticatedUser?.id;
		const result = await uploadViewerAvatar(userId, drawingDocument);

		if (result.success && userId) {
			dispatchAvatarFaviconUpdate(userId);
			onAvatarSaved?.({
				avatarDrawingDocument: parseEditableDrawingDocumentV2(drawingDocument),
				avatarOnboardingCompletedAt: new Date(),
				avatarUrl: result.avatarUrl
			});
		}

		return result;
	};

	onMount(() => {
		if (!browser || pageLayoutReady) {
			return;
		}

		let cancelled = false;
		/*
		 * `window.load` + document.fonts.ready is an unbounded wait — one stalled
		 * subresource and the panel never appears — while the wall zoom that
		 * reveals it is a fixed 2.08s. Cap the wait well below that: the sheet is
		 * still laid out after the fonts settle on a normal load, and on a slow one
		 * the visitor gets a usable form instead of a bare wall.
		 */
		const layoutReadyTimeout = window.setTimeout(() => {
			pageLayoutReady = true;
		}, PAGE_LAYOUT_READY_TIMEOUT_MS);

		void waitForPageLayoutReady({ document, window }).then(() => {
			if (!cancelled) {
				pageLayoutReady = true;
			}
		});

		return () => {
			cancelled = true;
			window.clearTimeout(layoutReadyTimeout);
		};
	});

	$effect(() => {
		syncViewWithState();
	});

	$effect(() => {
		if (!backdropElement || !overlayElement) return;
		gsap.killTweensOf(backdropElement);
		gsap.killTweensOf(overlayElement);
		/*
		 * GSAP tweens are JS, so the global `@media (prefers-reduced-motion)`
		 * reset in routes/layout.css cannot reach them. Zero duration rather than
		 * a `gsap.set` branch: the tween still runs and still completes in order,
		 * it just lands on the same end state in one tick.
		 */
		const reducedMotion = prefersReducedMotion();

		if (isInteractive) {
			const duration = reducedMotion ? 0 : 0.34;
			gsap.to(backdropElement, { duration, ease: 'power2.out', opacity: 1 });
			gsap.to(overlayElement, { duration, ease: 'power2.out', opacity: 1, scale: 1 });
			return;
		}

		if (entryState === 'transitioning-out') {
			gsap.to(backdropElement, {
				duration: reducedMotion ? 0 : 0.24,
				ease: 'power2.in',
				opacity: 0
			});
			return;
		}

		gsap.set(backdropElement, { opacity: 0 });
		gsap.set(overlayElement, { opacity: 0, scale: 0.95 });
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

		const trimmedNickname = normalizeNickname(nickname);
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

	/*
	 * The overlay is mounted on every home visit, so it only becomes a dialog
	 * once it is the live auth surface — otherwise the museum behind it would
	 * report a permanently open modal. Focus lands on the sheet itself rather
	 * than the first field, so the heading is announced before the form; the
	 * trap installed below then keeps Tab inside it.
	 */
	$effect(() => {
		if (!isInteractive || !authSheetElement) return;
		if (authSheetElement.contains(document.activeElement)) return;

		// Remembered here rather than in the trap: the overlay is never
		// destroyed (the home page keeps it mounted), so the action's own
		// destroy-time hand-back can never run.
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		authSheetElement.focus();
	});

	/*
	 * …and given back when the sheet stops being live, on the cancel path and on
	 * the success path alike. Without this, focus stays on the Close tape of an
	 * overlay that is now transparent and `aria-hidden`: a screen reader
	 * announces nothing and the next Tab walks off the end of the document.
	 */
	$effect(() => {
		if (isInteractive || !authSheetElement) return;
		if (!authSheetElement.contains(document.activeElement)) return;

		if (opener?.isConnected) {
			opener.focus();
		} else {
			(document.activeElement as HTMLElement | null)?.blur();
		}

		opener = null;
	});

	/*
	 * A dialog that declares `aria-modal` owes the visitor Escape. It closes the
	 * sheet exactly the way its own close tape does — the avatar step counts as
	 * finished, everything else as cancelled.
	 */
	$effect(() => {
		if (!isInteractive) return;

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || event.defaultPrevented) return;
			dismissSheet();
		};

		window.addEventListener('keydown', handleEscape);
		return () => window.removeEventListener('keydown', handleEscape);
	});
</script>

<div
	bind:this={backdropElement}
	data-testid="auth-overlay"
	class={`absolute inset-0 z-40 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,240,214,0.24),rgba(24,15,8,0.58))] px-4 py-6 opacity-0 md:px-6 md:py-10 ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
	aria-hidden={!isInteractive}
	inert={!isInteractive}
>
	<div class="flex min-h-full w-full items-center justify-center">
		<div
			bind:this={overlayElement}
			class="flex w-full items-center justify-center py-2 opacity-0 md:py-0"
			style="transform: scale(0.95);"
		>
			<div
				bind:this={authSheetElement}
				class={`paper-sheet ${panelClassName} ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
				role={isInteractive ? 'dialog' : undefined}
				aria-modal={isInteractive ? 'true' : undefined}
				aria-labelledby={isInteractive ? AUTH_SHEET_TITLE_ID : undefined}
				tabindex="-1"
				use:focusTrap={{ enabled: isInteractive }}
			>
				<!--
						The sheet scrolls, so the paper grain rides the inner element with
						the content instead of being clipped to the box.
					-->
				<div class={`auth-sheet-inner paper-grain relative pl-8 md:pl-11 ${contentClassName}`}>
					<div class="flex items-start justify-between gap-4">
						<div class="space-y-2">
							<p class="font-display text-xs font-semibold tracking-[0.28em] text-muted uppercase">
								Studio Access
							</p>
							<h2
								id={AUTH_SHEET_TITLE_ID}
								class="font-display text-2xl tracking-[0.06em] text-ink uppercase md:text-3xl"
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
							<span class="paint-swipe auth-sheet-swipe" aria-hidden="true"></span>
							<p class="auth-sheet-subtitle max-w-2xl">
								{view === 'login'
									? 'The room missed you. Probably.'
									: view === 'signup-account'
										? 'Claim a nickname, sketch an avatar and step inside.'
										: view === 'recover'
											? 'Use your one-time recovery key to get back inside.'
											: 'One more step and you are in.'}
							</p>
						</div>
						<WashiTape onclick={dismissSheet}>
							<span class="sr-only">Close</span>
							<span aria-hidden="true">✕</span>
						</WashiTape>
					</div>

					<div
						class={showLiveAuthContent ? '' : 'pointer-events-none invisible'}
						inert={!showLiveAuthContent}
						aria-hidden={!showLiveAuthContent}
					>
						{#if rateLimitError || formError}
							<div class="mb-4 space-y-2">
								{#if rateLimitError}
									<div
										class="rounded-2xl border-2 border-danger bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] px-4 py-3 text-sm text-danger"
									>
										{rateLimitError}
									</div>
								{/if}
								{#if formError}
									<div
										class="rounded-2xl border-2 border-danger bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] px-4 py-3 text-sm text-danger"
									>
										{formError}
									</div>
								{/if}
							</div>
						{/if}

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
											class="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase"
											>Nickname</span
										>
										{#if nicknameError}
											<p class="text-right text-xs text-danger">{nicknameError}</p>
										{/if}
									</div>
									<input
										bind:value={nickname}
										autocomplete="section-login username"
										name="nickname"
										type="text"
										placeholder="artist_123"
										class="w-full rounded-2xl border-2 border-accent bg-paper-deep px-4 py-3 font-body text-base text-ink transition outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
									/>
								</label>

								<label class="block space-y-2">
									<div class="flex items-start justify-between gap-3">
										<span
											class="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase"
											>Password</span
										>
										{#if passwordError}
											<p class="text-right text-xs text-danger">{passwordError}</p>
										{/if}
									</div>
									<input
										bind:value={password}
										autocomplete="section-login current-password"
										name="password"
										type="password"
										placeholder="Enter your password"
										class="w-full rounded-2xl border-2 border-accent bg-paper-deep px-4 py-3 font-body text-base text-ink transition outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
									/>
								</label>

								<div
									class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between"
								>
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
										<span>{isSubmitting ? 'Working…' : 'Sign in'}</span>
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
											class="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase"
											>Nickname</span
										>
										{#if nicknameError}
											<p class="text-right text-xs text-danger">{nicknameError}</p>
										{:else if availabilityMessage}
											<p
												class={`text-right text-xs ${availabilityState === 'taken' ? 'text-danger' : availabilityState === 'available' ? 'text-secondary' : 'text-muted'}`}
											>
												{availabilityMessage}
											</p>
										{/if}
									</div>
									<input
										bind:value={nickname}
										autocomplete="section-signup username"
										name="nickname"
										type="text"
										placeholder="artist_123"
										class="w-full rounded-2xl border-2 border-accent bg-paper-deep px-4 py-3 font-body text-base text-ink transition outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
									/>
								</label>

								<label class="block space-y-2">
									<div class="flex items-start justify-between gap-3">
										<span
											class="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase"
											>Password</span
										>
										{#if passwordError}
											<p class="text-right text-xs text-danger">{passwordError}</p>
										{/if}
									</div>
									<input
										bind:value={password}
										autocomplete="section-signup new-password"
										name="password"
										type="password"
										placeholder="Enter your password"
										class="w-full rounded-2xl border-2 border-accent bg-paper-deep px-4 py-3 font-body text-base text-ink transition outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
									/>
								</label>

								<div
									class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between"
								>
									<p class="font-display text-xs tracking-[0.18em] text-muted uppercase">
										Step 1: claim your wall
									</p>

									<GameButton
										type="button"
										onclick={submitSignup}
										disabled={isSubmitting}
										size="md"
										className="w-full min-w-0 sm:w-auto sm:[--sticker-min-width:0px]"
									>
										<span>{isSubmitting ? 'Working…' : 'Start account'}</span>
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
											class="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase"
											>Nickname</span
										>
										{#if nicknameError}
											<p class="text-right text-xs text-danger">{nicknameError}</p>
										{/if}
									</div>
									<input
										bind:value={nickname}
										autocomplete="section-recovery username"
										name="nickname"
										type="text"
										placeholder="artist_123"
										class="w-full rounded-2xl border-2 border-accent bg-paper-deep px-4 py-3 font-body text-base text-ink transition outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
									/>
								</label>

								<label class="block space-y-2">
									<span
										class="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase"
										>Recovery Key</span
									>
									<input
										bind:value={recoveryKey}
										autocomplete="off"
										name="recoveryKey"
										type="text"
										placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
										class="w-full rounded-2xl border-2 border-accent bg-paper-deep px-4 py-3 font-body text-base text-ink transition outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
									/>
								</label>
								{#if recoveryKeyError}<p class="text-sm text-danger">
										{recoveryKeyError}
									</p>{/if}

								<label class="block space-y-2">
									<div class="flex items-start justify-between gap-3">
										<span
											class="font-display text-xs font-semibold tracking-[0.18em] text-muted uppercase"
											>New Password</span
										>
										{#if newPasswordError}
											<p class="text-right text-xs text-danger">
												{newPasswordError}
											</p>
										{/if}
									</div>
									<input
										bind:value={newPassword}
										autocomplete="section-recovery new-password"
										name="newPassword"
										type="password"
										placeholder="Choose a new password"
										class="w-full rounded-2xl border-2 border-accent bg-paper-deep px-4 py-3 font-body text-base text-ink transition outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-[rgb(212_131_74_/_0.25)]"
									/>
								</label>

								<div
									class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between"
								>
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
										<span>{isSubmitting ? 'Working…' : 'Recover access'}</span>
									</GameButton>
								</div>
							</form>
						{:else if view === 'signup-success' || view === 'recover-success'}
							<div class="space-y-4 rounded-sheet border-2 border-accent bg-paper p-5">
								<p class="font-display text-sm tracking-[0.18em] text-muted uppercase">
									One-time key
								</p>
								<div class="relative">
									<p
										class="rounded-2xl border-2 border-ink bg-ink px-4 py-4 pr-16 font-mono text-sm break-all text-paper-deep select-all"
									>
										{oneTimeKey}
									</p>
									<button
										type="button"
										class="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg border border-[rgb(255_255_255_/_0.2)] bg-[rgb(255_255_255_/_0.1)] px-2 py-1.5 text-xs text-paper-deep transition hover:bg-[rgb(255_255_255_/_0.2)] active:scale-95"
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
								<p class="text-sm text-muted">
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
									<span>{view === 'signup-success' ? 'I stored it' : 'Back to sign in'}</span>
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
			</div>
		</div>
	</div>
</div>

<style>
	/* torn-out spiral perforations along the left edge */
	.auth-sheet-inner::after {
		content: '';
		position: absolute;
		top: 18px;
		bottom: 18px;
		left: 8px;
		width: 14px;
		background-image: radial-gradient(
			circle at 7px 9px,
			rgba(45, 36, 32, 0.18) 4px,
			rgba(45, 36, 32, 0.07) 4.6px,
			transparent 5.4px
		);
		background-size: 14px 44px;
		background-repeat: repeat-y;
		pointer-events: none;
	}

	/* How long and how crooked this swipe is; the paint is `.paint-swipe`. */
	.auth-sheet-swipe {
		width: 150px;
		height: 7px;
		margin-top: 2px;
		rotate: -0.8deg;
	}

	.auth-sheet-subtitle {
		font-family: var(--font-hand);
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--color-bark);
		rotate: -0.4deg;
	}
</style>
