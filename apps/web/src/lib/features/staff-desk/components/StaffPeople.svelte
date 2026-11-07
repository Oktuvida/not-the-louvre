<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Minus, Plus, UserRound } from 'lucide-svelte';
	import GameButton from '#lib/features/shared-ui/components/GameButton.svelte';
	import {
		countLabel,
		type AvatarAction,
		type PeopleFilter,
		type StaffPerson,
		type StaffUsersPage
	} from '../model';

	/*
	 * Everybody in the museum: a short list to search, with the controls for one
	 * artist at a time, because a page of open forms is how a ban lands on the
	 * wrong person.
	 */
	let {
		busy = false,
		onAvatar,
		onBan,
		onFind,
		onMore,
		onRole,
		onUnban,
		page
	}: {
		busy?: boolean;
		onAvatar: (person: StaffPerson, action: AvatarAction) => void;
		onBan: (person: StaffPerson, reason: string) => void;
		onFind: (search: string, filter: PeopleFilter) => void;
		onMore: () => void;
		onRole: (person: StaffPerson, role: 'moderator' | 'user') => void;
		onUnban: (person: StaffPerson) => void;
		page: StaffUsersPage;
	} = $props();

	const SEARCH_PAUSE_MS = 250;
	const FILTERS: { key: PeopleFilter; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'moderators', label: 'Moderators' },
		{ key: 'banned', label: 'Banned' }
	];

	let search = $state('');
	let filter = $state<PeopleFilter>('all');
	let openId = $state<string | null>(null);
	let banReasons = $state<Record<string, string>>({});
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const totals = $derived(page.totals);
	const joined = (date: Date | string) =>
		new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(date));

	const typed = () => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => onFind(search, filter), SEARCH_PAUSE_MS);
	};

	const pickFilter = (key: PeopleFilter) => {
		clearTimeout(searchTimer);
		filter = key;
		onFind(search, key);
	};

	const reasonFor = (person: StaffPerson) => (banReasons[person.id] ?? '').trim();

	onDestroy(() => clearTimeout(searchTimer));
</script>

<p class="desk-line">
	<b>{countLabel(totals.artists, 'artist')}</b>, {countLabel(totals.moderators, 'moderator')},
	{totals.banned} banned
</p>

