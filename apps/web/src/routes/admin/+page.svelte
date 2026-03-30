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

	const initialPermissions = data.permissions;
	const initialUsersPage = data.usersPage;
	const initialModerationPage = data.moderationPage;
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
			data.permissions.canModerate
				? { key: 'moderation' as const, label: 'Moderation queue' }
				: null,
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
	<title>Internal Ops | Not the Louvre</title>
</svelte:head>

<div class="ops-shell">
	<section class="hero-panel">
		<div>
			<p class="eyebrow">Internal operations</p>
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
					<p class="eyebrow">Moderation queue</p>
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
	:global(body) {
		background:
			radial-gradient(circle at top left, rgba(208, 176, 116, 0.28), transparent 32%),
			radial-gradient(circle at top right, rgba(86, 99, 91, 0.18), transparent 28%),
			linear-gradient(180deg, #f7f0e2 0%, #efe3cc 36%, #e6dac4 100%);
	}

	.ops-shell {
		max-width: 1200px;
		margin: 0 auto;
		padding: 6rem 1.25rem 4rem;
		color: #1f1f1a;
	}

	.hero-panel,
	.panel,
	.metric-card,
	.entity-card,
	.tab-strip button,
	.banner {
		border: 1px solid rgba(46, 38, 26, 0.12);
		box-shadow: 0 18px 48px rgba(57, 46, 31, 0.1);
	}

	.hero-panel {
		display: grid;
		grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.9fr);
		gap: 1.25rem;
		padding: 1.5rem;
		border-radius: 28px;
		background:
			linear-gradient(135deg, rgba(40, 47, 44, 0.96), rgba(87, 69, 43, 0.92)),
			linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0));
		color: #f9f4ea;
	}

	.hero-panel h1 {
		margin: 0.2rem 0 0.75rem;
		font-size: clamp(2.2rem, 5vw, 4.4rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
	}

	.lede {
		max-width: 52ch;
		margin: 0;
		font-size: 1rem;
		line-height: 1.7;
		color: rgba(249, 244, 234, 0.82);
	}

	.hero-meta {
		display: grid;
		gap: 0.9rem;
		align-content: start;
		padding: 1rem;
		border-radius: 20px;
		background: rgba(247, 240, 226, 0.08);
	}

	.hero-meta span,
	.action-label,
	label span,
	.metric-card span {
		display: block;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.hero-meta strong {
		font-size: 1.1rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(245, 223, 182, 0.88);
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.metric-card {
		padding: 1.1rem 1rem;
		border-radius: 22px;
		background: rgba(255, 251, 244, 0.78);
		backdrop-filter: blur(12px);
	}

	.metric-card strong {
		display: block;
		margin-top: 0.5rem;
		font-size: 2.2rem;
		letter-spacing: -0.04em;
	}

	.metric-card p {
		margin: 0.5rem 0 0;
		line-height: 1.5;
		color: rgba(31, 31, 26, 0.72);
	}

	.accent-danger {
		background: linear-gradient(180deg, rgba(255, 242, 238, 0.92), rgba(249, 228, 221, 0.92));
	}

	.accent-amber {
		background: linear-gradient(180deg, rgba(255, 248, 231, 0.94), rgba(247, 234, 193, 0.92));
	}

	.accent-dark {
		background: linear-gradient(180deg, rgba(232, 238, 233, 0.94), rgba(211, 222, 214, 0.94));
	}

	.tab-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin: 1.5rem 0 1rem;
	}

	.tab-strip button,
	button {
		border-radius: 999px;
		padding: 0.85rem 1.1rem;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 120ms ease,
			box-shadow 120ms ease,
			background 120ms ease;
	}

	.tab-strip button {
		background: rgba(255, 250, 241, 0.76);
		color: #332d21;
	}

	.tab-strip button.active {
		background: linear-gradient(135deg, #2f3b35, #655233);
		color: #f9f4ea;
	}

	button {
		border: 1px solid rgba(46, 38, 26, 0.14);
		background: linear-gradient(135deg, #2f3b35, #655233);
		color: #f9f4ea;
		box-shadow: 0 12px 30px rgba(57, 46, 31, 0.14);
	}

	button.secondary {
		background: rgba(255, 251, 244, 0.82);
		color: #2b2a25;
	}

	button.danger {
		background: linear-gradient(135deg, #7f352f, #9d503c);
	}

	button:hover:enabled {
		transform: translateY(-1px);
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		box-shadow: none;
	}

	.banner {
		margin: 0 0 1rem;
		padding: 0.95rem 1rem;
		border-radius: 18px;
		background: rgba(255, 250, 241, 0.78);
	}

	.banner[data-tone='error'] {
		background: rgba(255, 236, 231, 0.94);
		color: #742d27;
	}

	.banner[data-tone='success'] {
		background: rgba(233, 244, 233, 0.94);
		color: #214531;
	}

	.panel {
		padding: 1.4rem;
		border-radius: 28px;
		background: rgba(255, 251, 244, 0.76);
		backdrop-filter: blur(14px);
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
	}

	.panel-header p,
	.entity-header p,
	.content-summary,
	.reason {
		margin: 0.35rem 0 0;
		color: rgba(35, 34, 29, 0.72);
		line-height: 1.55;
	}

	.user-grid,
	.policy-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.queue-list {
		display: grid;
		gap: 1rem;
	}

	.entity-card {
		padding: 1.15rem;
		border-radius: 22px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(250, 244, 234, 0.82));
	}

	.entity-header.compact {
		align-items: center;
	}

	.badge-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.badge {
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.badge.role {
		background: rgba(47, 59, 53, 0.12);
		color: #32423a;
	}

	.badge.warn {
		background: rgba(225, 176, 77, 0.18);
		color: #7b5411;
	}

	.badge.amber {
		background: rgba(202, 106, 18, 0.16);
		color: #874408;
	}

	.badge.danger {
		background: rgba(180, 46, 34, 0.16);
		color: #842b24;
	}

	.details-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}

	dt {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(35, 34, 29, 0.54);
	}

	dd {
		margin: 0.2rem 0 0;
		font-size: 0.96rem;
	}

	.reason {
		padding: 0.85rem 0.95rem;
		border-radius: 16px;
		background: rgba(255, 236, 231, 0.66);
		color: #692921;
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

	textarea {
		width: 100%;
		margin-top: 0.55rem;
		padding: 0.85rem 0.95rem;
		border: 1px solid rgba(46, 38, 26, 0.14);
		border-radius: 16px;
		background: rgba(255, 252, 247, 0.86);
		font: inherit;
		color: inherit;
		resize: vertical;
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
