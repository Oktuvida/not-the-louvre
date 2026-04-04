# Not The Louvre — Product Requirements Document

> A community-driven art party game where anyone can paint, publish, fork, and
> vote on artwork — all from the browser.

**Version**: 0.2.0 (MVP)
**Last Updated**: 2026-03-30

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Personas](#3-user-personas)
4. [Core User Flows](#4-core-user-flows)
5. [Feature Specification](#5-feature-specification)
6. [Technical Architecture](#6-technical-architecture)
7. [Data Model](#7-data-model)
8. [Content Moderation](#8-content-moderation)
9. [Animation & Polish](#9-animation--polish)
10. [Art Direction](#10-art-direction)
11. [Delivery Constraints](#11-delivery-constraints)
12. [Milestones & Phases](#12-milestones--phases)
13. [Open Questions](#13-open-questions)

---

## 1. Overview

**Not The Louvre** is a web-based party game where users create minimalist
artwork on a canvas, publish it to a shared feed, and let the community react
with upvotes/downvotes and comments. Artworks can be forked — creating a visible
lineage chain — and every piece displays the creator's hand-drawn avatar.

The experience is rendered through **Threlte** (Three.js for Svelte), giving the
entire UI a polished 2.5D feel with shaders, particle effects, and fluid
transitions — while the actual painting interaction remains 2D.

**Inspiration**: Passpartout.

### Core Loop

```
Create Avatar → Paint Artwork → Publish to Feed → Community Votes & Comments
                     ↑                                      |
                     └──── Fork someone else's artwork ──────┘
```

---

## 2. Goals & Non-Goals

### Goals

- **G1**: Frictionless creative experience — from open browser to published
  artwork in under 2 minutes.
- **G2**: Visually polished. Animations, transitions, and micro-interactions
  should feel like part of the game, not decorations on a website.
- **G3**: Community-driven curation through voting and forking.
- **G4**: Safe enough. Content moderation that isn't oppressive but catches the
  obvious stuff.
- **G5**: Self-hostable from day one. No vendor lock-in on critical infra.
- **G6**: Reproducible delivery. Local setup, schema state, and validation must
  be automated and consistent across developers and CI.

### Non-Goals

- Not a professional art tool. Constraints are intentional.
- Not a multiplayer real-time drawing session (no shared canvas).
- No monetization, ads, or premium tiers.
- No mobile app (PWA is not a goal for MVP either).
- No algorithmic feed — sorting is explicit and user-controlled.

---

## 3. User Personas

### The Doodler

Casual user. Opens the app, draws something silly in 30 seconds, publishes it,
scrolls the feed, votes on things, leaves. Comes back when bored.

### The Forker

Finds an interesting piece, forks it, adds their twist. Enjoys the creative
chain. Tracks how their forks perform vs the original.

### The Lurker

Browses the feed, votes, comments, never paints. Still valuable — they're the
audience.

### The Moderator

Trusted user with additional permissions. Reviews flagged content, can hide or
remove artworks and comments.

---

## 4. Core User Flows

### 4.1 Onboarding (First Visit)

```
Landing Page → "Pick a nickname" → Set password → Receive recovery key
→ Create avatar (template + draw) → Done → Redirected to feed
```

- Nickname must be unique (validated in real-time as user types).
- Password: minimum 8 characters. No complexity rules.
- Recovery key: single UUID-v4 displayed once. User must copy/save it. Show a
  confirmation dialog: _"Did you save your recovery key? You cannot recover your
  account without it."_
- Avatar creation is mandatory before first publish but can be skipped during
  sign-up and prompted later.

### 4.2 Painting

```
Feed → "New Artwork" button → Canvas opens (fullscreen-ish)
→ Draw with tools → Preview → Publish (with optional title)
→ Artwork appears in feed
```

### 4.3 Forking

```
Viewing an artwork → "Fork" button → Canvas opens with a full editable
snapshot of the parent's drawing document → Draw → Publish as fork
→ Fork appears in feed with "forked from @user" attribution
```

### 4.4 Browsing & Voting

```
Feed (tabs: Recent / Hot / Top) → Scroll artworks → Upvote / Downvote
→ See score update in real-time → Click artwork for detail view
→ See avatar, comments, fork info → Comment / Fork / Share
```

### 4.5 Account Recovery

```
Login page → "Forgot password?" → Enter nickname + recovery key
→ Set new password → New recovery key generated & displayed
```

---

## 5. Feature Specification

### 5.1 Authentication

| Aspect           | Detail                                                      |
| ---------------- | ----------------------------------------------------------- |
| Identity         | Unique nickname (3-20 chars, alphanumeric + underscores)    |
| Credential       | Password (min 8 chars, hashed with bcrypt/argon2)           |
| Recovery         | Single recovery key (UUID-v4), generated at signup          |
| Session          | Better Auth session in secure httpOnly cookie               |
| Recovery flow    | Nickname + recovery key → set new password + new key        |
| Rate limiting    | Max 5 failed login attempts per 15 min per IP               |

Implementation note: build authentication on **Better Auth** and extend it for
nickname-first identity plus recovery-key flows, rather than maintaining a
fully custom session system.

### 5.2 Avatar System

- **Template**: A circular frame with a faint face silhouette (head outline,
  eye placement dots, mouth line) as a guide. The template is purely visual and
  not part of the final avatar.
- **Tools**: Same minimalist toolset as the main canvas (see 5.3).
- **Editable source**: The avatar editor uses a product-owned JSON drawing
  document as the only editable source of truth.
- **Client draft**: The browser may store a local draft copy of the current
  avatar document so refreshes do not discard in-progress work before
  confirmation.
- **Confirmation payload**: On save, the client submits the avatar drawing
  document rather than a raster image.
- **Ingress validation**: The backend validates the submitted drawing document
  against the avatar schema, aggregate limits, and canonical avatar dimensions
  before persisting it or rendering derived media.
- **Canonical output**: After validation, the backend persists the compressed
  avatar drawing document and renders a canonical 256x256 AVIF derivative,
  capped at roughly 100KB per image, storing that AVIF in Supabase Storage
  behind a cache layer.
- **Delivery format**: Avatar reads from backend to frontend remain AVIF.
- **Display**: Shown next to every artwork, comment, and in the feed.
- **Edit**: Users can re-draw their avatar at any time from settings.
- **Moderation**: Avatars are not self-labeled by users as NSFW. Moderators can
  mark an avatar as NSFW, hide it from public surfaces, require replacement,
  or escalate to profile bans for abusive cases.

### 5.3 Canvas / Drawing Engine

The canvas is a 2D drawing surface rendered as a texture on a 3D plane in
Threlte. The user interacts in 2D; Threlte provides the surrounding scene
(easel, ambient particles, lighting).

#### Tools

| Tool       | Behavior                                               |
| ---------- | ------------------------------------------------------ |
| Brush      | Single round brush. Variable size (3 presets: S/M/L).  |
| Eraser     | Same as brush but erases to transparent.               |
| Color      | Palette of 12-16 curated colors + a free color picker. |
| Undo/Redo  | Stack-based. Min 30 steps.                             |

No fill tool, no shapes, no text, no layers. The constraint is the game.

#### Canvas Specs

| Property         | Value                                           |
| ---------------- | ----------------------------------------------- |
| Resolution       | 768x768 canonical artwork size                  |
| Editable source  | Product-owned versioned JSON drawing document   |
| Persistence form | `DrawingDocumentV2` JSON compressed with gzip   |
| Derived media    | Canonical AVIF rendered from the drawing source |
| Source limits    | Schema + aggregate limits enforced in backend   |

#### Drawing document format

- The canonical editable format is `DrawingDocumentV2`.
- `DrawingDocumentV2` stores ordered strokes in two arrays: `base` and `tail`.
- Render order is deterministic: draw the background, replay `base` in order,
  then replay `tail` in order.
- `tail` represents newly appended work since the last rewrite; compaction or
  canonical rewrites fold the retained result back into `base` and clear
  `tail`.
- The system must read legacy V1 documents for compatibility, but all new
  canonical writes and rewrites emit V2.

#### Drawing Experience

- Brush follows cursor/touch with slight smoothing (catmull-rom interpolation)
  for a hand-drawn feel.
- The surrounding 3D scene reacts subtly while drawing (see Section 9).
- Canvas sits on a virtual easel/surface within the Threlte scene.
- The client may keep a local draft of the current drawing document until the
  user confirms publish.

### 5.4 Artwork Publishing

- **Title**: Optional, max 100 chars. Defaults to "Untitled" with a random
  suffix (e.g., "Untitled #4827").
- **Preview**: Before publishing, show a preview of how it will look in the
  feed (with frame, avatar, title).
- **NSFW category**: The creator can explicitly mark an artwork as NSFW during
  publish or later from artwork management. NSFW artworks render blurred by
  default in feeds and detail views until the viewer confirms they are 18+ and
  wants to reveal the piece.
- **Editable source**: New artworks and forks are edited as product-owned JSON
  drawing documents. Raster media is never the editable source.
- **Client draft**: The browser may store a local draft copy of an artwork
  document before publish so reloads do not discard in-progress work.
- **Confirmation payload**: On publish, the client submits the drawing document
  plus metadata rather than a compressed raster image.
- **Ingress validation**: The backend validates the submitted artwork document
  against the artwork schema, aggregate limits, and canonical artwork
  dimensions before persisting it or rendering derived media.
- **Publish**: The application server persists the compressed drawing document,
  renders a canonical AVIF derivative from that source, tries progressively
  lower AVIF quality levels with 4:2:0 chroma subsampling to stay within the
  roughly 100KB stored-image budget, and rejects the publish only if the
  sanitized result still exceeds that budget. The canonical AVIF is then
  uploaded to object storage and the DB record is created in the same confirm
  flow.
- **Delivery format**: Artwork reads from the backend remain AVIF.
- **Edit**: Title can be edited post-publish. Artwork image cannot be changed
  (fork instead).
- **Delete**: Author can delete their own artwork. Forks remain but show
  "original deleted" in attribution.
- **Rate limit**: Max 20 publishes per hour per user (prevent storage abuse).

### 5.4.1 NSFW Reveal Experience

- NSFW artworks remain publishable when labeled honestly by the creator.
- Artwork cards and detail views show blurred media plus a clear adult-content
  indicator.
- Revealing NSFW content requires an explicit +18 confirmation flow with
  consent capture appropriate for GDPR-facing age-gate expectations.
- The reveal interaction should be reversible, and the product should retain a
  minimal auditable record that the viewer acknowledged the adult-content gate.
- Unlabeled adult content remains a moderation violation.

### 5.5 Fork System

- **Fork action**: Creates a new artwork document by copying the full parent
  drawing document into an independent editable snapshot. The child then
  diverges from that snapshot.
- **Attribution**: Every fork displays "forked from @username" linking to the
  parent artwork.
- **Navigation**: From any artwork, you can see:
  - Its immediate parent (1 level up)
  - Its direct forks (1 level down), displayed as a horizontal scroll
  - Clicking parent/fork navigates to that artwork (jump between forks)
- **Deleted parents**: If the parent is deleted, attribution shows
  "forked from [deleted]" — the fork remains intact.
- **Metadata**: Each artwork stores `parent_id` (nullable). The tree is
  inferred from these relationships, but a fork never depends on the parent
  document for reconstruction.

### 5.6 Voting

- **Type**: Upvote / Downvote, one vote per user per artwork.
- **Change**: Users can change or remove their vote at any time.
- **Score**: Displayed as `score = upvotes - downvotes` (Reddit-style).
- **Real-time**: Vote count updates live via Supabase Realtime (Postgres
  changes broadcast). No page reload needed.
- **Own artwork**: Users can vote on their own artwork (no restriction).
- **Rate limit**: Max 60 votes per minute per user (prevent bot spam).

### 5.7 Comments

- **Text only**: Max 500 characters per comment.
- **Flat structure**: No threading/replies. Simple chronological list.
- **Display**: Show commenter avatar + nickname + timestamp + text.
- **Delete**: Authors can delete their own comments. Moderators can delete any.
- **Real-time**: New comments appear live for users viewing the same artwork.
- **Rate limit**: Max 10 comments per minute per user.

### 5.8 Feed

Three tabs, each showing a paginated grid of artwork cards:

| Tab      | Sort Logic                                                        |
| -------- | ----------------------------------------------------------------- |
| Recent   | `created_at DESC`                                                 |
| Hot      | Score weighted by recency. `score / (hours_since_publish + 2)^G`  |
|          | where G = gravity factor (start with 1.5, tune later).            |
| Top      | Sub-tabs: Today / This Week / All Time. Pure `score DESC`.        |

#### Artwork Card (Feed Item)

```
┌──────────────────────────────────┐
│           [Artwork Image]        │
│                                  │
├──────────────────────────────────┤
│  (avatar) @nickname              │
│  "Title of the artwork"          │
│  ▲ 42 ▼    💬 7    🔀 3          │
│  (score)  (comments) (forks)     │
└──────────────────────────────────┘
```

- Infinite scroll with intersection observer.
- Cards animate in with a stagger effect (see Section 9).

### 5.9 Artwork Detail View

Full-screen view of a single artwork:

- Large artwork image (centered, with decorative frame).
- Author avatar + nickname.
- Score with live-updating vote buttons.
- Fork attribution (if applicable) with link to parent.
- Direct forks carousel (horizontal scroll).
- Comments section below.
- Action buttons: Fork, Share (copy link), Report.
- If the artwork is NSFW, the media remains blurred until the viewer confirms
  the adult-content gate.

---

## 6. Technical Architecture

### 6.1 Stack

| Layer          | Technology                                        |
| -------------- | ------------------------------------------------- |
| Framework      | SvelteKit                                         |
| 3D / Effects   | Threlte (Three.js for Svelte)                     |
| Drawing Engine | HTML5 Canvas 2D API (rendered as Threlte texture)  |
| Backend        | SvelteKit server + self-hosted supporting services |
| Database       | PostgreSQL with Drizzle ORM (code-first)          |
| Auth           | Better Auth with nickname-first UX                |
| Real-time      | Supabase Realtime for votes/comments only (RLS-protected) |
| Storage        | Supabase Storage + cache layer (AVIF artworks, avatars) |
| Content Safety | User-applied NSFW artwork labeling + moderator review |
| Hosting        | TBD (any Node-compatible host)                    |

### 6.2 Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                  Browser (Client)                │
│                                                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ SvelteKit │  │  Threlte  │  │ Canvas 2D    │  │
│  │  (Router,  │  │  (Scene,  │  │  (Drawing    │  │
│  │   SSR,     │  │  Effects, │  │   Engine)    │  │
│  │   Pages)   │  │  Shaders) │  │              │  │
│  └─────┬─────┘  └─────┬────┘  └──────┬───────┘  │
│        │              │               │          │
│        └──────────┬───┘───────────────┘          │
│                   │                              │
│         ┌─────────▼──────────┐                   │
│         │ NSFW Label + 18+   │                   │
│         │ Reveal Gate        │                   │
│         │ (blur + consent)   │                   │
│         └─────────┬──────────┘                   │
└───────────────────┼──────────────────────────────┘
                    │  HTTPS + WebSocket
┌───────────────────▼──────────────────────────────┐
│              Supabase (Self-Hosted)               │
│                                                   │
│  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │ PostgREST│  │ Realtime  │  │   Storage     │  │
│  │  (API)   │  │ (WS)      │  │ (S3-compat)   │  │
│  └────┬─────┘  └─────┬─────┘  └───────┬───────┘  │
│       │              │                │           │
│  ┌────▼──────────────▼────────────────▼────────┐  │
│  │              PostgreSQL                      │  │
│  │  (users, artworks, votes, comments, flags)   │  │
│  └──────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘

Client data access policy for MVP:

- Writes and sensitive reads flow through the SvelteKit backend.
- Real-time vote/comment subscriptions flow from frontend to Supabase Realtime.
- Auth/session and identity-sensitive domain logic are enforced in backend code.
- Realtime-exposed relations require RLS and least-privilege grants.
```

### 6.3 Key Technical Decisions

**Drawing as Canvas2D texture in Threlte**: The drawing engine uses the standard
HTML5 Canvas 2D API. The resulting canvas element is mapped as a `CanvasTexture`
onto a 3D plane in the Threlte scene. This gives us:

- Full Canvas 2D API performance for drawing (no WebGL overhead on strokes).
- The ability to wrap the canvas in a 3D scene with lighting, particles, and
  camera effects.
- A deterministic editing pipeline where the client operates on a versioned JSON
  drawing document and the backend renders canonical AVIF only as a derived
  persistence and delivery artifact.

All canvas-generated editing flows in the MVP follow the same contract: JSON
drawing document for browser-to-backend confirm, gzip-compressed JSON for
editable persistence, and canonical AVIF for backend media persistence and
delivery.

**Drawing document evolution and benchmark path**: The drawing source started
from a simpler append-only JSON model and evolved into `DrawingDocumentV2`
after research focused on controlling persistence growth without giving up
editable replay.

- Research compared exact raster-validated compaction against benchmark-driven
  approximate paths in the stroke-json lab.
- Phase 1 experiments evaluated mature simplification libraries, including
  `simplify-js` and `vis-why`.
- Phase 2 experiments evaluated mature geometry engines, including Clipper 2
  and `js-angusj-clipper`.
- That benchmark work informed two product-level decisions:
  - keep the exact raster-validated compactor as a correctness oracle for
    research and verification
  - standardize the current prod-like path on `simplify-js` with tolerance
    `0.5` and high-quality mode enabled, followed by Clipper 2

The benchmark surface itself is not a product requirement. Its purpose was to
arrive at the current V2 format and compaction direction, which are the parts
that matter for MVP product behavior.

**Storage and egress budget first**: The storage tier is capped at 1GB capacity
and 5GB of egress, so image handling must optimize for both footprint and
delivery efficiency from day one.

- All persisted artwork and avatar images should be stored as AVIF.
- Artwork and avatar editing source should be stored as compact JSON drawing
  documents compressed with gzip.
- Backend confirm flows validate the drawing document first, then render AVIF
  from that validated source.
- Each stored image should target a hard ceiling of roughly 100KB.
- Users should fetch media through cached application-controlled URLs rather
  than downloading directly from the storage bucket.
- The cache layer should absorb repeat reads so popular artwork does not burn
  through bucket egress on every view.

**Better Auth instead of Supabase Auth**: The product uses nickname + password
and a recovery-key flow, which do not fit Supabase Auth's email/OAuth-first
model cleanly. Better Auth should own session lifecycle and generated auth
schema, while product-specific identity data stays in the application schema.

- Auth configuration lives in `apps/web/src/lib/server/auth.ts`.
- Generated auth tables are written to
  `apps/web/src/lib/server/db/auth.schema.ts` via `bun run auth:schema`.
- Product tables live in `apps/web/src/lib/server/db/schema.ts`.

Schema boundary for MVP:

- `app` schema: product-domain source of truth (not directly consumed by frontend writes/secure reads).
- `better-auth` schema: auth/session internals owned by Better Auth.
- Realtime-facing relations: only the minimum set needed for live vote/comment updates, protected with RLS.

**User-labeled NSFW with moderated enforcement**: The product does not attempt
automatic NSFW classification for drawings in MVP. Instead, creators can mark
artworks as NSFW at publish time, and the product treats that label as a first-
class content state.

- NSFW-labeled artworks are blurred by default in browse and detail surfaces.
- Viewers must explicitly pass a +18 reveal gate before seeing the media.
- The reveal gate should be implemented in a GDPR-conscious way with explicit
  acknowledgement rather than implicit exposure.
- Moderators can mark artworks or avatars as NSFW retroactively, hide them,
  delete them, or ban abusive accounts.
- Backend moderation state is the trust boundary; the UI label is only one
  input into that state.

### 6.4 Real-time Strategy

Supabase Realtime is used only for two features and only on minimal data shapes:

1. **Vote updates**: subscribe to vote changes scoped by `artwork_id`, then refresh
  or patch the score projection on the artwork detail view.
2. **New comments**: subscribe to new comment events scoped by `artwork_id`, then
  append to the local chronological comment list.

Access model:

- Frontend -> Supabase Realtime is allowed for these event streams.
- Frontend -> backend remains mandatory for writes and sensitive reads.
- Subscriptions are active only while viewing artwork detail.
- Feed-level real-time is out of scope for MVP.

Security model:

- Realtime-exposed tables MUST enforce RLS.
- Policies MUST be role-aware and row-scoped.
- Do not expose recovery data, auth internals, moderation-only fields, or storage keys in realtime payloads.

### 6.5 Engineering Constraints

The implementation plan must respect repository delivery rules in addition to
product behavior.

- **Code-first database**: Structural database changes start in
  `apps/web/src/lib/server/db/schema.ts`, then move through
  `bun run db:generate` and `bun run db:migrate`. Manual schema drift is not an
  acceptable workflow.
- **Generated auth schema**: `apps/web/src/lib/server/db/auth.schema.ts` is
  owned by Better Auth and regenerated with `bun run auth:schema`; it should not
  be hand-edited.
- **Reproducible setup**: `compose.yaml`, `bun install`, and `.env.example` are
  first-class deliverables for the product.
- **Automated quality gates**: `bun run format`, `bun run lint`,
  `bun run check`, `bun run test:unit`, and `bun run test:e2e` define release
  readiness.
- **Test-first workflow**: New behavior should begin with a failing automated
  test before implementation.

### 6.6 API Identity and Trust Boundaries

- Identity-sensitive server operations MUST derive actor identity from authenticated session context, not from request payload fields.
- For backend endpoints, avoid taking identity authority from client-provided values (for example, avoid trusting `userId` in body/query when it can be inferred from session).
- Route params that identify target resources are acceptable when authorization validates ownership/role against session identity.
- Client payloads may carry content state, never trust authority state.

---

## 7. Data Model

### 7.1 Entity Relationship

```
users
  ├── artworks (1:N)
  │     ├── votes (1:N)
  │     ├── comments (1:N)
  │     ├── reports (1:N)
  │     └── artworks (self-ref: parent_id for forks)
  └── comments (1:N)
```

### 7.2 Tables

These entities describe the product's required data model. Their concrete
implementation must be expressed in Drizzle schema files and shipped through
generated migrations.

#### `users`

| Column               | Type         | Notes                                             |
| -------------------- | ------------ | ------------------------------------------------- |
| id                   | uuid PK      | Default `gen_random_uuid()`                      |
| nickname             | varchar(20)  | UNIQUE, lowercase enforced                       |
| password_hash        | text         | Argon2id hash                                    |
| recovery_hash        | text         | Argon2id hash of recovery key                    |
| avatar_url           | text         | Path in Supabase Storage for derived avatar AVIF |
| avatar_document      | bytea/text   | Gzip-compressed avatar drawing document          |
| avatar_document_version | smallint  | Drawing document schema version                  |
| avatar_is_nsfw       | boolean      | Default false. Set by moderator review           |
| avatar_is_hidden     | boolean      | Default false. Hidden when moderated             |
| role                 | enum         | `user` \| `moderator` \| `admin`                 |
| is_banned            | boolean      | Default false                                    |
| banned_at            | timestamptz  | Nullable                                         |
| ban_reason           | varchar(200) | Nullable                                         |
| created_at           | timestamptz  | Default `now()`                                  |

#### `artworks`

| Column            | Type         | Notes                                              |
| ----------------- | ------------ | -------------------------------------------------- |
| id                | uuid PK      | Default `gen_random_uuid()`                       |
| author_id         | uuid FK      | References `users.id`                             |
| parent_id         | uuid FK      | Nullable. References `artworks.id` (fork)         |
| title             | varchar(100) | Default "Untitled #XXXX"                          |
| image_url         | text         | Path in Supabase Storage for derived artwork AVIF |
| drawing_document  | bytea/text   | Gzip-compressed artwork drawing document          |
| drawing_version   | smallint     | Drawing document schema version                   |
| is_nsfw           | boolean      | Default false                                     |
| nsfw_source       | enum         | `user` \| `moderator` \| null                     |
| score             | int          | Denormalized. Default 0. Updated by trigger       |
| comment_count     | int          | Denormalized. Default 0. Updated by trigger       |
| fork_count        | int          | Denormalized. Default 0. Updated by trigger       |
| is_hidden         | boolean      | Default false. Set by moderation                  |
| created_at        | timestamptz  | Default `now()`                                   |

Indexes: `(author_id)`, `(parent_id)`, `(created_at DESC)`,
`(score DESC, created_at DESC)`.

Client-side drafts are intentionally excluded from backend tables. They exist
only in browser storage and are discarded or replaced when the user confirms a
new avatar save or artwork publish.

#### `votes`

| Column     | Type         | Notes                                        |
| ---------- | ------------ | -------------------------------------------- |
| id         | uuid PK      |                                             |
| user_id    | uuid FK      | References `users.id`                       |
| artwork_id | uuid FK      | References `artworks.id`                    |
| value      | smallint     | `1` (upvote) or `-1` (downvote)             |
| created_at | timestamptz  |                                              |

Constraints: `UNIQUE(user_id, artwork_id)`.

#### `comments`

| Column     | Type         | Notes                                        |
| ---------- | ------------ | -------------------------------------------- |
| id         | uuid PK      |                                             |
| user_id    | uuid FK      | References `users.id`                       |
| artwork_id | uuid FK      | References `artworks.id`                    |
| body       | varchar(500) |                                              |
| is_hidden  | boolean      | Default false. Set by moderation            |
| created_at | timestamptz  |                                              |

#### `reports`

| Column     | Type         | Notes                                        |
| ---------- | ------------ | -------------------------------------------- |
| id         | uuid PK      |                                             |
| reporter_id| uuid FK      | References `users.id`                       |
| artwork_id | uuid FK      | Nullable. Target artwork                    |
| comment_id | uuid FK      | Nullable. Target comment                    |
| reason     | varchar(200) |                                              |
| status     | enum         | `pending` \| `reviewed` \| `actioned`       |
| reviewed_by| uuid FK      | Nullable. Moderator who reviewed            |
| created_at | timestamptz  |                                              |

Constraint: At least one of `artwork_id` or `comment_id` must be non-null.

### 7.3 Database Functions & Triggers

- **`update_artwork_score()`**: Trigger on `votes` INSERT/UPDATE/DELETE.
  Recalculates `artworks.score` as `SUM(value)` for the affected artwork.
- **`update_artwork_comment_count()`**: Trigger on `comments` INSERT/DELETE.
- **`update_artwork_fork_count()`**: Trigger on `artworks` INSERT/DELETE where
  `parent_id` is set.

These behaviors should be introduced through migrations generated from the
code-first schema workflow. Small deterministic backfills may be bundled with
the same migration; seed or non-deterministic data work should stay outside it.

### 7.4 Row-Level Security (RLS)

RLS policy scope for MVP:

- RLS is mandatory on every relation exposed to frontend Supabase Realtime subscriptions.
- Relations not exposed directly to frontend can remain backend-only, with authorization enforced in SvelteKit services.
- If a relation transitions from backend-only to client-exposed, RLS policies must be added before exposure.

Baseline policy intent for client-exposed social relations:

| Table    | SELECT                        | INSERT                     | UPDATE         | DELETE         |
| -------- | ----------------------------- | -------------------------- | -------------- | -------------- |
| artworks | All (where not hidden)        | Authenticated              | Own row only   | Own row only   |
| votes    | All                           | Authenticated              | Own row only   | Own row only   |
| comments | All (where not hidden)        | Authenticated              | Own row only   | Own row only   |
| reports  | Moderators only               | Authenticated              | Moderators     | —              |

Moderators/admins bypass `is_hidden` filtering where moderation policy allows it.

---

## 8. Content Moderation

### 8.1 Creator-Labeled NSFW + Viewer Age Gate

Creators can explicitly label an artwork as NSFW when publishing it or editing
its metadata later.

- NSFW-labeled artworks are blurred by default anywhere public media is shown.
- Revealing them requires an explicit +18 confirmation flow.
- The reveal flow should capture a minimal acknowledgement record suitable for
  GDPR-conscious age-gate handling.
- Unlabeled adult content is still a moderation violation.
- The MVP intentionally avoids automatic drawing classification because false
  positives are worse than the value provided by the model in this product.

### 8.2 Community Reporting

- Any authenticated user can report an artwork or comment.
- Reports can also be used for unlabeled NSFW content or offensive avatars.
- Report requires selecting a reason (predefined list + optional free text).
- Reports go into the `reports` table with `status = pending`.
- After N reports (configurable, start with 3), auto-hide the content pending
  moderator review.

### 8.3 Moderator Actions

Moderators (assigned by admins) can:

- View a moderation queue (pending reports sorted by count).
- **Mark artwork as NSFW** when the creator failed to label it correctly.
- **Mark avatar as NSFW** and remove it from public display.
- **Hide** an artwork or comment (sets `is_hidden = true`). Content is not
  deleted — it's hidden from public but visible to author with a "hidden by
  moderator" notice.
- **Unhide** (false positive).
- **Delete** (permanent removal from DB + storage).
- **Ban** user profiles for repeated or severe abuse, including abusive avatar
  uploads or repeated unlabeled adult content.
- **Warn** user (future: notification system, for now just a log).

### 8.4 Moderation Principles

- Err on the side of leniency. This is an art game, not a corporate platform.
- Honestly labeled adult artwork can exist behind the blur + 18+ reveal gate.
- Unlabeled adult content, abusive avatars, and hate content should be removed.
- Repeated abuse should escalate from hide/delete to profile bans.
- Edgy but not harmful: leave it. Let votes handle it.
- Moderators should be active community members who understand the vibe.

---

## 9. Animation & Polish

This is a core differentiator. The entire experience should feel alive, not
like a static web app. Threlte is the primary engine for all of this.

### 9.1 Canvas / Painting Scene

| Element                   | Behavior                                                  |
| ------------------------- | --------------------------------------------------------- |
| Easel / Surface           | Subtle idle sway. A slight parallax on mouse move.        |
| Ambient particles         | Floating paint specks / dust motes in the scene.          |
| Brush stroke feedback     | Small particle burst on stroke start. Trail particles     |
|                           | along stroke path that fade out.                          |
| Color change              | Scene ambient light subtly shifts to match selected color.|
| Eraser                    | "Dust" particles fly off the erased area.                 |
| Undo                      | Quick "rewind" visual — strokes fade back on.             |
| Publish                   | Canvas "flies off" the easel into a picture frame.        |

### 9.2 Feed & Navigation

| Element                   | Behavior                                                  |
| ------------------------- | --------------------------------------------------------- |
| Page transitions          | Crossfade with slight depth shift (z-axis).               |
| Artwork cards enter       | Staggered scale-up + fade-in as they scroll into view.    |
| Hover on card             | Card lifts (translateZ), subtle shadow grows, slight tilt |
|                           | toward cursor (3D transform).                             |
| Vote button press         | Upvote: confetti burst upward. Downvote: a single         |
|                           | tomato/splat falls down.                                  |
| Score change              | Number rolls/ticks to new value (animated counter).       |
| Tab switch                | Cards slide out, new cards slide in from opposite side.   |

### 9.3 Avatar Creation

| Element                   | Behavior                                                  |
| ------------------------- | --------------------------------------------------------- |
| Template appear           | Face outline draws itself in (path animation).            |
| Drawing                   | Same particle effects as main canvas.                     |
| Confirm                   | Avatar "stamps" into a circular frame with a satisfying   |
|                           | pop + ripple effect.                                      |

### 9.4 General UI

| Element                   | Behavior                                                  |
| ------------------------- | --------------------------------------------------------- |
| Buttons                   | Springy press animation (scale down → bounce back).       |
| Tooltips                  | Fade in with slight upward drift.                         |
| Modals                    | Backdrop blur + modal scales from center.                 |
| Loading states            | Animated paint brush or dripping paint indicator.          |
| Toast notifications       | Slide in from top with gentle bounce.                     |

### 9.5 Performance Budget

- Target 60fps on mid-range devices.
- Threlte scene complexity: keep draw calls under 50 for the painting scene.
- Use `requestAnimationFrame` throttling for particle systems.
- Particle counts: max ~100 concurrent particles.
- Disable heavy effects if `prefers-reduced-motion` is set.
- Consider LOD: reduce effects on low-end devices (detect via GPU tier
  library or frame rate monitoring).

---

## 10. Art Direction

### 10.1 Visual Identity

**Vibe**: Colorful indie game meets satirical art gallery. Think: a children's
museum that takes itself too seriously, or a prestigious gallery where all the
art is crayon drawings.

**Key tension**: The _frame_ is fancy, the _content_ is absurd. The UI should
look like it belongs in a real gallery app — ornate frames, elegant typography —
but everything inside those frames is user-generated chaos.

### 10.2 Color Palette

| Role       | Color                  | Usage                              |
| ---------- | ---------------------- | ---------------------------------- |
| Background | Deep gallery wall      | `#1a1a2e` or `#2d1b3d`            |
| Surface    | Rich velvet            | `#3d2c5e` or `#4a2040`            |
| Primary    | Gold / champagne       | `#d4af37` — frames, accents, CTAs |
| Secondary  | Cream / ivory          | `#f5f0e1` — text, cards           |
| Accent 1   | Warm coral             | `#ff6b6b` — downvotes, warnings   |
| Accent 2   | Teal / aqua            | `#4ecdc4` — upvotes, success      |
| Text       | Off-white              | `#e8e0d0`                          |

### 10.3 Typography

| Element    | Font                          | Notes                       |
| ---------- | ----------------------------- | --------------------------- |
| Display    | Serif (e.g., Playfair Display)| Headings, titles, frames    |
| Body       | Sans-serif (e.g., Inter)      | UI text, comments, labels   |
| Monospace  | For scores/counters           | JetBrains Mono or similar   |

The contrast between the elegant serif and the doodled artwork reinforces the
satirical tone.

### 10.4 Iconography

Hand-drawn / sketch-style icons that match the art game vibe. Consider a set
like [Phosphor Icons](https://phosphoricons.com/) in the "duotone" style with
custom tweaks, or commission/draw a bespoke icon set.

### 10.5 Artwork Frames

Each artwork in the feed is displayed inside a decorative frame. Start with 1-2
frame styles (ornate gold, minimalist wood). Potentially expand to unlockable
frame styles as a future feature.

---

## 11. Delivery Constraints

### 11.1 Quality Gates

Every phase is only complete when the standard repository scripts pass:

| Script              | Purpose                                 |
| ------------------- | --------------------------------------- |
| `bun run format`    | Prettier formatting                     |
| `bun run lint`      | ESLint + formatting validation          |
| `bun run check`     | Svelte/TypeScript static validation     |
| `bun run test:unit` | Unit and component coverage             |
| `bun run test:e2e`  | End-to-end validation of critical flows |

### 11.2 Reproducibility

- Local development from a clean clone must work with `bun install` and the
  documented environment.
- Required services must be defined in `compose.yaml` and started with
  `bun run db:start`.
- `.env.example` must document every required variable before launch.
- CI should execute the same scripts used locally; no hidden release steps.

### 11.3 Storage and delivery budget

- The MVP must fit within a storage ceiling of 1GB and an egress ceiling of 5GB.
- Artwork and avatar media are stored as AVIF to maximize compression quality
  for the available budget.
- Browser uploads generated from canvas are accepted as compressed WebP first,
  then normalized to AVIF on the backend so storage and egress remain canonical
  while ingress payloads stay small.
- The publish pipeline must enforce an image size budget of roughly 100KB per
  stored image.
- Media delivery should go through a cache layer in front of object storage;
  clients should not hotlink bucket objects directly for normal app reads.

### 11.4 Testing Expectations By Area

- **Auth**: signup, login, logout, recovery-key reset, and session expiry.
- **Canvas flows**: publish, fork, undo/redo, and title validation.
- **Social flows**: vote transitions, comments, feed sorting, and moderation
  permissions.
- **Sensitive content flows**: NSFW labeling, blur/reveal gating, moderator
  overrides, and ban enforcement.
- **Infrastructure-sensitive features**: migrations, storage integration, and
  realtime subscriptions should have automated validation where practical.

### 11.5 Backend Development

The backend has its own roadmap within product delivery, but this project is
not organized as a backend-first program. Frontend and backend are expected to
advance in parallel around shared product slices, while the backend focuses on
stabilizing domain behavior, persistence rules, authorization, and operational
guarantees.

For MVP, the backend does not require a separate contract-first initiative or a
formal public API specification. Because the product runs as a SvelteKit
application with internal server boundaries, alignment should come from:

- **Drizzle schema + migrations** as the source of truth for persisted data.
- **Runtime validation schemas** at server boundaries for critical inputs and
  outputs.
- **Shared TypeScript types** only where they reduce duplication between server
  code and consuming UI.
- **Canonical fixtures/examples** per use case so frontend can work against
  realistic states before every backend capability is fully implemented.
- **Integration tests** that lock down behavior at the use-case level rather
  than relying on documentation alone.

Backend work should be planned as a roadmap of capabilities rather than as
isolated infrastructure layers:

1. **Foundation of the system**: persistence, auth, storage, realtime, roles,
   reproducible local setup.
2. **Identity and access**: sessions, recovery, permissions, abuse limits.
3. **Artwork domain**: publish, persist, edit title, delete, visibility rules.
4. **Discovery and read models**: feed queries, sorting, detail views,
   pagination.
5. **Community interactions**: votes, comments, derived counters, live updates.
6. **Lineage**: forks, attribution, parent/child navigation, deleted-parent
   behavior.
7. **Moderation and governance**: reports, auto-hide rules, moderator actions,
   admin controls.
8. **Operational hardening**: performance, observability, security review,
   resilience.

Each backend phase should leave the system in a state that is testable,
integrable, and usable by frontend work, even if the final user experience is
completed in a different phase.

## 12. Milestones & Phases

### Phase 0 — Foundation (Weeks 1-2)

- [ ] SvelteKit project setup + Threlte integration
- [ ] Supabase self-hosted deployment (Docker Compose)
- [ ] `.env.example` covering all required variables
- [ ] Database schema in Drizzle + generated migrations + RLS policies
- [ ] Better Auth setup (signup, login, logout, recovery)
- [ ] Basic layout shell (nav, routes)
- [ ] CI/local scripts aligned on format → lint → check → test

### Phase 1 — Core Canvas (Weeks 3-4)

- [ ] Failing tests for canvas and avatar core flows before implementation
- [ ] Drawing engine (brush, eraser, color picker, undo/redo)
- [ ] Canvas-to-Threlte texture pipeline
- [ ] Avatar creation (template + draw)
- [ ] Artwork publish flow (preview → upload → save)
- [ ] Basic painting scene (easel, minimal 3D environment)

### Phase 2 — Feed & Social (Weeks 5-6)

- [ ] Failing tests for feed sorting, votes, and comments before implementation
- [ ] Feed page with artwork cards (Recent tab)
- [ ] Artwork detail page
- [ ] Upvote / Downvote system
- [ ] Real-time vote updates
- [ ] Comments (create, list, delete)
- [ ] Real-time comment updates
- [ ] Hot / Top tabs with sorting logic

### Phase 3 — Forks & Lineage (Week 7)

- [ ] Failing tests for parent/child relationships and attribution rules
- [ ] Fork flow (load parent as background, draw on top)
- [ ] Fork attribution display
- [ ] Parent/children navigation on artwork detail
- [ ] Fork count on cards

### Phase 4 — Moderation (Week 8)

- [ ] Failing tests for report thresholds and moderator permissions
- [ ] Creator-applied NSFW artwork labeling with blurred feed/detail rendering
- [ ] +18 reveal confirmation flow for NSFW artwork
- [ ] Report system (create report, auto-hide threshold)
- [ ] Moderator dashboard (queue, mark NSFW, hide/unhide/delete, ban)
- [ ] Moderator role assignment (admin only)

### Phase 5 — Polish & Animation (Weeks 9-10)

- [ ] Visual polish verified without regressing quality gates
- [ ] Painting scene animations (particles, ambient effects, color reactivity)
- [ ] Feed animations (card entrance, hover, transitions)
- [ ] Vote animations (confetti/tomato)
- [ ] Avatar creation animations
- [ ] Page transitions
- [ ] Loading states
- [ ] `prefers-reduced-motion` support

### Phase 6 — QA & Launch (Week 11-12)

- [ ] Full gate pass: format, lint, check, unit, e2e
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Performance profiling (60fps target, lighthouse)
- [ ] Security review (auth, RLS, XSS, CSRF)
- [ ] Accessibility pass (keyboard nav, screen readers, contrast)
- [ ] Soft launch with friends/testers
- [ ] Feedback iteration

---

## 13. Open Questions

These are decisions that don't need to be made now but should be resolved before
or during implementation:

1. **Stroke replay**: Should we store stroke data (vector paths + timestamps)
   to enable artwork creation replay? Cool feature but adds storage/complexity.
   Decision can wait until Phase 3.

2. **Frame unlock system**: Should users earn different frame styles based on
   score/activity? Fun gamification but scope creep. Park for v2.

3. **Notification system**: Should users be notified when their art is forked,
   commented on, or reaches a score milestone? Nice to have, not MVP.

4. **Export/Share**: Beyond copy-link, should users be able to download their
   artwork as an image with the frame + attribution baked in? Good for social
   sharing.

5. **Hosting target**: The SvelteKit app itself needs a host. Options include a
   VPS (alongside Supabase), Vercel/Netlify (SSR adapter), or Coolify/Dokku on
   the same machine. Decide in Phase 0.

6. **Canvas library abstraction**: Raw Canvas 2D API is fine for the minimalist
   toolset, but if we want pressure sensitivity or better touch handling later,
   consider wrapping with [perfect-freehand](https://github.com/steveruizok/perfect-freehand)
   for stroke rendering.

7. **Gallery-style browsing**: A future mode where artworks are displayed on
   walls in a 3D gallery you can "walk" through. Natural fit for Threlte but
   significant scope. v2 candidate.
