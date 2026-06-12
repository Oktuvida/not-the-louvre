<script lang="ts">
	import type { PageData, PageProps } from './$types';

	type TabKey = 'moderation' | 'policy' | 'users';
	type PolicyContext = 'artwork_title' | 'comment' | 'nickname';
	type UsersPage = NonNullable<PageData['usersPage']>;
	type ModerationPage = NonNullable<PageData['moderationPage']>;
	type TextPolicySnapshot = NonNullable<PageData['textPolicy']>;

	type DashboardMessage = {
		text: string;
		tone: 'error' | 'success';
	};

	type PolicyDraftMap = Record<
		PolicyContext,
		{
			allowlist: string;
			blocklist: string;
			expectedVersion: number;
		}
	>;

	const policyContexts: Array<{ context: PolicyContext; label: string; description: string }> = [
		{
			context: 'nickname',
			label: 'Nickname guardrails',
			description: 'Artist names and nicknames shown across the gallery.'
		},
		{
			context: 'comment',
			label: 'Comment guardrails',
			description: 'Conversation boundaries for artwork threads and discussion.'
		},
		{
			context: 'artwork_title',
			label: 'Artwork title guardrails',
			description: 'Titles used in discovery, cards, and moderation review.'
		}
	];

	let { data }: PageProps = $props();

	const {
		moderationPage: initialModerationPage,
		permissions: initialPermissions,
		usersPage: initialUsersPage
	} = (() => $state.snapshot(data))();
	const defaultTab: TabKey = initialPermissions.canManageUsers ? 'users' : 'moderation';

	let activeTab = $state<TabKey>(defaultTab);
	let busyKey = $state<string | null>(null);
	let message = $state<DashboardMessage | null>(null);
	let banReasonDrafts = $state<Record<string, string>>({});
	let users = $state(initialUsersPage?.items ?? []);
	let usersHasMore = $state(Boolean(initialUsersPage?.pageInfo.hasMore));
	let usersNextCursor = $state<string | null>(initialUsersPage?.pageInfo.nextCursor ?? null);
	let moderationItems = $state(initialModerationPage?.items ?? []);
	let moderationHasMore = $state(Boolean(initialModerationPage?.pageInfo.hasMore));
	let moderationNextCursor = $state<string | null>(
		initialModerationPage?.pageInfo.nextCursor ?? null
	);
	let policyDrafts = $state(createPolicyDrafts(null));

	const visibleTabs = $derived(
		[
			data.permissions.canManageUsers ? { key: 'users' as const, label: 'Users' } : null,
			data.permissions.canModerate ? { key: 'moderation' as const, label: 'Review queue' } : null,
			data.permissions.canUpdateTextPolicy ? { key: 'policy' as const, label: 'Text policy' } : null
		].filter((tab): tab is { key: TabKey; label: string } => tab !== null)
	);

	const userMetrics = $derived({
		banned: users.filter((user) => user.isBanned).length,
		moderators: users.filter((user) => user.role === 'moderator').length,
		total: users.length
	});

	const moderationMetrics = $derived({
		hidden: moderationItems.filter((item) => item.isHidden).length,
		pending: moderationItems.length,
		reports: moderationItems.reduce((total, item) => total + item.reportCount, 0)
	});

	function createPolicyDrafts(snapshot: PageData['textPolicy']): PolicyDraftMap {
		return {
			artwork_title: {
				allowlist: snapshot?.policies.artwork_title.allowlist.join('\n') ?? '',
				blocklist: snapshot?.policies.artwork_title.blocklist.join('\n') ?? '',
				expectedVersion: snapshot?.policies.artwork_title.version ?? 0
			},
			comment: {
				allowlist: snapshot?.policies.comment.allowlist.join('\n') ?? '',
				blocklist: snapshot?.policies.comment.blocklist.join('\n') ?? '',
				expectedVersion: snapshot?.policies.comment.version ?? 0
			},
			nickname: {
				allowlist: snapshot?.policies.nickname.allowlist.join('\n') ?? '',
				blocklist: snapshot?.policies.nickname.blocklist.join('\n') ?? '',
				expectedVersion: snapshot?.policies.nickname.version ?? 0
			}
		};
	}

	$effect(() => {
		policyDrafts = createPolicyDrafts(data.textPolicy);
	});

	async function readBody(response: Response) {
		const contentType = response.headers.get('content-type') ?? '';

		if (contentType.includes('application/json')) {
			return response.json();
		}

		return response.text();
	}

	async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
		const response = await fetch(input, init);
		const body = await readBody(response);

		if (!response.ok) {
			const text =
				typeof body === 'string'
					? body
					: typeof body === 'object' && body && 'message' in body
						? String(body.message)
						: 'Request failed';

			throw new Error(text);
		}

		return body as T;
	}

	function setMessage(tone: DashboardMessage['tone'], text: string) {
		message = { text, tone };
	}

	function clearMessage() {
		message = null;
	}

	function parseLines(value: string) {
		return value
			.split('\n')
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	function updatePolicyDraft(
		context: PolicyContext,
		field: 'allowlist' | 'blocklist',
		value: string
	) {
		policyDrafts = {
			...policyDrafts,
			[context]: {
				...policyDrafts[context],
				[field]: value
			}
		};
	}

	function updateBanReason(userId: string, value: string) {
		banReasonDrafts = {
			...banReasonDrafts,
			[userId]: value
		};
	}

	function formatDate(value: Date | string | null | undefined) {
		if (!value) {
			return 'Never';
		}

		const date = value instanceof Date ? value : new Date(value);

		if (Number.isNaN(date.getTime())) {
			return 'Unknown';
		}

		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	async function refreshUsers(options: { append?: boolean } = {}) {
		if (!data.permissions.canManageUsers) {
			return;
		}

		const query =
			options.append && usersNextCursor ? `?cursor=${encodeURIComponent(usersNextCursor)}` : '';
		const page = await requestJson<UsersPage>(`/api/admin/users${query}`);

		users = options.append ? [...users, ...page.items] : page.items;
		usersHasMore = page.pageInfo.hasMore;
		usersNextCursor = page.pageInfo.nextCursor;
	}

	async function refreshModeration(options: { append?: boolean } = {}) {
		if (!data.permissions.canModerate) {
			return;
		}

		const query =
			options.append && moderationNextCursor
				? `?cursor=${encodeURIComponent(moderationNextCursor)}`
				: '';
		const page = await requestJson<ModerationPage>(`/api/moderation/queue${query}`);

		moderationItems = options.append ? [...moderationItems, ...page.items] : page.items;
		moderationHasMore = page.pageInfo.hasMore;
		moderationNextCursor = page.pageInfo.nextCursor;
	}

	async function refreshTextPolicy() {
		if (!data.permissions.canUpdateTextPolicy) {
			return;
		}

		const snapshot = await requestJson<TextPolicySnapshot>('/api/admin/moderation/text-policy');
		policyDrafts = createPolicyDrafts(snapshot);
	}

	async function withBusy<T>(key: string, work: () => Promise<T>) {
		busyKey = key;
		clearMessage();

		try {
			return await work();
		} catch (error) {
			setMessage('error', error instanceof Error ? error.message : 'Request failed');
			throw error;
		} finally {
			busyKey = null;
		}
	}

	async function changeUserRole(userId: string, role: 'moderator' | 'user') {
		await withBusy(`role:${userId}:${role}`, async () => {
			await requestJson(`/api/admin/users/${userId}`, {
				body: JSON.stringify({ role }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});
			await refreshUsers();
			setMessage('success', `Role updated to ${role}.`);
		});
	}

	async function submitBan(userId: string) {
		await withBusy(`ban:${userId}`, async () => {
			await requestJson(`/api/admin/users/${userId}/ban`, {
				body: JSON.stringify({ action: 'ban', reason: banReasonDrafts[userId] ?? '' }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});
			await refreshUsers();
			setMessage('success', 'User banned.');
		});
	}

	async function liftBan(userId: string) {
		await withBusy(`unban:${userId}`, async () => {
			await requestJson(`/api/admin/users/${userId}/ban`, {
				body: JSON.stringify({ action: 'unban' }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});
			await refreshUsers();
			setMessage('success', 'User restored.');
		});
	}

	async function moderateAvatar(
		userId: string,
		action: 'clear_nsfw' | 'hide' | 'mark_nsfw' | 'unhide'
	) {
		await withBusy(`avatar:${userId}:${action}`, async () => {
			await requestJson(`/api/users/${userId}/avatar/moderation`, {
				body: JSON.stringify({ action }),
				headers: { 'content-type': 'application/json' },
				method: 'PATCH'
			});
			await refreshUsers();
			setMessage('success', 'Avatar moderation updated.');
		});
	}

	async function moderateArtwork(
		artworkId: string,
		action: 'clear_nsfw' | 'delete' | 'dismiss' | 'hide' | 'mark_nsfw' | 'unhide'
	) {
		await withBusy(`artwork:${artworkId}:${action}`, async () => {
			if (action === 'delete') {
				await requestJson(`/api/artworks/${artworkId}/moderation`, { method: 'DELETE' });
			} else {
				await requestJson(`/api/artworks/${artworkId}/moderation`, {
					body: JSON.stringify({ action }),
					headers: { 'content-type': 'application/json' },
					method: 'PATCH'
				});
			}

			await refreshModeration();
			setMessage('success', 'Artwork moderation updated.');
		});
	}

	async function moderateComment(
		artworkId: string,
		commentId: string,
		action: 'delete' | 'dismiss' | 'hide' | 'unhide'
	) {
		await withBusy(`comment:${commentId}:${action}`, async () => {
			if (action === 'delete') {
				await requestJson(`/api/artworks/${artworkId}/comments/${commentId}/moderation`, {
					method: 'DELETE'
				});
			} else {
				await requestJson(`/api/artworks/${artworkId}/comments/${commentId}/moderation`, {
					body: JSON.stringify({ action }),
					headers: { 'content-type': 'application/json' },
					method: 'PATCH'
				});
			}

			await refreshModeration();
			setMessage('success', 'Comment moderation updated.');
		});
	}

	async function saveTextPolicy() {
		await withBusy('policy:save', async () => {
			const payload = {
				policies: Object.fromEntries(
					policyContexts.map(({ context }) => [
						context,
						{
							allowlist: parseLines(policyDrafts[context].allowlist),
							blocklist: parseLines(policyDrafts[context].blocklist),
							expectedVersion: policyDrafts[context].expectedVersion
						}
					])
				)
			};

			const snapshot = await requestJson<TextPolicySnapshot>('/api/admin/moderation/text-policy', {
				body: JSON.stringify(payload),
				headers: { 'content-type': 'application/json' },
				method: 'PUT'
			});

			policyDrafts = createPolicyDrafts(snapshot);
			setMessage('success', 'Text moderation policy saved.');
		});
	}
</script>

<svelte:head>
	<title>Operations | Not the Louvre</title>
</svelte:head>

<div class="ops-shell">
	<section class="hero-panel">
		<div>
			<p class="eyebrow">Operations dashboard</p>
			<h1>Museum control desk</h1>
			<p class="lede">
				Manage users, work through moderation signals, and tune language policy from one protected
				surface.
			</p>
		</div>

		<div class="hero-meta">
			<div>
				<span>Signed in as</span>
				<strong>{data.viewer.nickname}</strong>
			</div>
			<div>
				<span>Role</span>
				<strong>{data.viewer.role}</strong>
			</div>
		</div>
	</section>

	<section class="metrics-grid">
		{#if data.permissions.canManageUsers}
			<article class="metric-card">
				<span>Total users</span>
				<strong>{userMetrics.total}</strong>
				<p>{userMetrics.moderators} moderators currently active in the system.</p>
			</article>
			<article class="metric-card accent-danger">
				<span>Banned users</span>
				<strong>{userMetrics.banned}</strong>
				<p>Soft bans preserve accounts while cutting off creation and engagement actions.</p>
			</article>
		{/if}

		{#if data.permissions.canModerate}
			<article class="metric-card accent-amber">
				<span>Queue items</span>
				<strong>{moderationMetrics.pending}</strong>
				<p>{moderationMetrics.reports} total reports across the current review window.</p>
			</article>
			<article class="metric-card accent-dark">
				<span>Hidden targets</span>
				<strong>{moderationMetrics.hidden}</strong>
				<p>Items already suppressed and waiting for follow-up or final resolution.</p>
			</article>
		{/if}
	</section>

	<nav class="tab-strip" aria-label="Admin tools">
		{#each visibleTabs as tab (tab.key)}
			<button
				class:active={activeTab === tab.key}
				type="button"
				onclick={() => {
					activeTab = tab.key;
					clearMessage();
				}}
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	{#if message}
		<p class="banner" data-tone={message.tone}>{message.text}</p>
	{/if}

	{#if activeTab === 'users' && data.permissions.canManageUsers}
		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="eyebrow">User administration</p>
					<h2>Roles, bans, and avatar safety</h2>
				</div>
				<button
					type="button"
					class="secondary"
					disabled={busyKey !== null}
					onclick={() => withBusy('users:refresh', () => refreshUsers())}
				>
					Refresh list
				</button>
			</div>

			<div class="user-grid">
				{#each users as user (user.id)}
					<article class="entity-card">
						<div class="entity-header">
							<div>
								<h3>{user.nickname}</h3>
								<p>{user.id}</p>
							</div>
							<div class="badge-row">
								<span class="badge role">{user.role}</span>
								{#if user.isBanned}
									<span class="badge danger">Banned</span>
								{/if}
								{#if user.avatarIsHidden}
									<span class="badge warn">Avatar hidden</span>
								{/if}
								{#if user.avatarIsNsfw}
									<span class="badge amber">Avatar NSFW</span>
								{/if}
							</div>
						</div>

						<dl class="details-grid">
							<div>
								<dt>Joined</dt>
								<dd>{formatDate(user.createdAt)}</dd>
							</div>
							<div>
								<dt>Banned at</dt>
								<dd>{formatDate(user.bannedAt)}</dd>
							</div>
						</dl>

						{#if user.banReason}
							<p class="reason">{user.banReason}</p>
						{/if}

						<div class="action-block">
							<p class="action-label">Role controls</p>
							<div class="action-row">
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null ||
										user.id === data.viewer.id ||
										user.role === 'moderator' ||
										user.role === 'admin'}
									onclick={() => changeUserRole(user.id, 'moderator')}
								>
									Promote
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null ||
										user.id === data.viewer.id ||
										user.role !== 'moderator'}
									onclick={() => changeUserRole(user.id, 'user')}
								>
									Demote
								</button>
							</div>
						</div>

						<div class="action-block">
							<p class="action-label">Ban controls</p>
							<textarea
								rows="3"
								placeholder="Document the reason for a soft ban"
								value={banReasonDrafts[user.id] ?? user.banReason ?? ''}
								oninput={(event) => updateBanReason(user.id, event.currentTarget.value)}
							></textarea>
							<div class="action-row">
								<button
									type="button"
									class="danger"
									disabled={busyKey !== null || user.id === data.viewer.id || user.isBanned}
									onclick={() => submitBan(user.id)}
								>
									Ban user
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || !user.isBanned}
									onclick={() => liftBan(user.id)}
								>
									Unban
								</button>
							</div>
						</div>

						<div class="action-block">
							<p class="action-label">Avatar moderation</p>
							<div class="action-row action-wrap">
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || user.avatarIsHidden}
									onclick={() => moderateAvatar(user.id, 'hide')}
								>
									Hide avatar
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || !user.avatarIsHidden}
									onclick={() => moderateAvatar(user.id, 'unhide')}
								>
									Unhide avatar
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || user.avatarIsNsfw}
									onclick={() => moderateAvatar(user.id, 'mark_nsfw')}
								>
									Mark NSFW
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || !user.avatarIsNsfw}
									onclick={() => moderateAvatar(user.id, 'clear_nsfw')}
								>
									Clear NSFW
								</button>
							</div>
						</div>
					</article>
				{/each}
			</div>

			{#if usersHasMore}
				<div class="panel-footer">
					<button
						type="button"
						class="secondary"
						disabled={busyKey !== null}
						onclick={() => withBusy('users:more', () => refreshUsers({ append: true }))}
					>
						Load more users
					</button>
				</div>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'moderation' && data.permissions.canModerate}
		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="eyebrow">Review queue</p>
					<h2>Reported content review</h2>
				</div>
				<button
					type="button"
					class="secondary"
					disabled={busyKey !== null}
					onclick={() => withBusy('moderation:refresh', () => refreshModeration())}
				>
					Refresh queue
				</button>
			</div>

			<div class="queue-list">
				{#each moderationItems as item (`${item.targetType}:${item.commentId ?? item.artworkId}`)}
					<article class="entity-card queue-card">
						<div class="entity-header">
							<div>
								<h3>{item.targetType === 'artwork' ? 'Artwork case' : 'Comment case'}</h3>
								<p>{item.authorNickname} · {item.reportCount} reports</p>
							</div>
							<div class="badge-row">
								<span class="badge role">{item.targetType}</span>
								{#if item.isHidden}
									<span class="badge warn">Hidden</span>
								{/if}
							</div>
						</div>

						<p class="content-summary">{item.contentSummary}</p>

						<div class="action-row action-wrap">
							{#if item.targetType === 'artwork'}
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || item.isHidden}
									onclick={() => moderateArtwork(item.artworkId, 'hide')}
								>
									Hide
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || !item.isHidden}
									onclick={() => moderateArtwork(item.artworkId, 'unhide')}
								>
									Unhide
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null}
									onclick={() => moderateArtwork(item.artworkId, 'mark_nsfw')}
								>
									Mark NSFW
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null}
									onclick={() => moderateArtwork(item.artworkId, 'clear_nsfw')}
								>
									Clear NSFW
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null}
									onclick={() => moderateArtwork(item.artworkId, 'dismiss')}
								>
									Dismiss report
								</button>
								<button
									type="button"
									class="danger"
									disabled={busyKey !== null}
									onclick={() => moderateArtwork(item.artworkId, 'delete')}
								>
									Delete artwork
								</button>
							{:else if item.commentId}
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || item.isHidden}
									onclick={() => moderateComment(item.artworkId, item.commentId!, 'hide')}
								>
									Hide
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null || !item.isHidden}
									onclick={() => moderateComment(item.artworkId, item.commentId!, 'unhide')}
								>
									Unhide
								</button>
								<button
									type="button"
									class="secondary"
									disabled={busyKey !== null}
									onclick={() => moderateComment(item.artworkId, item.commentId!, 'dismiss')}
								>
									Dismiss report
								</button>
								<button
									type="button"
									class="danger"
									disabled={busyKey !== null}
									onclick={() => moderateComment(item.artworkId, item.commentId!, 'delete')}
								>
									Delete comment
								</button>
							{/if}
						</div>
					</article>
				{:else}
					<p class="queue-empty">
						No reported content. Use the gallery Mod controls for direct actions.
					</p>
				{/each}
			</div>

			{#if moderationHasMore}
				<div class="panel-footer">
					<button
						type="button"
						class="secondary"
						disabled={busyKey !== null}
						onclick={() => withBusy('moderation:more', () => refreshModeration({ append: true }))}
					>
						Load more cases
					</button>
				</div>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'policy' && data.permissions.canUpdateTextPolicy}
		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="eyebrow">Text moderation</p>
					<h2>Phrase policy console</h2>
				</div>
				<div class="header-actions">
					<button
						type="button"
						class="secondary"
						disabled={busyKey !== null}
						onclick={() => withBusy('policy:refresh', () => refreshTextPolicy())}
					>
						Reload
					</button>
					<button type="button" disabled={busyKey !== null} onclick={saveTextPolicy}>
						Save policy
					</button>
				</div>
			</div>

			<div class="policy-grid">
				{#each policyContexts as policy (policy.context)}
					<article class="entity-card policy-card">
						<div class="entity-header compact">
							<div>
								<h3>{policy.label}</h3>
								<p>{policy.description}</p>
							</div>
							<span class="badge role">v{policyDrafts[policy.context].expectedVersion}</span>
						</div>

						<label>
							<span>Allowlist</span>
							<textarea
								rows="8"
								value={policyDrafts[policy.context].allowlist}
								oninput={(event) =>
									updatePolicyDraft(policy.context, 'allowlist', event.currentTarget.value)}
							></textarea>
						</label>

						<label>
							<span>Blocklist</span>
							<textarea
								rows="8"
								value={policyDrafts[policy.context].blocklist}
								oninput={(event) =>
									updatePolicyDraft(policy.context, 'blocklist', event.currentTarget.value)}
							></textarea>
						</label>
					</article>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	/* The back office sits against the same dark museum wall as the gallery. */
	:global(body) {
		background:
			radial-gradient(circle at 82% 8%, rgba(255, 247, 214, 0.16), transparent 46%),
			radial-gradient(circle at 12% 94%, rgba(18, 10, 4, 0.5), transparent 60%),
			linear-gradient(180deg, #2e2820 0%, #272117 60%, #211b12 100%);
	}

	.ops-shell {
		max-width: 1200px;
		margin: 0 auto;
		padding: 6rem 1.25rem 4rem;
		color: #2f241c;
	}

	/* ── paper sheets ── */

	.hero-panel,
	.panel {
		position: relative;
		border-radius: 3px;
		background-color: #fbf7f0;
		box-shadow:
			4px 6px 16px rgba(0, 0, 0, 0.32),
			1px 2px 4px rgba(0, 0, 0, 0.18);
	}

	/* per-pixel paper noise */
	.hero-panel::before,
	.panel::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.18 0 0 0 0 0.13 0 0 0 0 0.08 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
		pointer-events: none;
	}

	.hero-panel {
		display: grid;
		grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.9fr);
		gap: 1.25rem;
		padding: 1.6rem 1.7rem;
		rotate: -0.3deg;
	}

	.hero-panel h1 {
		margin: 0.2rem 0 0.4rem;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: clamp(1.9rem, 4vw, 2.9rem);
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #2f241c;
	}

	/* a swipe of paint under the desk title */
	.hero-panel h1::after {
		content: '';
		display: block;
		width: 170px;
		height: 7px;
		margin-top: 6px;
		rotate: -0.8deg;
		border-radius: 4px 7px 5px 8px;
		background: linear-gradient(90deg, rgba(212, 131, 74, 0.75), rgba(212, 131, 74, 0.25) 92%);
	}

	.lede {
		max-width: 52ch;
		margin: 0.6rem 0 0;
		font-size: 0.96rem;
		line-height: 1.65;
		color: #5d4e37;
	}

	/* the on-duty card, pinned beside the title */
	.hero-meta {
		display: grid;
		gap: 0.9rem;
		align-content: start;
		align-self: start;
		padding: 1rem 1.1rem;
		border: 1px solid #d6cfc5;
		border-radius: 2px;
		background: #fdfbf7;
		box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.16);
		rotate: 0.8deg;
	}

	.hero-meta span,
	.action-label,
	label span,
	.metric-card span {
		display: block;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	.hero-meta strong {
		font-family: 'Caveat', cursive;
		font-size: 1.5rem;
		font-weight: 600;
		line-height: 1;
		color: #2f241c;
		rotate: -1deg;
	}

	.eyebrow {
		margin: 0;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	/* ── metric index cards ── */

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 1.4rem;
	}

	.metric-card {
		padding: 1rem 1.05rem;
		border: 1px solid #d6cfc5;
		border-top: 5px solid rgba(212, 131, 74, 0.65);
		border-radius: 2px;
		background: #fdfbf7;
		box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.18);
	}

	.metric-card:nth-child(odd) {
		rotate: -0.4deg;
	}

	.metric-card:nth-child(even) {
		rotate: 0.4deg;
	}

	.metric-card strong {
		display: block;
		margin-top: 0.45rem;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 2.1rem;
		font-weight: 700;
		line-height: 1;
		color: #2f241c;
	}

	.metric-card p {
		margin: 0.5rem 0 0;
		font-size: 0.82rem;
		line-height: 1.5;
		color: #6f6257;
	}

	.accent-danger {
		border-top-color: rgba(162, 77, 73, 0.75);
	}

	.accent-amber {
		border-top-color: rgba(232, 179, 6, 0.8);
	}

	.accent-dark {
		border-top-color: rgba(113, 145, 127, 0.8);
	}

	/* ── manila folder tabs ── */

	.tab-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 1.7rem 0 0;
		padding: 0 0.9rem;
	}

	.tab-strip button {
		border: 1px solid #d0c4b0;
		border-bottom: 0;
		border-radius: 7px 7px 0 0;
		padding: 0.6rem 1.15rem 0.75rem;
		background: #ece2cd;
		color: #6b5a45;
		box-shadow: none;
		translate: 0 2px;
	}

	.tab-strip button:hover:enabled {
		transform: none;
		background: #f3ebda;
	}

	.tab-strip button.active {
		background: #fbf7f0;
		color: #2f241c;
		border-color: #d6cfc5;
		box-shadow: 0 -3px 8px rgba(0, 0, 0, 0.12);
		translate: 0 0;
	}

	/* ── sticker buttons ── */

	button {
		border: 0;
		border-radius: 2px;
		padding: 0.62rem 1.05rem;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		background: #d4834a;
		color: #2f241c;
		box-shadow: 2px 3px 0 rgba(47, 36, 28, 0.28);
		transition:
			translate 120ms ease,
			box-shadow 120ms ease,
			background 120ms ease;
	}

	button.secondary {
		background: #fdfbf7;
		border: 1.5px solid rgba(141, 110, 78, 0.5);
		color: #5d4e37;
	}

	button.danger {
		background: #a24d49;
		color: #fdfbf7;
	}

	button:hover:enabled {
		translate: 0 -2px;
		box-shadow: 2px 5px 0 rgba(47, 36, 28, 0.26);
	}

	button:active:enabled {
		translate: 0 1px;
		box-shadow: 1px 1px 0 rgba(47, 36, 28, 0.3);
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		box-shadow: none;
	}

	button:focus-visible {
		outline: 3px solid #4ecdc4;
		outline-offset: 2px;
	}

	/* ── notices: taped paper strips ── */

	.banner {
		margin: 1rem 0;
		padding: 0.8rem 1rem;
		border-left: 5px solid rgba(141, 110, 78, 0.6);
		border-radius: 2px;
		background: #fdfbf7;
		box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.2);
		rotate: -0.2deg;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.banner[data-tone='error'] {
		border-left-color: #a8403a;
		color: #8f3720;
	}

	.banner[data-tone='success'] {
		border-left-color: #719180;
		color: #355a3d;
	}

	/* ── work panels ── */

	.panel {
		padding: 1.5rem 1.6rem;
		margin-top: 0;
	}

	.panel + .panel {
		margin-top: 1rem;
	}

	.panel-header,
	.entity-header,
	.header-actions,
	.action-row {
		display: flex;
		gap: 0.75rem;
		justify-content: space-between;
		align-items: flex-start;
	}

	.panel-header {
		margin-bottom: 1.2rem;
	}

	.panel-header h2,
	.entity-header h3 {
		margin: 0.25rem 0 0;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #2f241c;
	}

	.panel-header h2 {
		font-size: 1.25rem;
	}

	.entity-header h3 {
		font-size: 0.95rem;
	}

	.panel-header p,
	.entity-header p,
	.content-summary {
		margin: 0.35rem 0 0;
		color: #5d4e37;
		line-height: 1.55;
	}

	.user-grid,
	.policy-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	/* nothing on the desk */
	.queue-empty {
		margin: 0;
		padding: 1.2rem 0.3rem;
		font-family: 'Caveat', cursive;
		font-size: 1.25rem;
		font-weight: 600;
		color: #8a6c52;
		rotate: -0.5deg;
	}

	.queue-list {
		display: grid;
		gap: 1rem;
	}

	/* ── case files: index cards ── */

	.entity-card {
		padding: 1.1rem 1.15rem;
		border: 1px solid #d6cfc5;
		border-radius: 2px;
		background: #fdfbf7;
		box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.14);
	}

	.entity-card:nth-child(odd) {
		rotate: -0.25deg;
	}

	.entity-card:nth-child(even) {
		rotate: 0.25deg;
	}

	.entity-header.compact {
		align-items: center;
	}

	.badge-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	/* rubber ink stamps, like the postcard franking */
	.badge {
		padding: 0.22rem 0.5rem;
		border: 2px solid currentColor;
		border-radius: 4px;
		background: transparent;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	.badge.role {
		color: #3f5e8c;
		rotate: -1.5deg;
	}

	.badge.warn {
		color: #b07c10;
		rotate: 1deg;
	}

	.badge.amber {
		color: #a8632c;
		rotate: -1deg;
	}

	.badge.danger {
		color: #a8403a;
		rotate: 1.5deg;
	}

	.details-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}

	dt {
		margin: 0;
		font-family: var(--font-display, 'Fredoka', sans-serif);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #8a6c52;
	}

	dd {
		margin: 0.2rem 0 0;
		font-size: 0.92rem;
		color: #2f241c;
		overflow-wrap: anywhere;
	}

	/* the report reason, pencilled into the margin */
	.reason {
		margin: 0.6rem 0 0;
		padding: 0.55rem 0.85rem;
		border-left: 4px solid rgba(162, 77, 73, 0.7);
		border-radius: 2px;
		background: rgba(250, 238, 234, 0.8);
		font-family: 'Caveat', cursive;
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.3;
		color: #8f3720;
		rotate: -0.3deg;
	}

	.action-block + .action-block {
		margin-top: 1rem;
	}

	.action-row {
		flex-wrap: wrap;
		margin-top: 0.65rem;
	}

	.action-wrap {
		justify-content: flex-start;
	}

	/* paper form fields */
	textarea {
		width: 100%;
		margin-top: 0.55rem;
		padding: 0.7rem 0.85rem;
		border: 1.5px solid rgba(141, 110, 78, 0.45);
		border-radius: 2px;
		background: #fffdf8;
		font: inherit;
		color: #2f241c;
		resize: vertical;
	}

	textarea:focus-visible {
		outline: none;
		border-color: #d4834a;
		box-shadow: 0 0 0 3px rgba(212, 131, 74, 0.2);
	}

	.panel-footer {
		margin-top: 1.1rem;
		display: flex;
		justify-content: center;
	}

	@media (max-width: 960px) {
		.hero-panel,
		.metrics-grid,
		.user-grid,
		.policy-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.ops-shell {
			padding-top: 4.5rem;
		}

		.panel,
		.hero-panel,
		.metric-card,
		.entity-card {
			padding: 1rem;
		}

		.panel-header,
		.entity-header,
		.header-actions {
			flex-direction: column;
		}

		.details-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
