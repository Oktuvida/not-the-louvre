<script lang="ts">
	import type {
		HomeAuthActionForm,
		HomeAuthBootstrap,
		HomeAuthUser
	} from '$lib/features/home-entry-scene/auth-contract';
	import type { HomePreviewCard } from '$lib/features/home-entry-scene/state/home-entry.svelte';
	import HomeEntryPage from '$lib/features/home-entry-scene/HomeEntryPage.svelte';
	import AuthOverlay from '$lib/features/home-entry-scene/components/AuthOverlay.svelte';
	import MuseumWallOverlay from '$lib/features/home-entry-scene/components/MuseumWallOverlay.svelte';
	import StudioPanel from '$lib/features/shared-ui/components/StudioPanel.svelte';
	import {
		createEntryState,
		type EntryFlowEvent
	} from '$lib/features/home-entry-scene/state/entry-state.svelte';

	let {
		auth,
		adultContentEnabled = false,
		form,
		topArtworks = []
	}: {
		auth: HomeAuthBootstrap;
		adultContentEnabled?: boolean;
		form?: HomeAuthActionForm;
		topArtworks?: HomePreviewCard[];
	} = $props();

	const shouldHoldSignupOverlay = (actionData?: HomeAuthActionForm) =>
		actionData?.action === 'signUp' && 'success' in actionData && actionData.success;
	const getInitialEntryState = () =>
		shouldHoldSignupOverlay(form)
			? 'auth-signup'
			: auth.status === 'authenticated' && auth.onboarding.status === 'needs-avatar'
				? 'auth-signup'
				: auth.status === 'authenticated'
					? 'inside'
					: 'outside';
	const getInitialHoldSignupOnboarding = () =>
		shouldHoldSignupOverlay(form) ||
		(auth.status === 'authenticated' && auth.onboarding.status === 'needs-avatar');

	const entryState = createEntryState(getInitialEntryState());

	let authOverlayElement = $state<HTMLDivElement | null>(null);
	let avatarOnboardingDismissed = $state(false);
	let avatarOnboardingResolved = $state(false);
	let holdSignupOnboarding = $state(getInitialHoldSignupOnboarding());
	let user = $state<HomeAuthUser | null>(null);
	let integrityFailure = $state<HomeAuthBootstrap['integrityFailure']>(null);

	const flowState = $derived(entryState.state);
	const needsAvatarOnboarding = $derived(
		auth.status === 'authenticated' &&
			auth.onboarding.status === 'needs-avatar' &&
			!avatarOnboardingDismissed &&
			!avatarOnboardingResolved
	);
	const navUser = $derived(flowState === 'inside' ? user : null);

	const dispatch = (event: EntryFlowEvent) => {
		entryState.dispatch(event);
	};

	$effect(() => {
		if (auth.status !== 'authenticated') {
			avatarOnboardingDismissed = false;
			avatarOnboardingResolved = false;
		}

		if (shouldHoldSignupOverlay(form)) {
			holdSignupOnboarding = true;
			avatarOnboardingDismissed = false;
			avatarOnboardingResolved = false;
		}

		if (entryState.state === 'inside') {
			holdSignupOnboarding = false;
		}
	});

	$effect(() => {
		integrityFailure = auth.status === 'integrity-failure' ? auth.integrityFailure : null;

		if (auth.status === 'integrity-failure') {
			user = null;
			if (entryState.state === 'inside') {
				entryState.dispatch('LOG_OUT');
			}
			return;
		}

		if (auth.status === 'authenticated') {
			user = auth.user;

			if (needsAvatarOnboarding) {
				holdSignupOnboarding = true;
				if (entryState.state === 'outside') {
					entryState.dispatch('COME_IN');
					entryState.dispatch('TRANSITION_DONE');
				} else if (entryState.state === 'auth-login') {
					entryState.dispatch('SHOW_SIGN_UP');
				}
				return;
			}

			if (holdSignupOnboarding) {
				return;
			}

			if (entryState.state === 'outside') {
				entryState.dispatch('SESSION_EXISTS');
			} else if (entryState.state !== 'inside') {
				entryState.dispatch('AUTH_SUCCESS');
			}
			return;
		}

		user = null;
		if (entryState.state === 'inside') {
			entryState.dispatch('LOG_OUT');
		}
	});
</script>

<HomeEntryPage
	{adultContentEnabled}
	entryState={flowState}
	previewCards={topArtworks}
	user={navUser}
>
	{#if integrityFailure}
		<div class="absolute inset-0 z-[40] flex items-center justify-center px-6 py-10">
			<StudioPanel
				tone="paper"
				className="w-full max-w-[34rem] border-[#7b3b2a] bg-[rgba(255,248,240,0.98)] text-[#3f2318]"
			>
				<div class="space-y-4 p-6 md:p-8">
					<p class="text-xs font-semibold tracking-[0.22em] text-[#a55b45] uppercase">
						Session needs repair
					</p>
					<h2 class="font-display text-3xl tracking-[0.06em] text-[#3f2318] uppercase">
						Please sign in again later
					</h2>
					<p class="text-sm text-[#6f4b3f]">{integrityFailure.message}</p>
				</div>
			</StudioPanel>
		</div>
	{:else}
		<MuseumWallOverlay entryState={flowState} {dispatch} {authOverlayElement} />
		<AuthOverlay
			bind:overlayElement={authOverlayElement}
			authenticatedUser={user}
			entryState={flowState}
			{dispatch}
			{form}
			onAvatarDismiss={() => {
				avatarOnboardingDismissed = true;
			}}
			onAvatarSaved={() => {
				avatarOnboardingResolved = true;
				avatarOnboardingDismissed = false;
			}}
			resumeAvatarOnboarding={needsAvatarOnboarding}
		/>
	{/if}
</HomeEntryPage>
