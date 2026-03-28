## 1. Sanitization foundation

- [x] 1.1 Add failing tests that prove artwork and avatar uploads currently persist client-authored bytes instead of backend-sanitized canonical media.
- [x] 1.2 Select and wire the image-processing dependency needed for AVIF decode and AVIF re-encode in the backend runtime.
- [x] 1.3 Implement a shared media-sanitization utility that decodes AVIF uploads, strips client metadata by re-encoding, and returns canonical backend-generated files plus metadata.

## 2. Artwork publish hardening

- [x] 2.1 Add failing tests for artwork publish rejection on undecodable AVIF payloads, non-canonical dimensions, and sanitized-output budget overflow.
- [x] 2.2 Update artwork publishing to sanitize accepted uploads before storage and persist only the backend-generated canonical artwork media.
- [x] 2.3 Preserve and verify existing partial-failure cleanup behavior when artwork sanitization succeeds but downstream persistence fails.

## 3. Avatar upload hardening

- [x] 3.1 Add failing tests for avatar upload rejection on undecodable AVIF payloads, non-canonical dimensions, and sanitized-output budget overflow.
- [x] 3.2 Update avatar uploads to sanitize accepted uploads before storage and persist only the backend-generated canonical avatar media.
- [x] 3.3 Verify avatar replacement and deletion behavior still operate correctly with sanitized backend-generated media objects.

## 4. Validation and release readiness

- [x] 4.1 Add regression coverage proving persisted artwork and avatar media are backend-generated canonical AVIF outputs rather than original request bytes.
- [x] 4.2 Run `bun run format`, `bun run lint`, `bun run check`, `bun run test:unit`, and `bun run test:e2e` and resolve any failures related to media sanitization.