## Why

The current product exposes several authenticated-only affordances to signed-out visitors, especially across the home scene, gallery navigation, and artwork detail flows. This makes the visitor experience feel inconsistent because guests can see creation and interaction paths that only fail later through redirects or action errors.

## What Changes

- Define an explicit visitor-mode product experience with UI boundaries that differ from the authenticated experience.
- Hide or replace authenticated-only affordances for signed-out visitors in the home scene, gallery navigation, and artwork detail surfaces.
- Prevent signed-out visitors from seeing personal-space entry points such as `Your Studio` and create-art calls to action.
- Ensure artwork interaction controls shown to visitors are read-only and sign-in-oriented instead of exposing vote, comment, and fork actions that cannot succeed.
- Align route-level behavior and empty states with the visible UI so guests are not led into dead-end screens.
- Add automated coverage for guest-visible chrome and interaction boundaries.

## Capabilities

### New Capabilities
- `visitor-experience-boundaries`: Defines the read-only visitor experience and the authenticated-only UI affordances that must be hidden, replaced, or redirected across home, gallery, and artwork detail flows.

### Modified Capabilities

## Impact

- Affected frontend areas: home entry scene, persistent navigation, gallery exploration page, gallery room navigation, artwork detail panel.
- Affected route behavior: `/`, `/gallery`, `/gallery/[room]`, and `/draw` entry affordances as presented in the UI.
- Affected quality gates: component tests and route tests covering signed-out versus authenticated rendering.
