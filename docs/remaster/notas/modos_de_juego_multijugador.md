# Multiplayer drawing game modes on Cloudflare (exquisite corpse, replicate a drawing, draw from a prompt), October 2026

Research date: 2026-10-23. Scope: architecture recommendation for adding party-game modes to "Not The Louvre" (SvelteKit / Svelte 5 on Cloudflare Workers paid plan, Postgres via Hyperdrive, R2, Better Auth username+password, vector stroke documents on a 768x768 canvas).

Project facts checked in the repo (read-only):
- `apps/web/wrangler.jsonc`: `"main": ".svelte-kit/cloudflare/_worker.js"`, `"compatibility_date": "2026-06-01"`, Hyperdrive binding `HYPERDRIVE`. There are no Durable Object bindings yet. `svelte.config.js` uses `@sveltejs/adapter-cloudflare`.
- `better-auth` 1.4.22 is installed. Its `dist/plugins/anonymous/` exists, and `schema.mjs` adds a `user.isAnonymous` field. `auth.ts` currently enables only `username()` and `sveltekitCookies()`.
- NSFW handling today is labels, not automation: `artworkNsfwSource` enum (`'creator' | 'moderator'`), `artwork.isNsfw`, `nsfwLabeledAt`, `user.avatarIsNsfw` in `apps/web/src/lib/server/db/schema.ts`. There is no automated image classifier.
- Project memory (`MEMORY.md`, entry "CONNECTION_CLOSED publish failures") records that Supavisor kills large Postgres Binds above roughly 50–97 KiB. That is a reason to keep game stroke documents in R2, not Postgres rows.

---

## 1. Cloudflare realtime building blocks in 2026 (Durable Objects, PartyKit/partyserver, Agents SDK, Yjs) and live stroke streaming

### Takeaway
Use one SQLite-backed Durable Object (DO) per game room, with the WebSocket Hibernation API and alarms for turn timers. It is the documented, cheap and proven pattern: tldraw runs tldraw.com's multiplayer on it. `partyserver` + `partysocket` (Cloudflare-maintained, still labelled work in progress) is a thin, optional convenience layer. The Agents SDK is now framed around AI agents and is more than a party game needs. Yjs is unnecessary for turn-based, server-authoritative modes. Most of the proposed modes do not need live stroke streaming at all, because players draw in secret.