<section class="people-sheet">
	<div class="people-find">
		<input
			type="search"
			aria-label="Find an artist by name"
			placeholder="Find an artist by name"
			bind:value={search}
			oninput={typed}
		/>
		<div class="people-filters">
			{#each FILTERS as { key, label } (key)}
				<button
					type="button"
					class="people-filter focus-ring"
					aria-pressed={filter === key}
					onclick={() => pickFilter(key)}
				>
					{label}
				</button>
			{/each}
		</div>
	</div>

	{#if page.items.length === 0}
		<p class="people-none">Nobody by that name.</p>
	{/if}

	<ul class="people-rows">
		{#each page.items as person (person.id)}
			{@const isOpen = openId === person.id}
			<li>
				<button
					type="button"
					class="person focus-ring"
					aria-expanded={isOpen}
					aria-label={`Open ${person.nickname}`}
					onclick={() => (openId = isOpen ? null : person.id)}
				>
					{#if person.avatarUrl}
						<img class="person-face" src={person.avatarUrl} alt="" />
					{:else}
						<span class="person-face person-no-face"><UserRound aria-hidden="true" /></span>
					{/if}
					<span class="person-name">{person.nickname}</span>
					<span class="person-role" data-role={person.isBanned ? 'banned' : person.role}>
						{person.isBanned ? 'Banned' : person.role === 'user' ? 'Artist' : person.role}
					</span>
					<span class="person-note">{countLabel(person.artworkCount, 'artwork')}</span>
					<span class="person-note">since {joined(person.createdAt)}</span>
					{#if isOpen}
						<Minus class="person-more" aria-hidden="true" />
					{:else}
						<Plus class="person-more" aria-hidden="true" />
					{/if}
				</button>

				{#if isOpen}
					<div class="person-controls">
						{#if person.role !== 'admin'}
							<div class="person-group">
								<h3>Role</h3>
								<p>Moderators can work the queue.</p>
								{#if person.role === 'user'}
									<GameButton
										variant="ghost"
										size="sm"
										disabled={busy}
										onclick={() => onRole(person, 'moderator')}
									>
										Make moderator
									</GameButton>
								{:else}
									<GameButton
										variant="ghost"
										size="sm"
										disabled={busy}
										onclick={() => onRole(person, 'user')}
									>
										Make artist
									</GameButton>
								{/if}
							</div>
						{/if}

						<div class="person-group">
							<h3>Avatar</h3>
							<p>
								{person.avatarIsHidden
									? 'Hidden from the wall.'
									: person.avatarIsNsfw
										? 'Marked 18+.'
										: 'Pulled from the wall if it breaks the rules.'}
							</p>
							<div class="person-buttons">
								<GameButton
									variant="ghost"
									size="sm"
									disabled={busy}
									onclick={() => onAvatar(person, person.avatarIsHidden ? 'unhide' : 'hide')}
								>
									{person.avatarIsHidden ? 'Put back' : 'Hide'}
								</GameButton>
								<GameButton
									variant="ghost"
									size="sm"
									disabled={busy}
									onclick={() => onAvatar(person, person.avatarIsNsfw ? 'clear_nsfw' : 'mark_nsfw')}
								>
									{person.avatarIsNsfw ? 'Clear 18+' : 'Mark 18+'}
								</GameButton>
							</div>
						</div>

						{#if person.role !== 'admin'}
							<div class="person-group">
								<h3>Ban</h3>
								{#if person.isBanned}
									<p>{person.banReason}</p>
									<GameButton
										variant="ghost"
										size="sm"
										disabled={busy}
										onclick={() => onUnban(person)}
									>
										Lift the ban
									</GameButton>
								{:else}
									<textarea
										aria-label="Why? They can read this."
										placeholder="Why? They can read this."
										rows="2"
										bind:value={banReasons[person.id]}></textarea>
									<GameButton
										variant="danger"
										size="sm"
										disabled={busy || !reasonFor(person)}
										onclick={() => onBan(person, reasonFor(person))}
									>
										Ban artist
									</GameButton>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if page.pageInfo.hasMore}
		<div class="people-more">
			<GameButton variant="ghost" size="sm" disabled={busy} onclick={onMore}>Show more</GameButton>
		</div>
	{/if}
</section>

<style>
	.people-sheet {
		background-color: #fbf8f2;
		background-image: radial-gradient(rgb(107 90 69 / 0.08) 1px, transparent 1px);
		background-size: 4px 4px;
		box-shadow:
			0 1px 1px rgb(40 25 10 / 0.25),
			0 0.5rem 1.1rem rgb(40 25 10 / 0.26);
	}

	.people-find {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1.1rem;
	}

	.people-find input {
		flex: 1 1 15rem;
		min-width: 0;
		padding: 0.5rem 0.75rem;
		border: 0;
		border-bottom: 2px solid rgb(45 36 32 / 0.55);
		background: transparent;
		font-family: var(--font-hand);
		font-size: 1.32rem;
		color: var(--color-ink-warm);
	}

	.people-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
	}

	.people-filter {
		min-height: 2.75rem;
		padding-inline: 0.7rem;
		border: 0;
		background: none;
		font-family: var(--font-display);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgb(45 36 32 / 0.68);
		cursor: pointer;
	}

	.people-filter[aria-pressed='true'] {
		background: rgb(214 170 110 / 0.42);
		color: var(--color-ink-warm);
	}

	.people-none {
		margin: 0;
		padding: 1rem 1.1rem 1.5rem;
		font-family: var(--font-hand);
		font-size: 1.25rem;
		color: rgb(45 36 32 / 0.72);
	}

	.people-rows {
		margin: 0;
		padding: 0.3rem 1.1rem 0.6rem;
		list-style: none;
	}

	.people-rows > li {
		border-bottom: 1px solid rgb(107 90 69 / 0.2);
	}

	.people-rows > li:last-child {
		border-bottom: 0;
	}

	.person {
		display: grid;
		grid-template-columns: 2.6rem minmax(0, 1.5fr) 6.5rem 6.5rem 7.5rem 1.2rem;
		gap: 0.9rem;
		align-items: center;
		width: 100%;
		padding: 0.5rem 0;
		border: 0;
		background: none;
		font-size: 0.95rem;
		text-align: left;
		color: var(--color-ink-warm);
		cursor: pointer;
	}

	.person-face {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 2px solid var(--color-ink-warm);
		border-radius: 50%;
		object-fit: cover;
		background: #f5f0e1;
	}

	.person-no-face :global(svg) {
		width: 1.3rem;
		height: 1.3rem;
		color: rgb(45 36 32 / 0.55);
	}

	.person-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-hand);
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 1;
	}

	.person-role {
		justify-self: start;
		padding: 0.06rem 0.45rem;
		border: 1.5px solid currentColor;
		border-radius: 3px;
		font-family: var(--font-display);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #3f6a96;
	}

	.person-role[data-role='moderator'],
	.person-role[data-role='admin'] {
		color: #3d7a4f;
	}

	.person-role[data-role='banned'] {
		color: #b5473c;
	}

	.person-note {
		color: rgb(45 36 32 / 0.68);
	}

	.person :global(.person-more) {
		width: 1rem;
		height: 1rem;
		color: rgb(45 36 32 / 0.55);
	}

	.person-controls {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.4rem;
		padding: 0.5rem 0.3rem 1.15rem;
	}

	.person-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.45rem;
		min-width: 0;
	}

	.person-group h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgb(45 36 32 / 0.68);
	}

	.person-group p {
		margin: 0;
		overflow-wrap: anywhere;
		font-size: 0.9rem;
		color: rgb(45 36 32 / 0.72);
	}

	.person-group textarea {
		width: 100%;
		padding: 0.45rem 0.55rem;
		border: 1.5px solid rgb(107 90 69 / 0.4);
		background: #fff;
		font-family: var(--font-hand);
		font-size: 1.1rem;
		color: var(--color-ink-warm);
		resize: vertical;
	}

	.person-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.people-more {
		display: flex;
		justify-content: center;
		padding-bottom: 1rem;
	}

	@media (max-width: 39.99rem) {
		.people-find {
			padding: 0.7rem 0.75rem;
			gap: 0.4rem;
		}

		.people-rows {
			padding-inline: 0.75rem;
		}

		.person {
			grid-template-columns: 2.4rem minmax(0, 1fr) auto 1rem;
			gap: 0.6rem;
		}

		.person-note {
			display: none;
		}

		.person-controls {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.9rem;
		}
	}
</style>
