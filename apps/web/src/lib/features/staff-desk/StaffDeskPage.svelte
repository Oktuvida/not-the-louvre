<script lang="ts">
	import { ArrowLeft, Flag, Type, Users } from 'lucide-svelte';
	import { requestJson } from '#lib/client/api.js';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import GameLink from '#lib/features/shared-ui/components/GameLink.svelte';
	import { museumWallPatternAssetUrl } from '#lib/features/shared-ui/generated-art.js';
	import StaffCaseCard from './components/StaffCaseCard.svelte';
	import StaffPeople from './components/StaffPeople.svelte';
	import StaffWords from './components/StaffWords.svelte';
	import {
		caseModerationPath,
		countLabel,
		type AvatarAction,
		type CaseAction,
		type PeopleFilter,
		type StaffCase,
		type StaffDeskData,
		type StaffPerson,
		type StaffTextPolicy,
		type StaffUsersPage
	} from './model';

	/*
	 * Where the museum's staff work, on the gallery's own wall: the queue first,
	 * since that is what they came for, with the people and the word lists behind
	 * it for whoever may touch them.
	 */
	type TabKey = 'people' | 'queue' | 'words';
	type ModerationPage = NonNullable<StaffDeskData['moderationPage']>;

	let { data }: { data: StaffDeskData } = $props();

	const initial = (() => $state.snapshot(data) as StaffDeskData)();

	let activeTab = $state<TabKey>('queue');
	let busy = $state(false);
	let notice = $state<{ text: string; tone: 'error' | 'success' } | null>(null);
	let cases = $state<StaffCase[]>(initial.moderationPage?.items ?? []);
	let casesCursor = $state(initial.moderationPage?.pageInfo.nextCursor ?? null);
	let people = $state<StaffUsersPage | null>(initial.usersPage);
	let peopleQuery = $state<{ filter: PeopleFilter; search: string }>({ filter: 'all', search: '' });
	let policy = $state<StaffTextPolicy | null>(initial.textPolicy);

	const tabs = $derived(
		[
			{ icon: Flag, key: 'queue' as const, label: 'Queue', shown: data.permissions.canModerate },
			{
				icon: Users,
				key: 'people' as const,
				label: 'People',
				shown: data.permissions.canManageUsers
			},
			{
				icon: Type,
				key: 'words' as const,
				label: 'Words',
				shown: data.permissions.canUpdateTextPolicy
			}
		].filter((tab) => tab.shown)
	);

	const working = async (work: () => Promise<string | void>) => {
		busy = true;
		notice = null;
		try {
			const done = await work();
			if (done) notice = { text: done, tone: 'success' };
		} catch (error) {
			notice = {
				text: error instanceof Error ? error.message : 'That did not go through.',
				tone: 'error'
			};
		} finally {
			busy = false;
		}
	};

	const readCases = async (cursor?: string) => {
		const page = await requestJson<ModerationPage>(
			`/api/moderation/queue${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
		);
		cases = cursor ? [...cases, ...page.items] : page.items;
		casesCursor = page.pageInfo.nextCursor;
	};

	const decide = (item: StaffCase, action: CaseAction) =>
		working(async () => {
			await requestJson(
				caseModerationPath(item),
				action === 'delete' ? { method: 'DELETE' } : { json: { action }, method: 'PATCH' }
			);
			await readCases();
		});

	const readPeople = async (cursor?: string) => {
		const { filter, search } = peopleQuery;
		const query = [
			search && `search=${encodeURIComponent(search)}`,
			filter !== 'all' && `filter=${filter}`,
			cursor && `cursor=${encodeURIComponent(cursor)}`
		]
			.filter(Boolean)
			.join('&');
		const page = await requestJson<StaffUsersPage>(`/api/admin/users?${query}`);
		people = cursor && people ? { ...page, items: [...people.items, ...page.items] } : page;
	};

	const findPeople = (search: string, filter: PeopleFilter) => {
		peopleQuery = { filter, search: search.trim() };
		void working(() => readPeople());
	};

	const changeRole = (person: StaffPerson, role: 'moderator' | 'user') =>
		working(async () => {
			await requestJson(`/api/admin/users/${person.id}`, { json: { role }, method: 'PATCH' });
			await readPeople();
		});

	const ban = (person: StaffPerson, reason: string) =>
		working(async () => {
			await requestJson(`/api/admin/users/${person.id}/ban`, {
				json: { action: 'ban', reason },
				method: 'PATCH'
			});
			await readPeople();
		});

	const liftBan = (person: StaffPerson) =>
		working(async () => {
			await requestJson(`/api/admin/users/${person.id}/ban`, {
				json: { action: 'unban' },
				method: 'PATCH'
			});
			await readPeople();
		});

	const moderateAvatar = (person: StaffPerson, action: AvatarAction) =>
		working(async () => {
			await requestJson(`/api/users/${person.id}/avatar/moderation`, {
				json: { action },
				method: 'PATCH'
			});
			await readPeople();
		});

	const lines = (value: string) =>
		value
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

	const saveWords = (drafts: Record<string, { allowlist: string; blocklist: string }>) =>
		working(async () => {
			if (!policy) return;
			const current = policy.policies as Record<string, { version: number }>;
			policy = await requestJson<StaffTextPolicy>('/api/admin/moderation/text-policy', {
				json: {
					policies: Object.fromEntries(
						Object.entries(drafts).map(([context, draft]) => [
							context,
							{
								allowlist: lines(draft.allowlist),
								blocklist: lines(draft.blocklist),
								expectedVersion: current[context]?.version ?? 0
							}
						])
					)
				},
				method: 'PUT'
			});
			return 'Saved.';
		});
</script>

<div
	class="staff-desk"
	style={`background-image: url('${museumWallPatternAssetUrl}'); background-size: 512px 512px;`}
>
	<header class="desk-head">
		<div class="desk-back">
			<GameLink href="/" variant="ghost" size="sm" className="w-fit -rotate-1 shadow-xl">
				<ArrowLeft class="mr-1 h-5 w-5" />
				<span class="font-semibold">Back</span>
			</GameLink>
		</div>
		<nav class="desk-tabs" aria-label="Staff desk">
			{#each tabs as { icon: Icon, key, label } (key)}
				<span class="desk-tab">
					<GameButton
						ariaLabel={label}
						ariaPressed={activeTab === key}
						variant={activeTab === key ? 'accent' : 'ghost'}
						size="sm"
						className={`min-w-0! ${activeTab === key ? 'scale-105' : ''}`}
						onclick={() => (activeTab = key)}
					>
						<Icon class="h-5 w-5 shrink-0" aria-hidden="true" />
						<span class={activeTab === key ? 'inline-flex' : 'hidden sm:inline-flex'}>{label}</span>
					</GameButton>
					{#if key === 'queue' && cases.length > 0}
						<span class="desk-count" aria-hidden="true">{cases.length}</span>
					{/if}
				</span>
			{/each}
		</nav>
	</header>

	<main class="desk-room">
		<h1 class="sr-only">Staff desk</h1>

		{#if notice}
			<p class="desk-notice" role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>
		{/if}

		{#if activeTab === 'queue'}
			{#if cases.length === 0}
				<section class="desk-quiet">
					<b>All quiet</b>
					<span>Nobody has reported anything.</span>
				</section>
			{:else}
				<p class="desk-line">
					<b>{countLabel(cases.length, 'case')}</b> waiting, the most reported first
				</p>
				{#each cases as item (`${item.targetType}:${item.commentId ?? item.wishId ?? item.artworkId}`)}
					<StaffCaseCard {busy} {item} onDecide={(action) => decide(item, action)} />
				{/each}
				{#if casesCursor}
					<div class="desk-more">
						<GameButton
							variant="ghost"
							size="sm"
							disabled={busy}
							onclick={() => working(() => readCases(casesCursor ?? undefined))}
						>
							Show more
						</GameButton>
					</div>
				{/if}
			{/if}
		{:else if activeTab === 'people' && people}
			<StaffPeople
				{busy}
				page={people}
				onAvatar={moderateAvatar}
				onBan={ban}
				onFind={findPeople}
				onMore={() => working(() => readPeople(people?.pageInfo.nextCursor ?? undefined))}
				onRole={changeRole}
				onUnban={liftBan}
			/>
		{:else if activeTab === 'words' && policy}
			<StaffWords {busy} {policy} onSave={saveWords} />
		{/if}
	</main>
</div>

<style>
	.staff-desk {
		min-height: 100dvh;
		padding: 1.5rem 2rem 4rem;
		background-color: var(--color-wall);
		background-repeat: repeat;
		color: var(--color-ink-warm);
	}

	.desk-head {
		position: relative;
		display: flex;
		justify-content: center;
		min-height: 4rem;
	}

	.desk-back {
		position: absolute;
		top: 0;
		left: 0;
	}

	.desk-tabs {
		display: flex;
		gap: 0.5rem;
		padding: 0.4rem;
	}

	.desk-tab {
		position: relative;
		display: inline-flex;
	}

	.desk-count {
		position: absolute;
		top: -0.38rem;
		right: -0.25rem;
		z-index: 3;
		min-width: 1.32rem;
		height: 1.32rem;
		padding-inline: 0.2rem;
		border-radius: 999px;
		background: #b5473c;
		font-family: var(--font-display);
		font-size: 0.74rem;
		font-weight: 800;
		line-height: 1.32rem;
		text-align: center;
		color: #fff;
		box-shadow: 0 1px 2px rgb(40 25 10 / 0.4);
		pointer-events: none;
	}

	.desk-room {
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		width: min(100%, 68rem);
		margin: 1.25rem auto 0;
	}

	.desk-room :global(.desk-line) {
		align-self: flex-start;
		margin: 0;
		padding: 0.12rem 0.8rem;
		background: rgb(251 248 242 / 0.9);
		rotate: -0.5deg;
		font-family: var(--font-hand);
		font-size: 1.3rem;
		color: rgb(45 36 32 / 0.85);
		box-shadow: 0 1px 2px rgb(40 25 10 / 0.2);
	}

	.desk-notice {
		align-self: center;
		margin: 0;
		padding: 0.15rem 0.9rem;
		background: #fff3a8;
		font-family: var(--font-hand);
		font-size: 1.25rem;
		box-shadow: 0 1px 2px rgb(40 25 10 / 0.25);
	}

	.desk-notice[role='alert'] {
		color: #9c3b2e;
	}

	.desk-quiet {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 3.4rem 1rem;
		background-color: #fbf8f2;
		text-align: center;
		box-shadow:
			0 1px 1px rgb(40 25 10 / 0.25),
			0 0.5rem 1.1rem rgb(40 25 10 / 0.26);
	}

	.desk-quiet b {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.desk-quiet span {
		font-family: var(--font-hand);
		font-size: 1.35rem;
		color: rgb(45 36 32 / 0.75);
	}

	.desk-more {
		display: flex;
		justify-content: center;
	}

	@media (max-width: 39.99rem) {
		.staff-desk {
			padding: 0.75rem 1rem 6rem;
		}

		.desk-head {
			flex-direction: column;
			align-items: center;
			gap: 0.5rem;
		}

		.desk-back {
			position: static;
			align-self: flex-start;
		}

		.desk-room {
			margin-top: 0.75rem;
			gap: 1rem;
		}

		.desk-room :global(.desk-line) {
			font-size: 1.14rem;
		}
	}
</style>