### Cited Findings
**Durable Objects pricing (Workers Paid)**
- Requests: 1M/month included, then $0.15 per million. This covers HTTP requests, RPC sessions, WebSocket messages and alarm invocations. Incoming WebSocket messages bill at 20:1 (100 incoming messages = 5 requests). Outgoing messages and incoming protocol pings are not charged. — [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Duration: 400,000 GB-s/month included, then $12.50 per million GB-s, billed on the 128 MB allocated per object. Usage is rounded up to the next billable unit (500,000 GB-s bills as 1,000,000 GB-s). — [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- SQLite backend: 25 billion rows read/month included, then $0.001 per million. 50 million rows written/month included, then $1.00 per million. 5 GB-month stored included, then $0.20 per GB-month. Deletes count as rows written, and each `setAlarm()` counts as one row written. — [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- SQLite storage billing was scheduled to start January 7, 2026 ("no earlier"). Only usage after that date is billed, and compute billing was already active. The pricing page and the changelog still use "will be enabled" wording, so there is no explicit confirmation that billing went live. — [CF changelog 2026-01-07](https://developers.cloudflare.com/changelog/2026-01-07-durable-objects-sqlite-storage-billing); [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Cloudflare's own worked example (WebSocket Hibernation): 100 objects × 100 connections, 1 message/min per client, 10 ms handler time → 21.61M billable requests ($3.15) + 552,960 GB-s ($12.50 after rounding) = $20.65/month including the $5 minimum. The same traffic without hibernation (example 2: 100 objects × 50 connections, awake 8 h/day) costs $142.95/month, almost all of it duration. — [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Workers Paid base price: $5/month. 10M requests included, then $0.30/M. 30M CPU-ms included, then $0.02 per M CPU-ms. A WebSocket connection is charged as one request (the Upgrade), and messages routed through a Worker do not count as requests. — [CF Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

**DO limits relevant to rooms**
- WebSocket received message size: 32 MiB. Soft limit 1,000 requests/s per object. CPU: 30 s per request by default, reset by each incoming HTTP request or WebSocket message, configurable up to 5 min (`limits.cpu_ms`). SQLite: 10 GB per object (Paid), 2 MB max string/BLOB/row, 100 KB max SQL statement, 100 bound parameters per query, 100 columns per table. Alarm handler wall time: 15 min. — [CF DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- A third-party guide says the WebSocket message limit rose from 1 MiB to 32 MiB in October 2025. This is secondary and was not verified against the changelog. — [tessl skill page (secondary)](https://tessl.io/skills/github/jezweb/claude-skills/cloudflare-durable-objects)
- The Hibernation API allows at most 32,768 WebSocket connections per DO; practical limits may be lower. `acceptWebSocket(ws, tags)` allows at most 10 tags of 256 characters each per socket, and `getWebSockets(tag)` filters by tag. `setWebSocketAutoResponse` answers matching request/response pairs (each ≤2,048 characters) without waking the object or adding billable duration, which suits heartbeats. `blockConcurrencyWhile` has a 30 s timeout. `waitUntil` keeps the object alive up to 15 min. — [CF DO State API](https://developers.cloudflare.com/durable-objects/api/state/)

**Hibernation API behaviour**
- `ctx.acceptWebSocket()` (instead of `ws.accept()`) enables hibernation. Billable duration does not accrue while hibernated, and clients stay connected. When an event arrives the object is re-initialised and its constructor runs, so in-memory state is lost. `serializeAttachment` stores at most 16,384 bytes per connection. — [CF WebSockets best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- `setTimeout`/`setInterval` and incoming events prevent hibernation. Outgoing WebSockets never hibernate. **Code deploys disconnect all WebSockets.** Validate the `Upgrade` header in the Worker before calling the DO, because DO requests are billed. Batch messages, for example every 50–100 ms or every 50–100 messages. — [CF WebSockets best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- From compatibility date 2026-04-07 with `web_socket_auto_reply_to_close`, the runtime auto-replies to Close frames. The repo's compatibility date is 2026-06-01. — [CF WebSockets best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- A third-party guide says an idle object hibernates after about 10 s without activity. This is secondary. — [tessl skill page (secondary)](https://tessl.io/skills/github/jezweb/claude-skills/cloudflare-durable-objects)

**Alarms (turn timers)**
- One alarm per object at a time. `setAlarm(ms)` overrides any existing alarm. Execution is at-least-once. A throwing `alarm()` is retried with exponential backoff starting at 2 s, up to 6 retries. `alarmInfo.retryCount` and `isRetry` are available. The constructor runs before `alarm()` when an inactive object wakes. Multiple timed events should be stored in storage, with `alarm()` rescheduling itself. — [CF DO Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)

**Placement**
- Without a hint, an object is created near the first `get()`. `locationHint` (wnam, enam, sam, weur, eeur, apac, oc, afr, me) is best-effort and only applies to the first `get()`. Objects do not currently move after creation. Jurisdictions `eu`/`us`/`fedramp` restrict where an object runs and stores data. — [CF DO data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)

**PartyKit / partyserver / partysocket**
- PartyKit joined Cloudflare on April 5, 2024. — [PartyKit blog](https://blog.partykit.io/posts/partykit-is-joining-cloudflare/); [Cloudflare blog](https://blog.cloudflare.com/cloudflare-acquires-partykit)
- The `cloudflare/partykit` repo ("PartyKit, for Workers") contains PartyServer (room routing, lifecycle hooks, broadcasting on DOs), PartySocket (client with reconnection and buffering), Y-PartyServer (Yjs), partysub (pub/sub over N DOs), partysync (experimental DO→client state sync), partywhen (scheduling) and hono-party. The README calls it "a Work in Progress". No releases are listed on GitHub. — [GitHub cloudflare/partykit](https://github.com/cloudflare/partykit)
- partyserver 0.5.10 is listed as latest (no date shown). Hibernation is enabled with a static `options` property on the Server class. — [Socket.dev partyserver](https://socket.dev/npm/package/partyserver/overview/0.5.10); [partyserver README](https://cdn.jsdelivr.net/npm/partyserver@0.5.6/README.md)
- partysocket options: `minReconnectionDelay` (default 1000 + random×4000 ms), `maxReconnectionDelay` (10000 ms), `reconnectionDelayGrowFactor` (1.3), `minUptime` (5000 ms), `connectionTimeout` (4000 ms), `maxRetries` (Infinity) and `maxEnqueuedMessages` (Infinity; messages sent while disconnected are queued). `send()` accepts ArrayBuffer/Blob/ArrayBufferView. `url` can be an async function, which allows fetching an auth token per connect. — [partysocket README](https://cdn.jsdelivr.net/npm/partysocket/README.md)

**Agents SDK**
- As of the docs dated Oct 22, 2026, the Agents SDK is "the runtime layer for hosting AI agents on Cloudflare" (Agent class, state, sessions, WebSockets, scheduling, per-session SQL). The docs centre on AI agents (including a "Pi harness" that stores state in a DO's SQLite) and do not address games. — [CF Agents docs](https://developers.cloudflare.com/agents/)
- `this.setState()` persists to the agent's embedded SQLite, broadcasts to connected WebSocket clients, then calls `onStateChanged`. `validateStateChange()` can reject updates. Clients use `useAgent` (React) or `AgentClient`. The docs advise keeping state small because every change is broadcast. — [CF Agents state docs](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/)

**Precedent: tldraw on DOs**
- tldraw's self-hosted multiplayer template is "the system that runs on tldraw.com". Each room is one DO that holds the document in memory, broadcasts edits over WebSockets and periodically saves to R2. Auth, rate limits and upload limits are left to the integrator. tldraw reports about 30 simultaneous collaborators per room. SDK 4.3 (January 2026) added pluggable storage, with DO SQLite used for tldraw.com. — [tldraw sync docs](https://tldraw.dev/docs/sync); [tldraw-sync-cloudflare](https://github.com/tldraw/tldraw-sync-cloudflare); [tldraw SDK 4.3](https://tldraw.dev/blog/tldraw-sdk-4.3)

**SvelteKit integration**
- DO classes must be exported by the Worker module. One SvelteKit + adapter-cloudflare example uses a postbuild script that appends the DO export to the generated `_worker.js`. Bindings reach routes via `platform.env`, and routes call `idFromName` on the namespace. — [LangChain SvelteKit deploy example](https://docs.langchain.com/langsmith/deploy-sveltekit); [CF SvelteKit guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/index.md)

### Inferences
- **Recommended topology.** Create a separate realtime Worker (e.g. `apps/realtime`) that exports the `GameRoom` DO class, built with raw DO + Hibernation API or `partyserver`. SvelteKit would reach it through a cross-script DO binding or a service binding. This avoids patching the adapter output. More importantly, "code deploys disconnect all WebSockets", so deploying the frequently changing SvelteKit app would no longer kill live games. (The cross-script `script_name` binding is standard Wrangler, but no fetched source confirmed it; see Gaps.)
- **One DO per room**, addressed by `idFromName("room:" + code)`. Persist all game state that must survive a disconnect or deploy (phase, deadlines, players, submitted drawings) in DO SQLite, not only in memory. The constructor re-runs after hibernation and deploys drop sockets.
- **Timers.** Store an absolute `phase_deadline_ms` in SQLite and call `setAlarm(deadline)`. The `alarm()` handler advances the phase. Never use `setTimeout`, which blocks hibernation. Clients render countdowns from the deadline plus a clock offset measured at connect. Make phase transitions idempotent, because alarms are at-least-once.
- **Heartbeats.** Use `setWebSocketAutoResponse("ping","pong")` so keep-alives don't wake the object or bill duration.
- **Which layer.** partyserver is a reasonable thin layer: room routing, `onConnect`/`onMessage`/`onClose`, broadcast, hibernation flag, plus partysocket's reconnect and queueing on the client. Its WIP label and absence of tagged releases mean it should be pinned. Agents SDK `setState` broadcasting full state on every change is a poor fit for per-player secret information (each player must see only their own prompt or strip), so per-connection messages are needed anyway. Yjs/y-partyserver only makes sense for a future free-for-all shared-canvas mode, not for turn-based modes.
- **Live stroke streaming (only where others watch).** Candidate modes are a Pictionary/skribbl-style guessing mode, spectators, and a "watch the replay live" option.
  - Quantise coordinates to integers (768 fits in Uint16; per-point deltas mostly fit in Int8/Int16) and send binary ArrayBuffer frames.
  - Batch every 50–100 ms (CF's recommendation). At ~60 Hz pointer input that is ~6 points per frame, tens of bytes binary versus ~100+ bytes JSON.
  - Send live frames as best-effort previews, and send the completed stroke reliably on pointer-up with a client stroke id so the server can de-duplicate.
  - The server assigns a monotonically increasing `seq`. On reconnect, the client sends `lastSeq` and the DO replies with a snapshot (current phase plus finished strokes) rather than replaying every frame.
  - For backpressure, skip or merge preview frames on the client while `ws.bufferedAmount` is high (browser API, not a CF feature). Never let the queue of a partysocket in a disconnected state grow unbounded: set `maxEnqueuedMessages`.
  - Tune partysocket's default 1–5 s minimum reconnect delay down for a party game.
- **Secret-drawing modes** (exquisite corpse, replicate, draw-from-prompt) need no stroke broadcast. Clients draw locally and send an autosave of the current turn document on each stroke end (or every few seconds), plus a final submit. The DO only broadcasts lightweight progress ("Ana: 12 strokes", "3/6 done"). This keeps message volume low, keeps the object hibernating most of the time, and gives the server the latest drawing for auto-submit at the deadline if a phone drops.

### Gaps
- No primary source confirms that SQLite storage billing actually went live on Jan 7, 2026. The pricing page still says "will be enabled". Treat it as active for budgeting.
- Exact hibernation eviction delay (third-party "~10 s") and whether a scheduled-but-not-fired alarm prevents hibernation are not stated in the fetched docs. Cloudflare's example 4 bills duration as messages × handler time, which implies near-immediate hibernation between messages, but this is inferred.
- The fetched pages do not confirm whether the `Agent` class extends partyserver's `Server`.
- No fetched source confirms Wrangler's cross-script DO binding (`script_name`) for a SvelteKit app. It is standard Wrangler and should be checked in the Wrangler config docs.
- No fetched source confirms whether the Hyperdrive binding can be used directly inside a DO (versus calling back into a Worker via a service binding).

---

## 2. Live rooms vs asynchronous play: data model, room codes, lobbies, guests vs accounts, timers, spectators, disconnections, reveal, and when to persist

### Takeaway
Run live rooms as a server-authoritative state machine in a DO (lobby → draw rounds → vote/score → reveal → results), with ephemeral state in DO SQLite. At game end, write only the final artifacts: stroke documents to R2, plus game, participant, artwork and score rows to Postgres, with an idempotent game id. Better Auth 1.4.22 (installed) ships an anonymous plugin, so guests can play with just a nickname and later link their games to a real account. Asynchronous exquisite corpse can be a link-based chain and maps naturally onto fork lineage.

### Cited Findings
- Better Auth anonymous plugin: add `anonymous()` on the server and `anonymousClient()` on the client, then migrate the schema. `authClient.signIn.anonymous()` / `POST /sign-in/anonymous` creates a user with a generated email (`{id}@anonymous.placeholder.invalid` by default) and a session. `onLinkAccount({anonymousUser, newUser})` runs when the guest later signs in or up with another method, so data can be migrated. The anonymous user is deleted by default unless `disableDeleteAnonymousUser` is set. Options include `generateName`, `emailDomainName` and `generateRandomEmail`. Calling `signIn.anonymous()` while already anonymous returns an error. — [Better Auth anonymous plugin](https://www.better-auth.com/docs/plugins/anonymous)
- The installed `better-auth` 1.4.22 includes `dist/plugins/anonymous/`, and its schema adds `user.isAnonymous`. This was checked in the repo's `node_modules`, not in a web source.
- Jackbox model: one player starts the game, and others join by entering a room code on Jackbox's website from phones, tablets or computers, with no app download. Players beyond the active slots become audience members who can affect scoring. Hosts can censor players (since Quiplash 2), and a family-friendly option censors "certain questions and player input". — [Wikipedia: Drawful / Jackbox](https://en.wikipedia.org/wiki/Drawful)
- Gartic Phone: the host sets up a room and shares the link, and can adjust player count, time limits and modes. Rounds continue until every player has contributed to every chain, then chains are revealed in order. The "Crowd" mode supports up to 30 players with fewer turns, and not everyone takes part in every sequence. — [gamerules.com](https://gamerules.com/rules/gartic-phone-the-online-telephone-game/); [TheGamer (updated Jan 2022)](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/)
- Griffophone (another online party game) has private lobbies with invite codes, lobby chat, avatars, saved albums and PDF/image export, and includes an Exquisite Corpse mode. — [Kotaku game page](https://kotaku.com/games/griffophone)
- Asynchronous precedent: "The Exquisite Branch" passes a link. If it is passed to one person the drawing continues; if passed to several, it branches into multiple versions with a common starting point. — [xpub Exquisite Branch](https://hub.xpub.nl/soupboat/~kamo/projects/xquisite)
- Monsterland Drawing (browser/iPad) is an online exquisite corpse (draw a head, fold, pass) with "over 30000 monsters". — [App Store listing](https://apps.apple.com/app/id6478018259)
- DO SQLite rows-written billing: 50M/month included, then $1/M. Deletes and `setAlarm()` count as writes. — [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- WebSocket tags (≤10 per socket) and `getWebSockets(tag)` allow filtered broadcast, for example to spectators. — [CF DO State API](https://developers.cloudflare.com/durable-objects/api/state/)
- tldraw keeps room state in DO memory and SQLite and snapshots to R2 periodically. — [tldraw sync docs](https://tldraw.dev/docs/sync)
- R2: 10 GB-month free, then $0.015/GB-month. Class A ops 1M free, then $4.50/M. Class B 10M free, then $0.36/M. Free egress. — [CF Workers pricing (R2 table)](https://developers.cloudflare.com/workers/platform/pricing/)

### Inferences
**Room lifecycle and codes**
- SvelteKit `POST /api/rooms` (rate-limited) generates a code of 4–5 characters from an unambiguous alphabet (no 0/O/1/I), e.g. 23^5 ≈ 6.4M combinations. It calls `idFromName("room:"+code)` and `init()` via RPC; if the DO reports the code is busy, it retries with a new code.
- The join URL `/play/ABCDE` doubles as a share link (Gartic) and a typed code (Jackbox).
- A short-lived signed join ticket (HMAC/JWT with `userId | guestId`, nickname, room code, role, and expiry of about 60 s) is minted by SvelteKit from the Better Auth session. The realtime Worker verifies it and checks the `Upgrade` header before touching the DO.

**Guests vs accounts**
- Option A, recommended: allow guest play with only a nickname, using a DO-scoped guest id inside the signed ticket. Create a Better Auth anonymous user only when a guest chooses "save my drawings" or the game ends with publishable artworks. This avoids filling the `user` table with throwaway rows.
- Option B: `signIn.anonymous()` on first visit, with `onLinkAccount` re-attributing artworks when they register. This is simpler attribution but requires a cleanup job for stale anonymous users.
- Either way, interplay with the `username` plugin (anonymous users have no username or nickname) must be tested.

**DO SQLite schema (ephemeral, per room)**
- `room(code, mode, settings_json, phase, round, phase_deadline_ms, host_player_id, seq, created_at)`
- `players(player_id, user_id NULL, is_guest, nickname, seat, role['player'|'spectator'], connected, last_seen, score, kicked)`
- `assignments(round, player_id, chain_id|prompt_id|reference_id, status, submitted_at)`
- `drawings(drawing_id, round, player_id, chain_id, segment_index, doc BLOB, stroke_count, updated_at)`. Upsert one row per player per turn on each autosave, so a whole turn costs N row writes, not one per point batch.
- `votes(round, voter_id, target_id, value)`
- Optional `events(seq, type, payload)` for debugging or replay.

**Phases**
- LOBBY (host picks mode and settings; ready-up) → per round: PROMPT/ASSIGN → DRAW (alarm at deadline, early advance when all submitted) → GUESS/VOTE (mode-dependent) → REVEAL (paced by host or auto) → RESULTS → PERSIST → CLOSED. At deadline, the server auto-submits each player's last autosave (Gartic-like "time's up").

**Disconnections**
- Keep the seat for a grace period (e.g. 60–90 s) and mark `connected=false`. Alarm-driven phases continue regardless.
- On reconnect, the client receives a snapshot: phase, deadline, own assignment, own autosaved drawing, and public scores.
- If the host leaves, promote the next seat.
- In chain modes, a missing player's segment is auto-submitted (possibly blank, revealed as "skipped") or reassigned to a spectator. Gartic's Crowd mode precedent shows not everyone needs to draw every sequence.

**Spectators and audience**
- Accept sockets with tag `spectator`. They receive reveal and vote phases and can vote (Jackbox audience), but never receive secret assignments.

**Persistence boundary**
- Keep everything in DO SQLite during the game.
- At RESULTS, the DO writes final stroke documents to R2 (keys like `games/{gameId}/{drawingId}.json`) and inserts `games`, `game_players`, `artworks` (visibility "unlisted/room" by default), `artwork_contributors` and `game_scores` rows into Postgres. It does this through Hyperdrive in the DO, or by calling an internal SvelteKit/Worker endpoint with an idempotency key = `gameId`.
- Let the alarm drive this step: its retries give at-least-once delivery, so the writes must be idempotent.
- After a grace window (e.g. 1 h for "play again" and results links), clear room storage.
- Keep large stroke docs out of Postgres (Supavisor bind-size issue in project memory).

**Asynchronous play**
- Good fit for exquisite corpse ("pass the link") and draw-from-prompt "daily challenge"; poor fit for voting rounds.
- Async needs no DO per game: a Postgres `chains` table with a short claim lease prevents two people drawing the same next segment. Each finished segment is an artwork whose parent is the previous segment. Branching (several people continuing the same strip) is literally the existing fork lineage. Notifications are the weak point, since the app has no push.

### Gaps
- It is unverified whether Better Auth's anonymous plugin coexists cleanly with the `username` plugin and the app's `nickname` additional field (both are installed, but none of the fetched docs discuss the combination).
- There is no source for exact Gartic/Jackbox reconnection behaviour or grace periods.

---

## 3. Exquisite corpse specifics: showing only the edge strip, canvas layout for N players, combining into one artwork compatible with forking

### Takeaway
Do the "fold" on the server. The DO keeps each full segment and sends the next drawer only the strokes clipped to a thin strip (about 10–15%) at the bottom edge, so nothing leaks to devtools. With N players, run N parallel chains that rotate every round (Gartic-style), so everyone draws every round. Lay each chain out as K horizontal bands of a 768×768 canvas (K=3 or 4). The composite is then a normal 768×768 stroke document that the existing forking and lineage code can handle unchanged, plus a contributors list.

### Cited Findings
- The traditional exquisite corpse has each player draw a part, hide it from the next person, but leave some hints. Digital versions replace the fold with a hidden section and a visible edge. — [xpub Exquisite Corpse generator](https://hub.xpub.nl/soupboat/postit/generate/xquisite)
- SkatterSketch (three-player variant) marks the cutoff with a dotted line showing where your drawing ends and the next player's begins. — [itch.io SkatterSketch](https://smumbo.itch.io/skattersketch)
- Monsterland: head → fold → pass, online, 30,000+ monsters. — [App Store listing](https://apps.apple.com/app/id6478018259)
- Gartic Phone chains rotate until "all players have contributed in drawing or writing to every original phrase", and all chains are revealed sequentially at the end. — [gamerules.com](https://gamerules.com/rules/gartic-phone-the-online-telephone-game/)
- Gartic Phone "Complement": a player draws a few random lines quickly, others add to them, and the lines stay in the final drawing. "Secret" hides your own canvas while drawing. — [TheGamer (updated Jan 2022)](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/)
- Exquisite Branch: link-passing creates branches from a common start. — [xpub Exquisite Branch](https://hub.xpub.nl/soupboat/~kamo/projects/xquisite)
- SQLite row/BLOB limit 2 MB. WebSocket message limit 32 MiB. — [CF DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)

### Inferences
**Strip visibility: server-side**
- On DRAW start for segment s>0, the DO takes the previous segment's strokes and clips each polyline to the strip rectangle (e.g. the bottom 15% of the band) with a standard segment-rectangle clip (Liang–Barsky / Cohen–Sutherland). It translates them into the new band's top margin and sends only those.
- Client-side cropping (sending the full previous segment and masking it) is trivially bypassable and spoils the reveal.
- The cost is negligible: a few thousand points per segment, microseconds of CPU.
- Optionally also send "connection ticks" (x positions where previous strokes cross the boundary) as explicit hints, the digital version of the paper fold hint.

**Layout options**
- (a) **Bands inside 768×768, recommended for v1 compatibility.** K=3 (head/torso/legs) gives three 768×256 bands; K=4 gives 768×192. Each player draws only in their band (canvas shown as a wide strip, ideal in landscape on phones; portrait shows it small). The previous strip is rendered read-only and faded above. The composite is the union of the bands' strokes in one 768×768 doc, the same format as today.
- (b) **Full-canvas segments stacked into a tall artwork** (768 × 768·K). Each player gets a full square canvas (better on portrait phones), but the document format needs `width/height` (or a `viewBox`). The gallery, forking and thumbnails must then handle non-square art. Consider this for the remaster if the stroke doc gains explicit dimensions.
- (c) Scaling full-square segments into bands at composite time distorts drawings. Avoid.

**Assignment for 4–8 players (rotation / Latin-square)**
- Each of the N players starts chain c. In round s, chain c's segment s is drawn by player (c+s) mod N. Nobody draws twice in a chain, and everyone draws every round. With K=4 segments, the game is 4 drawing rounds.
- Example: 8 players × 4 rounds × ~90 s plus reveal ≈ 8–10 min, matching the 10-minute target.
- If N < K, allow wrap-around (players draw twice, non-adjacent) or reduce K.

**Reveal**
- "Unfold" each chain band by band. The remaster's per-point timing allows animated stroke replay. Finish with a vote for favourite creature.

**Persistence and lineage**
- Save each chain's composite as one artwork (flattened strokes; optionally keep `segment`/`authorId` per stroke as metadata) plus `artwork_contributors(artwork_id, user_id|guest_name, segment_index)`.
- Forking the composite works with existing fork code.
- Async/branching corpses can additionally store each segment as an artwork whose parent is the previous segment, so branches appear as fork lineage. The current lineage model assumes a single author, so a contributors table is needed either way.

### Gaps
- No public postmortem was found describing how Gartic Phone, Monsterland or Griffophone implement strip cropping or chain assignment. The rotation and server-side clipping design above is inferred.
- No usability data was found on best strip height or band aspect ratios on phones.

---

## 4. Replicate-a-drawing scoring: approaches, quality and cost, robustness, anti-cheat, where to compute

### Takeaway
Score with a cheap deterministic geometric metric that is tolerant to small offsets:
1. Rasterise or resample both stroke docs at about 256 px.
2. Optionally normalise translation and scale for memory mode.
3. Compute distance transforms and a precision/recall F-score of ink within a tolerance τ (a "Chamfer F-score"), averaged over a few τ values.

Run the same TypeScript module on the client for instant feedback and in the DO for the authoritative score. It costs essentially nothing. Learned embeddings (CLIP/DINOv2) are not in the Workers AI catalog and measure semantics more than fidelity. Vision LLM judges are unreliable for absolute scores and best used for fun commentary. The best anti-cheat is game design: show the reference briefly and then hide it (Gartic "Knock-Off"/"Sandwich"), and never send it during the draw phase.

### Cited Findings
- Gartic Phone "Knock-Off": every turn is a drawing, and once you start "you cannot go back to view the last rendition", so you draw from memory. The time limit shrinks each round. "Sandwich": players see the previous image only briefly before drawing it. "Solo": players faintly see their previous frame to trace over (onion skin). — [TheGamer (updated Jan 2022)](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/)
- Comparing line drawings, Neural Contours reports IoU, F1 and symmetric Chamfer distance together, and IoU and Chamfer do not always rank methods the same way. Chamfer averages nearest-neighbour distances in both directions and is outlier-sensitive, which is why some work uses an F-score instead. IoU misses fine detail. — [Neural Contours, arXiv 2003.10333](https://arxiv.org/pdf/2003.10333); [Deep Sketch-Based Modeling, arXiv 2011.06133](https://arxiv.org/pdf/2011.06133)
- A practitioner anecdote (Reddit) on scoring VR drawings against targets: Chamfer gives a rough similarity but cannot tell overlapping from non-overlapping shapes. Anecdotal. — [Reddit snapshot](https://reddit.sentinel-team.org/posts/1nnptrv/snapshots/2026-02-21T04%3A42%3A47.999876Z)
- A distance transform gives each pixel its distance to the nearest feature pixel. Tolerance-based feature transforms keep all boundary points within a user-set tolerance. — [The Distance Transform and its Computation, arXiv 2106.03503](https://arxiv.org/pdf/2106.03503); [TU/e tolerance-based feature transforms](https://research.tue.nl/en/publications/tolerance-based-feature-transforms/)
- Quick, Draw! "simplified" preprocessing: align to top-left, scale uniformly to max 255, resample strokes at 1-px spacing, RDP-simplify with ε=2.0, and drop timing. The result is a 256×256 region. The 28×28 bitmaps are centred on each drawing's bounding box. — [googlecreativelab/quickdraw-dataset](https://github.com/googlecreativelab/quickdraw-dataset)
- The Workers AI catalog (fetched 2026-10-23) lists no image-embedding model (no CLIP/SigLIP/jina-clip/DINOv2). Image-input models are vision LLMs (`llama-3.2-11b-vision-instruct`, `llama-4-scout-17b-16e-instruct`, `mistral-small-3.1-24b-instruct`, `gemma-3-12b-it` on the pricing page, `llava-1.5-7b-hf`, `moondream3.1-9B-A2B`, plus newer entries such as `qwen3.8-27b`, `kimi-k2.6` and `deepseek-v4.1-flash-1017`) and `resnet-50` classification. — [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)
- Workers AI prices: $0.011 per 1,000 neurons; 10,000 free neurons/day. Per M input/output tokens: llama-3.2-11b-vision $0.049/$0.676; llama-4-scout $0.270/$0.850; gemma-3-12b $0.345/$0.556; mistral-small-3.1 $0.351/$0.555; moondream3.1 $0.300/$1.000. resnet-50: $2.51 per M images. No separate image-input price is listed. — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- Llama 4 Scout on Workers AI: 131k context; supports `guided_json` (JSON-schema-constrained output) and function calling. The page does not document image tokenisation or size limits. — [Workers AI llama-4-scout](https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/)
- VLM-as-judge reliability:
  - GPT-4V "struggles to capture small differences between two similar images" and may be unsuitable as a strict discriminator. — [Early evaluation of GPT-4V, arXiv 2310.16534](https://arxiv.org/pdf/2310.16534)
  - The MLLM-as-a-Judge benchmark finds strong alignment with humans in pairwise comparisons but significant divergence in scoring and ranking, with biases and hallucinations. — [arXiv 2402.04788](https://alphaxiv.org/overview/2402.04788v3)
  - SketchVLM using Gemini-3-Flash as judge: human–VLM agreement κ=0.51 vs human–human κ=0.84. — [SketchVLM, arXiv 2604.22875](https://arxiv.org/pdf/2604.22875)
- Learned perceptual metrics: DreamSim fine-tunes CLIP/OpenCLIP/DINO (newer checkpoints DINOv2 B/14) on ~20k human triplet judgments of diffusion-generated images, not sketches. Prior work shows DINO induces a good zero-shot perceptual metric. — [DreamSim (PyPI)](https://pypi.org/project/dreamsim); [arXiv 2502.11725](https://arxiv.org/pdf/2502.11725)
- CLIP adapted with prompt learning does zero-shot sketch-to-photo retrieval (category-level and fine-grained). This is retrieval, not human similarity scoring. — [Sain et al., CVPR 2023](https://openaccess.thecvf.com/content/CVPR2023/html/Sain_CLIP_for_All_Things_Zero-Shot_Sketch-Based_Image_Retrieval_Fine-Grained_or_CVPR_2023_paper.html)
- DO CPU budget: 30 s per message by default. Workers CPU: 30M CPU-ms included per month. — [CF DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/); [CF Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### Inferences
**Recommended metric ("tolerant Chamfer F-score")**
1. Resample both documents' strokes at about 1-unit spacing in a 256-unit space, mirroring the QuickDraw simplification.
2. In "copy in place" mode, keep absolute positions. In "from memory" mode, first normalise both to bounding-box centre plus uniform scale, so position and size errors count less than shape errors.
3. Rasterise reference and player ink (thick-line Bresenham into a `Uint8Array`) and compute Euclidean distance transforms (linear-time; 65k pixels at 256² takes a few ms in JS).
4. Precision = share of player samples within τ of reference ink; recall = share of reference samples within τ of player ink; F = 2PR/(P+R). Average F over τ ∈ {2%, 4%, 8%} of the canvas for a smooth score that tolerates small offsets.
5. Optionally multiply by a colour-match factor and report mean Chamfer distance as a tie-breaker.
6. Show a per-sample "hot/cold" overlay in the reveal; it is fun and explains the score.

This combines a distance measure with an overlap measure, which addresses the cited failure modes of Chamfer alone (outliers, overlap ambiguity) and IoU alone (fine detail).

**Alternatives and why they are secondary**
- **IoU/Dice after blur or dilation.** Simple and robust to small offsets if the blur is large enough, but stroke-width dependent; thick versus thin lines are penalised. Acceptable as a v0.
- **Hausdorff.** The max distance, so a single stray stroke dominates. Unsuitable as a primary score.
- **SSIM.** Designed for natural-image luminance and structure. Sparse line art with small offsets collapses the score unless heavily blurred. Not recommended. (No source found; inference.)
- **Stroke DTW.** Penalises drawing order and direction, which humans don't care about when copying. Useful only for a "trace the animation/replay" mode that uses the remaster's timing data.
- **Learned embeddings** (CLIP/DINOv2, DreamSim). They measure "same thing / similar look" (semantic) better than geometric fidelity, and there is no Workers AI endpoint for them. They would need external hosting or in-browser Transformers.js (an option only for fun or semantic scoring, not authoritative). They fit "draw from prompt" better than "replicate".
- **Vision LLM judge.** A few hundredths of a cent per call (see §8). Unreliable absolute scores, though pairwise ("which of these two is closer?") is better. Use for an optional "AI critic" line in the reveal, not for points.

**Anti-cheat**
- Primary: mode design. Memory mode shows the reference for 5–10 s, then hides it and never sends it during DRAW. Side-by-side mode (tablet) shows the reference beside the canvas, never under it, and offers no onion skin.
- Always compute the authoritative score in the DO from the submitted stroke doc. The client score is only a preview.
- A phone user can still photograph the reference with another device. Accept this in friends' rooms, and optionally flag implausibly high scores (e.g. F > 0.97 at the smallest τ) or implausible timing (the remaster's per-point timing can show near-constant velocity).
- Use QuickDraw (CC BY 4.0, attribution required) or the app's own gallery as a reference pool. QuickDraw notes it "may still contain inappropriate content", so pre-filter.

**Where to compute**
- Use a shared pure-TypeScript module in `packages/` and run it in both browser and DO. Workers have no Canvas API, so use a hand-written rasteriser.
- Example load: 18,000 scored drawings/day × ~10–20 ms ≈ 5–11M CPU-ms/month, within the 30M included.

### Gaps
- No study was found that validates zero-shot CLIP/DINOv2 or Chamfer/IoU against human similarity judgments specifically for free-hand copies of sketches. The τ values above are heuristics to be tuned with playtests.
- No published scoring formula from a commercial "copy the drawing" game was found. Gartic's "Score" mode criteria are described as unclear by the source.
- Workers AI image token accounting for vision models is undocumented on the fetched pages, so per-call costs in §8 rely on an assumption.

---

## 5. Draw-from-prompt: curated vs LLM-generated prompts, community vote vs AI judging, safety

### Takeaway
Ship curated, bilingual (es/en) prompt packs stored in Postgres, offering a choice of 1 of 3 per player (skribbl-style). Grow the packs offline with an inexpensive Workers AI text model plus a human review queue, rather than generating prompts live. Judge by community vote (Drawful-style, optionally with bluff titles). Add an optional "AI guesses your drawing" reveal moment:
- an in-browser QuickDraw-trained classifier for the ~300 QuickDraw categories;
- a Workers AI vision LLM for open-ended prompts, used for laughs, not authority.

### Cited Findings
- Skribbl.io: each turn one player picks 1 of 3 words and draws, others guess, earlier guessers score more, and roles rotate. Default draw time is reported as 80 s and default 3 rounds, configurable in private rooms. Secondary sources conflict on ranges (draw time 15–240 s or 30–180 s; rooms 2–8, 2–20 or 3–12 players). — [mechanicsofmagic.com 2021 critical play](https://mechanicsofmagic.com/2021/04/20/critical-play-bluffing-judging-and-getting-vulnerable-with-skribbl-io/); [mytour skribbl guide](https://mytour.vn/en/blog/kinh-nghiem-hay/how-to-create-a-private-room-in-skribblio-mytour.html)
- Drawful: 3–8 players. Each gets a "playful phrase" to draw on their own device under a short time limit. Others write decoy titles, everyone votes for the real one, and the artist scores when guessed while decoy writers score per vote. Drawful 2 added a second colour, new prompts, user-created prompts, and (May 2021 update) more languages plus content moderation settings. — [Wikipedia: Drawful](https://en.wikipedia.org/wiki/Drawful)
- Gartic Phone "Ice Breaker": players write prompts with questions, everyone draws the same prompt, and all drawings are shown at the end for discussion. — [TheGamer (updated Jan 2022)](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/)
- Quick, Draw!: the game asks the player to draw a prescribed object and a neural network guesses it. The dataset has ~50M drawings across 345 categories with a `recognized` flag ("whether the word was recognized by the game") and is licensed CC BY 4.0. — [quickdraw-dataset](https://github.com/googlecreativelab/quickdraw-dataset); [dev.to write-up (secondary)](https://dev.to/larswaechter/recognizing-hand-drawn-doodles-using-deep-learning-ki0)
- Doodle Dash (Hugging Face, July 2023): `Xenova/quickdraw-mobilevit-small` (fine-tuned MobileViT-small, 5.6M params, ~20 MB). Over 300 categories after removing ambiguous ones, running in a Web Worker in the browser at "over 60 predictions a second". The game gives 60 s to draw as many prompts as possible, with continuous prediction, a 3 s penalty per skip, and dampened scores for the first n wrong labels. — [HF blog ml-web-games](https://huggingface.co/blog/ml-web-games)
- doodleNet: a 345-class QuickDraw classifier ported to TF.js (JSON + weights). A 342-class ONNX model in another project is 300 MB, which is server-only. — [doodleNet](https://github.com/yining1023/doodleNet); [doodlecritic](https://github.com/jtiscione/doodlecritic)
- Workers AI text models for prompt generation (per M input/output tokens): gpt-oss-20b $0.200/$0.300; llama-3.1-8b-instruct $0.282/$0.827; gpt-oss-120b $0.350/$0.750; llama-3.3-70b-fp8-fast $0.293/$2.253. Llama Guard 3 8B: $0.484/$0.030. The catalog also lists llama-3.2-1b/3b-instruct as small models. — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/); [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)
- VLM judges: fine for pairwise, unreliable for absolute scoring (see §4). — [arXiv 2402.04788](https://alphaxiv.org/overview/2402.04788v3); [SketchVLM arXiv 2604.22875](https://arxiv.org/pdf/2604.22875)
- Edwards et al. propose a statistical framework to test whether VLM judges agree with human experts on drawing-quality and creativity ratings. — [AI Judges in Design, arXiv 2504.00938](https://papers.cool/arxiv/2504.00938)

### Inferences
**Prompt pipeline**
- Store prompts in a Postgres `prompts` table (locale, text, difficulty, tags/theme, source[`curated`|`llm`|`community`], status[`pending`|`approved`|`rejected`]).
- Generate batches offline (cron or admin action) with gpt-oss-20b or llama-3.1-8b. Example: 10,000 prompts × ~30 output tokens ≈ 300k tokens, under $1 one-off. Screen them with Llama Guard and approve by hand.
- At game start, the DO pulls a random approved set for the room's locale and theme; no LLM call is in the hot path.
- Brand-flavoured themes ("Not The Louvre": "a famous painting, but as a cat") are a natural differentiator.

**Player-authored prompts** (Gartic telephone start, Drawful 2 custom prompts)
- Allow them only in private rooms, with a word filter. Optionally run Llama Guard on them, at the cost noted in §8.

**Judging**
- (1) Community vote on anonymous drawings: no AI cost, proven fun.
- (2) Drawful bluff variant: everyone writes a fake title for each drawing, and votes on which title is real.
- (3) "AI guess" reveal: Doodle Dash-style in-browser classifier when the prompt is a QuickDraw category (free, offline, ~20 MB download, so lazy-load it only for this mode). For open prompts, ask a Workers AI vision LLM "what is this drawing?" with `guided_json` and award a bonus if its guess fuzzy-matches the prompt.

AI never decides the winner alone, given the cited judge-reliability findings.

**Safety**
- Curated and approved prompts carry no runtime risk.
- Outputs (drawings) stay private to the room by default. Publishing to the public gallery reuses the existing creator/moderator NSFW labels, plus an optional VLM screen (§7).

### Gaps
- Licensing of the `Xenova/quickdraw-mobilevit-small` weights and its exact class list were not verified on its model card.
- No data was found comparing player enjoyment of LLM-generated versus curated prompts.
- Image token cost per vision-LLM call on Workers AI was not found.

---

## 6. How existing drawing party games structure rooms and rounds (Gartic Phone, Skribbl.io, Drawful, Quick, Draw!, Pictionary-style), and what makes them fun on mobile

### Takeaway
Successful games share six traits:
- They join via short room codes or links in the browser, with no install.
- Rooms are small (3–8 core players; 8–30 with crowd or audience modes).
- Turns are short and timed (about 60–90 s draws), with everyone acting simultaneously where possible (Gartic chains, Drawful simultaneous drawing) rather than waiting.
- Constraints make the drawing absurd and level the field: few colours, memory, shrinking timers, blind drawing.
- The payoff is a big sequential reveal followed by voting.
- Where AI appears, it is a guesser or partner (Quick, Draw!), not a referee.

### Cited Findings
- **Gartic Phone.**
  - Telephone chain alternating write→draw→guess until each player has contributed to every chain, then a sequential reveal. Sources disagree on max players (up to 30 vs older "up to 14").
  - There are 12–13 presets, including Knock-Off (copy from memory, shrinking timer), Secret (blind drawing), Complement (complete others' random lines), Sandwich (brief view, then copy), Speedrun, Crowd (≤30 players, fewer turns, not all participate), Ice Breaker, and Solo animation with onion skin. The Movie and No Rush modes were replaced by Background and Complement.
  - Source date: TheGamer last updated January 2022, so modes may have changed.
  - — [gamerules.com](https://gamerules.com/rules/gartic-phone-the-online-telephone-game/); [TheGamer](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/); [MobyGames](https://mobygames.com/game/gartic-phone)
- **Skribbl.io.** One drawer per turn chooses 1 of 3 words, others guess in chat, faster guesses score more, and roles rotate. Reported default 80 s draw and 3 rounds. Room size reports conflict (2–8 / 2–20 / 3–12), and sources are secondary student analyses, not official. — [mechanicsofmagic.com](https://mechanicsofmagic.com/2021/04/20/critical-play-bluffing-judging-and-getting-vulnerable-with-skribbl-io/)
- **Drawful (Jackbox).** 3–8 players drawing simultaneously on their own devices with a short time limit. Then decoy titles, a vote, and scoring. Audience members beyond active players can affect scoring. Join by room code on a website with no app. The original had a single colour; Drawful 2 added a second colour and user prompts. Jackbox has a family-friendly mode that censors player input, and host censoring. — [Wikipedia: Drawful](https://en.wikipedia.org/wiki/Drawful)
- **Quick, Draw!** The game prompts an object and a neural net guesses it as you draw. Its ~50M drawings (345 categories) were captured as timestamped vectors with a `recognized` flag. The dataset trained Sketch-RNN, a generative recurrent model of sketches. — [quickdraw-dataset](https://github.com/googlecreativelab/quickdraw-dataset); [Sketch-RNN, arXiv 1704.03477](https://arxiv.org/pdf/1704.03477)
- **Doodle Dash** (Quick, Draw! successor demo): 60 s rapid-fire prompts with real-time in-browser recognition. — [HF blog](https://huggingface.co/blog/ml-web-games)
- **tldraw** (collaborative canvas, not a game): one DO per room, about 30 simultaneous collaborators per room. — [tldraw sync docs](https://tldraw.dev/docs/sync)

### Inferences
**Recommended structure for Not The Louvre (target 4–8 players, ~10 min)**
- **Exquisite corpse.** N parallel chains, K=3–4 band segments, ~75–90 s per segment, then reveal and vote. 8 players at K=4 is about 4 rounds × 90 s plus about 3 min of reveal.
- **Replicate.** 3 rounds. Each round shows a reference for 5–10 s (memory) or side by side (tablet), then a 45–60 s draw, an instant score, and a reveal with an overlay heatmap. Cumulative scores.
- **Draw from prompt.** 3 rounds. Choose 1 of 3 prompts, draw 60–80 s, then an anonymous gallery vote. Optional "AI guess" bonus and Drawful bluff variant.
- **Easy follow-on modes:**
  - telephone (draw ↔ describe), reusing the corpse chain engine;
  - a skribbl-style guessing mode, the only one that needs live stroke streaming;
  - "finish the line" (Complement), seeded with random strokes.

**Mobile considerations**
- Use a limited palette per round (Drawful started with one colour).
- Use landscape bands for the corpse, big touch targets, and autosave on every stroke so a locked phone doesn't lose work.
- Offer a "done early" button that advances when all are done.
- The host's screen (TV or laptop) can act as the shared reveal screen (Jackbox model), but each phone also shows the reveal for remote play.

### Gaps
- No first-party technical postmortems (stack, servers, scaling) were found for Gartic Phone, Skribbl.io or Drawful. Room limits come from secondary sources and conflict.
- The commonly cited "20 seconds per drawing" in Quick, Draw! did not appear in the sources fetched; unverified.

---

## 7. Moderation and abuse in live rooms (NSFW drawings, chat), rate limits

### Takeaway
Keep live rooms private by code, and give hosts kick and censor powers (the Jackbox model). Prefer preset reactions over free chat. Validate and rate-limit every message inside the DO. Use the Workers Rate Limiting binding for room creation and joins. Moderate drawings only when they leave the room (published to the gallery), using the app's existing creator/moderator NSFW labels plus an optional vision-LLM screen. Workers AI has no NSFW image classifier, and Llama Guard 3 on Workers AI is text-only.

### Cited Findings
- Workers Rate Limiting binding: `[[ratelimits]]` with `namespace_id`, `simple.limit`, and `simple.period` of 10 or 60 s. Call `env.X.limit({ key })` and check `success`. Limits are per Cloudflare location, not global, and the key can be IP, user id or route. It was reported GA in September 2025 (the changelog copy seen was on a mirror; verify). — [CF rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- The Workers AI catalog lists only `llama-guard-3-8b` as a safety model; no multimodal Llama Guard 4 and no NSFW image classifier was found. Llama Guard 3 8B costs $0.484/M input and $0.030/M output tokens. — [Workers AI models](https://developers.cloudflare.com/workers-ai/models/); [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- Non-Cloudflare NSFW image classifiers exist, e.g. Falconsai/nsfw_image_detection (a ViT binary classifier, described as fast and lightweight on Replicate) and NVIDIA NeMo Curator's CLIP-embedding NSFW scorer. They would need external hosting. — [Replicate NSFW collection](https://replicate.com/collections/detect-nsfw-content); [NVIDIA NeMo Curator](https://docs.nvidia.com/nemo/curator/0.25.7/curate-images/process-data/classifiers/nsfw.html)
- Jackbox: family-friendly mode censors player input; host can censor players; tools remove offensive terms. Drawful 2 added content moderation settings (2021). — [Wikipedia: Drawful](https://en.wikipedia.org/wiki/Drawful)
- The Quick, Draw! dataset was individually moderated but "may still contain inappropriate content", which shows the scale of the problem with free-drawing input. — [quickdraw-dataset](https://github.com/googlecreativelab/quickdraw-dataset)
- tldraw's template leaves auth, rate limits and upload size limits to the integrator. — [tldraw sync docs](https://tldraw.dev/docs/sync)
- The DO accepts WebSocket messages up to 32 MiB and has a soft limit of 1,000 req/s per object, so app-level limits must be much tighter. — [CF DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/)

### Inferences
**Edge (Worker)**
- Rate-limit `POST /api/rooms` (e.g. 5 per 60 s per user or IP) and join attempts (e.g. 20 per 60 s per IP) to stop room-code brute force.
- Reject non-Upgrade requests and invalid or expired join tickets before the DO.

**Inside the DO, per connection**
- Token bucket in memory with a fallback to `serializeAttachment`, e.g. ≤20 msgs/s and ≤64 KB/s.
- Hard caps: message ≤256 KB, ≤5,000 points per stroke, ≤N strokes per turn, coordinates within the canvas, colours from the palette, and size within allowed range.
- Close with code 1008 on repeated violations. Cap seats (e.g. 8 players + 20 spectators).

**Chat**
- Default to emoji/preset reactions during draw and reveal.
- If free text is allowed (guess mode), use a local word list (es/en) plus per-user rate limit. Llama Guard on every message gets expensive at scale (see §8), so use it only on reported messages or on text that becomes public (titles, prompts).

**Drawings**
- In-room: host "hide this drawing" and kick, and player "report" during the reveal, which blurs the drawing for that viewer and flags it.
- On publish to the gallery: keep the existing `isNsfw` / `nsfwSource` flow (creator self-label, moderator relabel).
- Optionally add a vision-LLM screen (`llama-3.2-11b-vision` or `llama-4-scout` with `guided_json {nsfw:boolean, reason}`) on the rasterised PNG thumbnail for publicly listed artworks only, with flagged items sent to the moderator queue rather than auto-deleted.

**Accounts**
- Guests (anonymous) cannot publish publicly without registering, or their publications go to a slower review queue. This limits the effect of drive-by abuse.

### Gaps
- No Cloudflare-native NSFW image classification product or Workers AI model was found as of Oct 2026.
- No accuracy data was found for Workers AI vision LLMs as NSFW screens on line drawings.
- The Rate Limiting GA changelog was only seen on a mirror domain.

---

## 8. What it costs: 1,000 games/day, 4–8 players (avg 6), 10 minutes each

### Takeaway
The realtime infrastructure (DOs + Workers + R2) for 30,000 games/month costs roughly **$5–$35/month**, most of it the $5 Workers Paid base. The two cost traps are:
- writing every stroke batch to DO SQLite: about $600/month in row writes;
- running AI (vision judging or Llama Guard on every chat line) on every item: about $75–$300/month each.

Deterministic scoring is effectively free.

### Cited Findings (unit prices used)
- DO: $0.15/M requests (1M incl.; incoming WebSocket messages 20:1; outgoing free); $12.50/M GB-s (400k incl.; 128 MB/object; rounded up to the next million); SQLite writes $1.00/M (50M incl.; deletes and `setAlarm` count); reads $0.001/M (25B incl.); storage $0.20/GB-month (5 GB incl.). — [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Workers: $5 base; 10M requests incl. then $0.30/M; WebSocket Upgrade = 1 request; 30M CPU-ms incl. then $0.02/M. — [CF Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- R2: 10 GB-month free then $0.015/GB-month; Class A 1M free then $4.50/M; Class B 10M free then $0.36/M; free egress. — [CF Workers pricing (R2)](https://developers.cloudflare.com/workers/platform/pricing/)
- Workers AI: llama-3.2-11b-vision $0.049/$0.676 per M in/out; llama-4-scout $0.27/$0.85; llama-guard-3-8b $0.484/$0.030; gpt-oss-20b $0.20/$0.30; 10,000 free neurons/day at $0.011 per 1k neurons. — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- Cloudflare's own hibernation example bills duration as messages × handler time (10 ms), giving $20.65/month for 432M messages. — [CF DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

### Inferences (worked estimates; all assumptions explicit)
Volume: 1,000 games/day × 30 = **30,000 games/month**, 6 players, 600 s each, one DO per game.

**A. Secret-drawing modes** (corpse, replicate, prompt): autosave per stroke end plus control messages.
- Messages: ~180 stroke autosaves + ~40 control messages per player per game ≈ 1,320 incoming/game → 66 billable/game → ~2.0M/month. Add connections (~12/game incl. reconnects ≈ 0.36M) and alarms (~15/game ≈ 0.45M) for about 2.8M total; minus 1M included = 1.8M → billed as 2M → **$0.30**.
- Duration, lower bound (CF example method, 10 ms per message): 1,320 × 10 ms = 13.2 s/game → 1.65 GB-s → ~50k GB-s/month → within the included 400k → **$0**.
- Duration, upper bound (object awake the whole 10 min, e.g. setTimeout or no hibernation): 600 s × 0.125 GB = 75 GB-s/game → 2.25M GB-s/month; minus 400k = 1.85M → billed as 2M → **$25.00**.
- SQLite writes: ~1,200 rows/game (upsert one row per autosave, events, alarms, cleanup deletes) → ~36M/month → within 50M included → **$0**.

**B. Live-streamed mode** (everyone's strokes broadcast at 10 frames/s while drawing 60% of the time):
- 6 × 360 s × 10 = 21,600 incoming/game → 1,080 billable → 32.4M/month → billed 32M → **$4.80**.
- Duration at 10 ms per frame: 216 s/game → 27 GB-s → 810k GB-s/month; minus 400k → billed as 1M → **$12.50**. Upper bound $25.
- Outgoing fan-out to 5 peers is free.
- **Trap:** persisting every frame as a SQLite row means 21,600 rows/game → 648M/month → (648 − 50) × $1 ≈ **$598/month**. Keep frames in memory and persist per completed stroke or turn.

**Workers**
- Page and API requests: 30,000 × 6 × ~30 ≈ 5.4M, plus 0.36M Upgrades. Within 10M included → $0.
- CPU for deterministic scoring: 18,000 drawings/day × ~15 ms ≈ 8M CPU-ms/month. Within 30M included → $0.

**R2**
- ~10 final artworks/game → 300k objects/month. Write ops (plus thumbnails, ~600k) fall within 1M free Class A.
- At ~20–100 KB per stroke doc that is ~6–30 GB/month of new storage. After the 10 GB free tier, this adds roughly $0.10–$0.45 per month of accumulated data.

**Workers AI (optional features)**
- Assumption, not documented: a vision call uses ~1,500 input tokens (image + instructions) and ~100 output tokens. That gives ~$0.00014/call on llama-3.2-11b-vision and ~$0.00049/call on llama-4-scout.
- AI-judge every drawing (1,000 games × 6 × 3 rounds = 18,000/day = 540k/month): **~$76/month (11B vision) to ~$265/month (Scout)**. AI-guessing only each round's winner (1/6 of that): ~$13–$44/month.
- Vision NSFW screen of publicly published artworks only (e.g. 90k/month): ~$13–$44/month.
- Llama Guard on all chat (assume 50 messages/game × ~400 tokens incl. policy template = 600M tokens/month): **~$290/month**. On reported or public text only: a few dollars.
- Prompt generation offline: under $1 one-off. The 10,000 free neurons/day (~$0.11/day) cover small experiments.

**Total**
- Realtime core (A-style modes): about **$5.30–$31/month**. With a live-streamed guessing mode: add $5–$30.
- With opt-in, targeted AI (winner-only guess plus public-only NSFW screen): roughly **$30–$120/month**.
- Avoid per-message Llama Guard and per-drawing Scout judging unless budget allows.

### Gaps
- Workers AI vision image-token accounting is the main uncertainty in the AI line items. Measure with a test call: the response usage field reports tokens.
- It is unconfirmed whether the DO stays billed between messages when using hibernation (the CF example suggests not). Validate with the dashboard's DO duration metrics in a load test.
- Hyperdrive pricing and the Postgres provider's costs for the end-of-game writes (~5 queries/game) were not researched; they are assumed negligible at 30k games/month.
