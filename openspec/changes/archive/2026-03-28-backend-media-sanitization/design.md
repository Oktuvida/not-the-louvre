## Context

The backend currently enforces a narrow media contract for persisted uploads: AVIF MIME, maximum byte budget, and a basic AVIF container signature check before writing bytes to storage. That is enough to reject obviously wrong uploads, but it still leaves the persisted object substantially client-authored. If the product wants backend sanitization rather than validation-only, the server has to become the owner of the final persisted media representation.

This change is cross-cutting because it touches both artwork publishing and avatar upload, introduces a real media-processing step before storage, and changes the operational contract of uploads. The current size ceilings are low enough that the backend can sanitize in-process without inventing a separate async pipeline, but the design still has to define exactly what becomes canonical and what gets rejected.

## Goals / Non-Goals

**Goals:**
- Make the backend produce the final persisted artwork and avatar media instead of storing accepted client bytes verbatim.
- Define a shared server-side sanitization pipeline for artwork and avatar uploads.
- Enforce canonical persisted invariants: decodable single-image input, exact expected dimensions per media type, backend-generated AVIF output, and stripped client metadata.
- Keep storage cleanup semantics safe if sanitization or later persistence steps fail.
- Add testable behavior for valid sanitization, decode failures, dimension mismatches, and sanitized-output persistence.

**Non-Goals:**
- Building a general-purpose asset-processing service or background job system.
- Supporting arbitrary input dimensions with crop, pad, or resize policy.
- Accepting formats beyond the current AVIF upload contract.
- Adding malware scanning, moderation classification, or perceptual-content analysis in this change.
- Redesigning the public upload endpoints or moving uploads out of the SvelteKit server boundary.

## Decisions

### 1. Persist only backend-generated media bytes

Accepted uploads will be decoded by the backend and re-encoded into a canonical AVIF output before any storage write occurs. Storage will never persist the original client byte stream for artwork or avatar media.

Why this decision:
- It is the clearest line between validation and sanitization.
- It strips non-essential client metadata by construction.
- It gives the server one canonical persisted representation regardless of what the client generated.

Alternatives considered:
- Validate container and metadata but store the original bytes: rejected because that is still validation-only.
- Upload the original file first and sanitize later asynchronously: rejected because it allows unsanitized media to exist in product storage and complicates failure semantics.

### 2. Enforce exact dimensions, reject mismatches, do not auto-resize

Artwork uploads must decode to exactly 1024x1024 pixels, and avatar uploads must decode to exactly 256x256 pixels. Inputs with any other dimensions are rejected rather than resized, cropped, or padded.

Why this decision:
- The PRD already defines canonical output dimensions for both media types.
- Rejecting mismatches keeps the backend deterministic and avoids hidden transformations that alter user-created content.
- It keeps the sanitization scope narrow enough for MVP while still removing ambiguity.

Alternatives considered:
- Resize server-side to the nearest accepted size: rejected because it changes authored content and opens policy questions around sampling and cropping.
- Allow any dimensions as long as byte size is compliant: rejected because persisted media would no longer be canonical.

### 3. Keep the input contract narrow: AVIF-in, sanitized AVIF-out

The backend will continue accepting only AVIF uploads at the request boundary. Sanitization does not broaden the accepted input formats; it hardens how accepted AVIF uploads are decoded and persisted.

Why this decision:
- It avoids expanding product scope while still delivering the security and consistency benefit the user asked for.
- The client pipeline already targets AVIF, so widening input formats would create new UX and testing work unrelated to the current gap.
- It preserves the existing API contract while making persistence safer.

Alternatives considered:
- Accept PNG/WebP/JPEG and normalize all of them to AVIF: rejected because it changes the publish/upload contract and broadens scope unnecessarily.

### 4. Implement sanitization as a shared in-process utility used by artwork and avatar services

Both upload paths will use a shared backend media sanitizer that receives a `File` plus a media profile (`artwork` or `avatar`) and returns sanitized bytes plus canonical metadata. Because the file-size ceiling is small, the sanitizer can operate synchronously in-process within the request lifecycle.

Why this decision:
- The two upload paths differ mainly in dimension and size policies, not in architecture.
- A shared utility reduces drift between artwork and avatar handling.
- In-process execution is operationally simpler and appropriate for the current upload sizes.

Alternatives considered:
- Separate sanitizer implementations per capability: rejected because behavior would drift quickly.
- A dedicated worker or queue-backed pipeline: rejected because the current workload does not justify the complexity.

### 5. The sanitized output owns the final size budget

Budget checks will apply to the sanitized AVIF output that the backend is about to persist, not only to the incoming upload. If the backend cannot produce a canonical AVIF within the configured budget, the request is rejected and nothing is written to storage.

Why this decision:
- The persisted object is what consumes storage and egress budget.
- A client upload that is small enough on ingress can still become non-compliant after canonical re-encoding.
- This keeps the storage policy anchored to actual persisted bytes.

Alternatives considered:
- Enforce size only on the incoming file: rejected because the sanitized output is the real artifact of record.

## Risks / Trade-offs

- **AVIF encode/decode support may vary across environments** -> Mitigation: choose a runtime dependency with reliable Linux support and lock behavior with tests in CI.
- **Canonical re-encoding may reject files that previously passed validation** -> Mitigation: treat that as an intentional contract tightening and capture it explicitly in specs and tests.
- **Sanitized output may exceed current size ceilings for edge-case images** -> Mitigation: fail closed with a clear validation error instead of storing non-compliant media.
- **In-process sanitization adds CPU cost to upload requests** -> Mitigation: current media sizes are small; if this becomes hot, the shared utility still provides a clean seam for later worker extraction.
- **Exact-dimension enforcement may surface frontend export bugs immediately** -> Mitigation: this is desirable because it prevents non-canonical persisted media and gives fast feedback.

## Migration Plan

1. Add failing tests that prove current upload flows still accept unsanitized persisted bytes and that new canonical-output behavior is required.
2. Introduce a shared media-sanitization utility with profile-specific policies for artwork and avatar uploads.
3. Update artwork publish and avatar upload services so storage writes use sanitized backend-generated files rather than original request files.
4. Extend tests to cover decode failures, dimension mismatches, sanitized-output size failures, and unchanged storage-cleanup behavior after downstream persistence errors.
5. Run the standard quality gates once implementation is complete.

**Rollback:**
- Revert sanitizer integration first and fall back to the previous validation-only behavior if runtime or deployment issues appear.
- Because this change does not require a schema migration, rollback is application-level and low-risk, but any media written while the change is active will remain in canonical sanitized form.

## Open Questions

- Which concrete image-processing dependency is the best fit for AVIF decode and encode support in the project's Bun and deployment environment?
- Should the backend preserve alpha exactly as provided, or is there any reason to normalize transparent pixels more aggressively?
- Is exact-dimension rejection enough for MVP, or does the team want a later follow-up spec for safe server-side resizing of non-canonical inputs?