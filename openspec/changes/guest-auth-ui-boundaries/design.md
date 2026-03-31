## Context

The current backend already enforces several authenticated-only actions correctly, but the frontend does not consistently reflect those boundaries. Signed-out visitors can currently see authenticated-only entry points such as `Create Art`, `Your Studio`, and artwork interaction controls, and only learn they are unauthorized after clicking into a redirect or failed action. The change needs to tighten guest-facing chrome across multiple Svelte surfaces without altering the core authorization rules already enforced by the server.

This is cross-cutting because the inconsistency spans the home entry scene, gallery room navigation, gallery empty states, and artwork detail interactions. The design must preserve public discovery while making the authenticated product surfaces feel intentionally private or read-only.

## Goals / Non-Goals

**Goals:**
- Establish a consistent visitor mode that only exposes read-only discovery affordances.
- Ensure authenticated-only surfaces are hidden, replaced, or reworded before a visitor clicks them.
- Keep existing backend authorization intact and align the visible UI with those rules.
- Reduce dead-end navigations and misleading empty states for signed-out users.
- Add test coverage for guest versus authenticated rendering in the affected surfaces.

**Non-Goals:**
- Redesign the overall visual language of the home page or gallery.
- Change the underlying auth model, session handling, or backend permission rules.
- Introduce anonymous drafting, guest interactions, or any new unauthenticated creation capability.
- Rework ranking, discovery ordering, or moderation policy beyond the UI boundaries needed here.

## Decisions

### Decision: Model this as an explicit visitor mode in the UI
The frontend should treat `viewer == null` as a first-class rendering mode rather than a series of late action guards. That means top-level surfaces decide what to show a visitor up front instead of letting hidden backend constraints leak through redirects or action errors.

Alternative considered: keep current UI and rely on click-time guards. Rejected because it preserves the main inconsistency: guests still see capabilities they do not actually have.

### Decision: Keep public gallery discovery available, but remove personal and creation affordances
The gallery remains publicly browsable, but visitor mode must not expose `Your Studio`, `Create Art`, or empty-state copy that assumes ownership of a studio. This preserves product discovery while avoiding private-space leakage.

Alternative considered: fully gate the gallery behind auth. Rejected because the existing product already supports public artwork discovery and the issue is differentiation, not full lockdown.

### Decision: Convert artwork detail for guests into read-only detail
Artwork detail remains viewable for visitors, but interaction controls should not appear as usable actions. Instead of showing vote/comment/fork buttons that fail later, the panel should present artwork metadata and comments read-only, with sign-in-oriented messaging where needed.

Alternative considered: keep the controls disabled in place. Rejected because the user explicitly wants guests not to see interaction controls, and disabled controls still communicate unavailable functionality too aggressively.

### Decision: Separate authenticated home-world affordances from the public landing state
The home route should stop presenting signed-out visitors with the same 3D navigation semantics used for authenticated users. The authenticated world chrome and route-transition affordances should only appear when a user can actually access those destinations.

Alternative considered: keep the 3D scene for everyone and only remove individual buttons. Rejected because the current issue is broader than a few buttons; the experience itself implies a level of access that guests do not have.

## Risks / Trade-offs

- [Risk] Visitor mode may hide too much and reduce the app's sense of depth for first-time users. → Mitigation: keep public discovery visible and use sign-in-oriented copy where a private capability is being withheld.
- [Risk] Different rendering paths for guest and authenticated users can drift over time. → Mitigation: centralize auth-aware conditions near top-level page components and add coverage for both modes.
- [Risk] Route-level access and UI-level access can diverge again later. → Mitigation: add tests that assert both rendered affordances and route behavior for signed-out requests.
- [Risk] Home-scene adjustments could unintentionally affect authenticated transitions. → Mitigation: preserve current authenticated behaviors and add regression coverage around signed-in entry and return flows.
