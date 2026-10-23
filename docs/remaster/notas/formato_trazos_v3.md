# Vector stroke document format v3 (pressure + timing): encoding, compression, validation, storage and migration, as of October 2026

Scope note: "Not The Louvre" (SvelteKit / Svelte 5 on Cloudflare Workers, Postgres via Hyperdrive, documents and media moving to R2). I read the repo on branch `audit/fix-everything` (commit 9d09a29) without changing it, and repo facts are cited by path. Browser support data comes from MDN browser-compat-data JSON on GitHub (main branch, read 2026-10-23).

**Local benchmarks (primary evidence for every size and CPU number below).** I wrote and ran these myself in a scratch directory outside the repo (`un directorio temporal fuera del repo, no conservado`: `gen.mjs`, `sizes.mjs`, `perf.mjs`, `binperf.mjs`, `dd.mjs`). That directory belongs to this session and may be deleted, so here is enough to reproduce the method:
- **Machine and libraries:** Apple M5 Pro, Node v24.15.0 (V8). Libraries: zod 4.6.7, valibot 1.5.0, arktype 2.2.9, cbor-x 1.6.8, @msgpack/msgpack 3.1.3.
- **Simulating Workers:** I ran `node --disallow-code-generation-from-strings`. This makes `eval`/`new Function` throw, which is what Workers enforces.
- **Synthetic strokes:** a seeded PRNG drives a smooth random-walk heading. Speed is 150–800 px/s. Pressure follows a bell curve with per-point noise. Sampling is 240 Hz (stylus) or 60 Hz (finger/mouse) with ±15% jitter. Gaps between strokes are 0.15–1.35 s, and 3% of strokes are followed by a 5–35 s pause. Colors come from the app palette and sizes from its brush steps. Canvas is 768×768.
- **Caveat on realism:** this is synthetic data, not production drawings (I found no real stroke fixtures in the repo). My synthetic pressure is probably noisier than real hardware pressure, so the pressure columns will likely compress better on real data. Read the ratios as indicative, not exact.

---

## 1. How do established products and datasets store strokes (fields, precision, encoding)?

### Takeaway
Every serious ink format separates x, y, pressure and time into per-channel numeric streams and delta-encodes them. Quick, Draw! uses parallel x/y/t arrays. InkML has first/second-difference prefixes. ISF does delta-delta per channel followed by Huffman or bit-packing. tldraw uses Float32 for the first point and Float16 deltas after it. Only the recognition datasets (Quick, Draw! raw) and the OS-level ink APIs (PencilKit, InkML, ISF) keep per-point time. The whiteboards (tldraw, Excalidraw) keep pressure but drop timing. That is exactly the gap Not The Louvre needs to fill for timelapse.

### Cited Findings
**Current Not The Louvre format (repo)**
- v1 is `{version:1, kind, width, height, background, strokes:[{color:'#rrggbb', points:[[x,y]...], size:int 1..64}]}`. Points are non-negative integers. v2 replaces `strokes` with `base` + `tail`, rendered base-then-tail. Background and dimensions are literal per kind: artwork 768×768 `#fdfbf7`, avatar 340×340 `#f5f0e1` — [repo: apps/web/src/lib/features/stroke-json/document.ts](../../../apps/web/src/lib/features/stroke-json/document.ts)
- Limits are 5,000 strokes, 100,000 total points, 5,000 points per stroke, 1 MiB decompressed JSON and 256 KiB compressed — [repo: document.ts `DEFAULT_DRAWING_DOCUMENT_LIMITS`](../../../apps/web/src/lib/features/stroke-json/document.ts); the same values appear in [repo: crates/stroke-json-core/src/lib.rs](../../../crates/stroke-json-core/src/lib.rs)
- Pointer positions are rounded to integer canvas pixels at capture (`clampDrawingPoint` uses `Math.round`). Only the event's `clientX/clientY` is read: no `pressure`, no `getCoalescedEvents()`, no `timeStamp` — [repo: document.ts `clampDrawingPoint`](../../../apps/web/src/lib/features/stroke-json/document.ts); [repo: apps/web/src/lib/features/studio-drawing/pointer-drawing.ts](../../../apps/web/src/lib/features/studio-drawing/pointer-drawing.ts)
- **There is no eraser.** "eraser" appears nowhere in non-test source. The palette's first entry is `#FFFFFF` (white), but the artwork background is `#fdfbf7`, so painting white to "erase" leaves visible off-white marks — [repo: apps/web/src/lib/features/studio-drawing/state/drawing.svelte.ts](../../../apps/web/src/lib/features/studio-drawing/state/drawing.svelte.ts); [repo: document.ts](../../../apps/web/src/lib/features/stroke-json/document.ts)
- Brush sizes are the discrete steps `[1, 2, 4, 6, 8, 10, 12, 14, 18, 24, 32, 38, 45, 54, 64]` — [repo: drawing.svelte.ts](../../../apps/web/src/lib/features/studio-drawing/state/drawing.svelte.ts)
- Rendering is plain round-cap/round-join polylines, with a filled circle for single-point strokes. The client uses Canvas 2D. The server builds an SVG `<polyline>` and rasterizes it with `@resvg/resvg-wasm` — [repo: stroke-json/canvas.ts](../../../apps/web/src/lib/features/stroke-json/canvas.ts); [repo: stroke-json/svg.ts](../../../apps/web/src/lib/features/stroke-json/svg.ts); [repo: apps/web/src/lib/server/media/codecs/index.ts](../../../apps/web/src/lib/server/media/codecs/index.ts)
- The Rust "prod-like" pipeline runs simplify-js (RDP) and Clipper2 compaction over strokes. This is the history-destroying step the remaster plans to drop — [repo: crates/stroke-json-core/src/prod_like.rs](../../../crates/stroke-json-core/src/prod_like.rs)

**Google Quick, Draw!**
- The raw ndjson stores each stroke as three parallel arrays: `x` and `y` ("real-valued pixel coordinates") and `t` ("integer times in milliseconds since the first point") — [quickdraw-dataset README](https://github.com/googlecreativelab/quickdraw-dataset)
- The simplified format drops `t`. It aligns the drawing to the top-left, scales it to a 0–255 maximum, resamples at 1 px spacing and applies RDP with epsilon 2.0. A custom binary `.bin` exists for the simplified data, but the README only points to example parsers for its layout. The dataset holds 50 million drawings in 345 categories — [quickdraw-dataset README](https://github.com/googlecreativelab/quickdraw-dataset)

**Apple PencilKit (iOS 14+)**
- `PKStrokePoint` has these fields:
  - `location: CGPoint`
  - `timeOffset: TimeInterval` ("since the start of the stroke path in seconds")
  - `size: CGSize`
  - `opacity`
  - `force`
  - `azimuth` and `altitude` (radians)
  - `secondaryScale`
  - `threshold` ("alpha threshold for clipping the stroke rendering for supported inks")
  - `lateralJitter`

  The newer initializers add the last three fields — [Apple: PKStrokePoint](https://developer.apple.com/documentation/pencilkit/pkstrokepoint-swift.struct.md)
- Opacity ranges 0 to 2. Time offset is in seconds from the start of the stroke path — [Apple PencilKit docs via search](https://developer.apple.com/documentation/pencilkit/pkstrokepointreference.md)

**tldraw (packages/tlschema, current main)**
- A draw shape stores `segments: {type:'free'|'straight', path:string, dim?:2|3}[]` plus `color, fill, dash, size, isComplete, isClosed, isPen, scale, scaleX, scaleY`. `path` is "delta-encoded base64 path data" — [tldraw TLDrawShape.ts](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/tlschema/src/shapes/TLDrawShape.ts)
- **Layout:** the first point is three little-endian Float32 values (x, y, z) in 12 bytes. Each later point is three Float16 deltas in 6 bytes, so a stroke costs 12 + 6(n−1) bytes before base64. The 2D variant drops the constant z = 0.5 for non-pressure devices and costs 8 + 4(n−1) bytes; the source says storing z there "wastes ~33% of per-point bytes". Pressure z defaults to 0.5. The code uses native `Uint8Array.toBase64()` when available — [tldraw b64Vecs.ts](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/tlschema/src/misc/b64Vecs.ts)
- **Migration history:** `AddInPen` (pen detection from device type and pressure), then `AddScale`, then `Base64` ("Convert VecModel[] arrays directly to delta-encoded base64"), then `LegacyPointsConversion` (absolute Float16, superseded), then `OmitNonPressureZ` (adds `dim`; its down-migration re-encodes for old clients that "reject the unknown `dim` field"). tldraw stores no per-point timing — [tldraw TLDrawShape.ts](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/tlschema/src/shapes/TLDrawShape.ts)

**Excalidraw**
- `ExcalidrawFreeDrawElement` has `type:"freedraw"`, `points: readonly LocalPoint[]`, `pressures: readonly number[]`, `simulatePressure: boolean` and `strokeOptions: StrokeOptions` (a newer field). Points are local to the element origin. There is no timing — [Excalidraw packages/element/src/types.ts](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/types.ts)

**perfect-freehand (the outline algorithm commonly paired with these formats)**
- Input is `[x, y, pressure]` with pressure defaulting to 0.5. Options are `size, thinning, smoothing, streamline, easing, simulatePressure (default true), last, start/end {cap, taper, easing}`. Output is a closed outline polygon to fill. The README does not state anything about determinism — [perfect-freehand README](https://github.com/steveruizok/perfect-freehand)

**W3C InkML (Recommendation, 20 Sep 2011; old but still the reference model)**
- Reserved channels are X, Y, Z (mm), F (force, %), S (tip switch), B1..Bn, OTx/OTy (tilt, deg), OA (azimuth), OE (elevation), OR (rotation), C/CR/CG/CB, A (transparency), W (width), BW/BH, and T (time, ms) — [W3C InkML](https://www.w3.org/TR/InkML/)
- Trace text supports explicit values (`!` or no prefix), first differences (`'`) and second differences (`"`). "All traces must begin with an explicit value." `<brush>` holds reusable attributes (width, color, tip, rasterOp, ignorePressure…). `<timestamp>` gives a reference time for relative stamps — [W3C InkML](https://www.w3.org/TR/InkML/)

**Windows Ink Serialized Format (ISF)**
- ISF models ink as strokes of points with optional pressure and angle. Custom GUID-tagged attributes can be attached to ink, strokes or points. Microsoft placed it under its Open Specification Promise — [Wikipedia: Ink Serialized Format](https://en.wikipedia.org/wiki/Ink_Serialized_Format)
- In the open-source WPF serializer, `AlgoModule.CompressPacketData` takes per-channel int arrays (comment: "assumed to be point data (x,x,x,x,x,x,x)", i.e. one channel at a time). It runs a `DeltaDelta` transform and chooses an indexed Huffman codec by the variance of the delta-deltas. If Huffman does not help, it falls back to "Gorilla" fixed-bit-width packing. Sibling files are `LZCodec`, `MultiByteCodec`, `HuffCodec` and `GorillaCodec` — [dotnet/wpf AlgoModule.cs](https://github.com/dotnet/wpf/blob/main/src/Microsoft.DotNet.Wpf/src/PresentationCore/MS/internal/Ink/InkSerializedFormat/AlgoModule.cs)

**Krita (contrast)**
- Krita's timelapse comes from the Recorder docker, which "makes a snapshot of the canvas every few seconds, or at the end of every stroke". The snapshots are rendered to video with FFmpeg. It is raster capture, not stroke replay — [Krita docs: Recorder docker](https://docs.krita.org/en/reference_manual/dockers/recorder_docker.html)

### Inferences
- **Precedent for layout:** a channel-planar, delta-encoded layout with a per-document version, a per-stroke brush/tool record and per-point (x, y, pressure, time) has direct precedent in ISF, InkML and Quick, Draw! raw. tldraw independently converged on delta encoding for size.
- **Why not copy tldraw:** tldraw's Float16 deltas fit a zoomable infinite canvas where absolute float range matters. A fixed 768/340 canvas fits integer fixed-point better: it gives exact round-trips, deterministic validation ("x within 0..width*scale" is an integer check), and no accumulated Float16 rounding error along long strokes. tldraw's own code accumulates deltas, so error grows with path length.
- **The eraser** has to become an explicit tool in v3, because today it does not exist and "white paint" is visibly wrong on `#fdfbf7`.

### Gaps
- I did not fetch Apple's `PKStroke`/`PKStrokePath` docs, so I cannot say how PencilKit stores the path as a whole (it is believed to be a spline with a creation date) or how `PKDrawing.dataRepresentation()` is serialized. That serialization is undocumented and proprietary.
- The official ISF PDF (bit-level layout, Huffman tables) was not read. The pipeline above comes only from the WPF source comments and code.
- I did not check what Excalidraw's new `strokeOptions` contains.

---

## 2. What precision is sufficient for coordinates, pressure and time? How to represent eraser, brush type and per-stroke metadata? Raw vs smoothed points?

### Takeaway
Store **raw coalesced input samples**, quantized to fixed-point integers:
- **x/y at 1/4 px** (`xyScale = 4`, max error 0.125 canvas px)
- **pressure at 10 bits** (0..1023, plus an explicit "no pressure" flag)
- **time in integer milliseconds** relative to stroke start, with each stroke's start relative to the previous stroke

Smoothing and the pressure-to-width mapping belong in a **versioned brush id** (for example `pen@1`, `marker@1`, `eraser@1`) that the renderer interprets deterministically, never baked into the stored points. Under synthetic data the step from integer px to quarter px costs about 10 KiB gzip on a typical 24k-point drawing (+24%), and 8-bit to 10-bit pressure about 6 KiB.

### Cited Findings
**Pointer Events data available**
| API | Chrome | Firefox | Safari |
|---|---|---|---|
| `getCoalescedEvents()` | 58 | 59 | 18.2 |
| `getPredictedEvents()` | 77 | 89 | 18.2 |
| `pressure`, `tiltX/Y`, `twist` | 55–57 | 59 | 13 |
| `altitudeAngle` / `azimuthAngle` | 86 | 131 | 18.2 |

- Firefox for Android's `getCoalescedEvents()` "always returns an empty array" (partial support) — [MDN BCD PointerEvent.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/PointerEvent.json)
- A 2021 Apple forum post said Safari lacked `getCoalescedEvents()`; BCD's Safari 18.2 entry supersedes it. The same thread reports that plain `pointermove` delivers 240 Hz (120 Hz in Low Power Mode). A later single-user report says `pointermove` with Apple Pencil Pro looked choppier than `touchmove` — [Apple Developer Forums 689375](https://developer.apple.com/forums/thread/689375); [Apple Developer Forums 776468](https://developer.apple.com/forums/thread/776468)
- UIKit "usually" delivers touches at about 60 Hz, but "some devices are capable of recording touch information at up to 240 Hz". The extra samples arrive as coalesced touches — [Apple: Getting high-fidelity input with coalesced touches](https://developer.apple.com/documentation/uikit/getting-high-fidelity-input-with-coalesced-touches.md)
- PencilKit keeps per-point `force`, `azimuth`, `altitude`, `opacity`, `size` and `timeOffset` (seconds, double) — [Apple: PKStrokePoint](https://developer.apple.com/documentation/pencilkit/pkstrokepoint-swift.struct.md)
- tldraw and Excalidraw both store raw input points plus pressure and compute the visible outline at render time: tldraw has an `isPen` flag and z, Excalidraw has `pressures` and `simulatePressure` — [tldraw TLDrawShape.ts](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/tlschema/src/shapes/TLDrawShape.ts); [Excalidraw types.ts](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/types.ts)
- perfect-freehand derives the outline from points and options (`thinning`, `smoothing`, `streamline`, `simulatePressure`). Given the same points and options it yields the same outline, since `getStroke` = `getStrokePoints` + `getStrokeOutlinePoints` — [perfect-freehand README](https://github.com/steveruizok/perfect-freehand)
- Quick, Draw! keeps real-valued px and ms timing in raw form. The simplified 0–255 / RDP ε=2 form exists for ML input, not for fidelity — [quickdraw-dataset README](https://github.com/googlecreativelab/quickdraw-dataset)
- **Precision sweep (local benchmark):** binary per-stroke planar varint, gzip level 6, KiB.

  | xyScale / pressure levels | typical 300×80 @240 Hz | typical @60 Hz | heavy 100k pts @240 Hz |
  |---|---:|---:|---:|
  | 1 px / 256 | 35.7 | 49.7 | 146.3 |
  | 1 px / 1024 | 41.6 | 56.5 | 170.4 |
  | 1/2 px / 1024 | 45.5 | 63.3 | 186.3 |
  | 1/4 px / 256 | 44.9 | 68.9 | 183.0 |
  | **1/4 px / 1024** | **51.5** | **72.2** | **210.0** |
  | 1/8 px / 1024 | 58.4 | 83.8 | 238.4 |
  | 1/16 px / 1024 | 67.3 | 95.0 | 275.3 |

  Uncompressed size barely moves (about 98 KiB typical), because the deltas still fit 1-byte varints. Each doubling of xy precision adds roughly 1 bit per coordinate after gzip (about 6–7 KiB per 24k points) — [local benchmark `sizes.mjs`, see scope note]
- Math functions such as `Math.sin` have implementation-dependent precision, so results can differ slightly between JS engines — [MDN: Math](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math)

### Inferences
**Coordinates**
- The 768 canvas is shown on DPR 2–3 screens at about 1536–2304 device px. Integer canvas px is then a 2–3 device-px grid, which shows as stair-stepping on slow, smoothed stylus strokes.
- Quarter px (0.75 device px at DPR 3) is below visibility. 1/8 px buys nothing visible for +13% size.
- Integer coordinates stay the right choice for *legacy* v1/v2 strokes, which are read as `xyScale = 1`.

**Pressure**
- 10 bits (1024 levels) covers hardware pressure resolution better than 8 bits, and the cost is small (about +6 KiB typical).
- Store an explicit per-stroke `hasPressure` flag rather than a constant 0.5 column. This matches tldraw's `dim: 2` lesson (about 33% of per-point bytes wasted otherwise).
- Mouse and finger strokes would omit the column and set `simulatePressure` in the brush, as Excalidraw does.

**Time**
- Integer ms relative to stroke start (as Quick, Draw! does relative to the drawing start). Use `PointerEvent.timeStamp` from coalesced events, rebased so the first point of each stroke is 0.
- Each stroke's start is stored as a delta from the previous stroke's start. A 32-bit unsigned ms covers about 49 days, so it is enough.
- Do not store wall-clock time inside the document; `createdAt` belongs in Postgres.

**Optional channels**
- Tilt/azimuth/altitude are optional. A future brush (calligraphy, pencil shading) could use them, so the format should reserve a channel bitmask with `altitude`/`azimuth` as 8-bit optional channels, and v3.0 should not emit them by default.

**Raw vs smoothed**
- Store raw coalesced samples, after dropping exact duplicates and points that fall outside the canvas.
- No RDP and no compaction at write time. That would destroy replay timing and pressure, which was the v1/v2 compaction mistake.
- Smoothing (streamline) and the pressure-to-width curve live in the brush implementation identified by `brushId@version`. A renderer change ships as `pen@2`, and old documents keep rendering with `pen@1`.

**Eraser**
- `tool/brush = eraser@1` with no color. Its semantics are "remove ink down to the background".
- On today's single-layer solid-background canvas it renders identically as a background-colored stroke, which keeps Canvas2D and resvg trivially deterministic.
- If layers or transparent exports arrive later, the renderer can switch to `destination-out` / an SVG mask without touching stored data.

**Per-stroke record**
- Fields: `brush` (index into a document brush table), `color` (24-bit RGB, absent for the eraser), `size` (base diameter, integer 1..64 or quarter-px fixed-point), optional `opacity`, flags (`hasPressure`, `pointerType` mouse/touch/pen), `startDeltaMs`, `n`, then the channel columns.
- Keep `pointerType`: it drives `simulatePressure` and helps analytics and debugging.

**Determinism**
- Integer storage makes parsing and validation exact.
- Rendering determinism only matters at the server, because the server-rendered raster is canonical. Pin the outline algorithm (vendored perfect-freehand-style code, versioned by brush id) and emit the same SVG path string on client and server, so resvg and Canvas2D (`Path2D(svgPath)`) fill the same polygon.
- Avoid relying on bit-exact cross-engine `Math.sin` results. Any differences are sub-ULP and vanish after rasterization.

### Gaps
- I found no authoritative 2026 source on actual pressure resolution per device as exposed through Pointer Events (iPad + Apple Pencil Pro, Galaxy Tab + S Pen). The 10-bit choice is a reasoned inference, not measured.
- I did not measure real-device coalesced event rates on iPadOS 26 Safari or Samsung Internet. The 240 Hz figure is UIKit-native, and Safari's delivered rate is only forum-reported. The sibling notes file `dibujo_movil_stylus.md` covers input in depth.

---

## 3. Encodings: JSON vs delta+varint custom binary vs CBOR / MessagePack / Protobuf / FlatBuffers — size estimates and debuggability

### Takeaway
After gzip, **layout matters far more than serialization format**:
- **Columnar delta beats per-point tuples by about 2.8×**, whatever the container.
- **CBOR and MessagePack** of the natural tuple structure compress *no better* than JSON tuples (7.3–7.4 B/pt after gzip vs 7.6).
- **A purpose-built per-stroke planar zigzag-varint binary** is smallest at **2.1 B/pt gzip**. That is 51.5 KiB for a typical 24k-point drawing *with* pressure and timing — smaller than today's stored v1 (102 KiB base64(gzip), positions only).
- **JSON with columnar delta arrays** is the debuggable runner-up at 2.7 B/pt gzip (64.8 KiB).

Recommendation: a small custom binary (`NTL3`), length-prefixed per stroke so it can be streamed and appended, with a TypeScript codec of about 150 lines plus a JSON "debug view" for tests and tooling.

### Cited Findings
- **Size table (local benchmark), quarter-px xy, 10-bit pressure, ms time.** "today" = v1 JSON with integer xy and no pressure/time, for reference. Sizes in KiB.

**Typical: 300 strokes × ~80 pts (24,202 pts), 240 Hz stylus**
| encoding | raw | gzip-6 | gzip-9 | brotli-5 | brotli-11 | zstd-3 | zstd-19 | B/pt gzip |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| today v1 JSON (int xy only) | 244.0 | 76.6 | 75.8 | 67.4 | 38.2 | 78.8 | 51.1 | 3.24 |
| v3 JSON tuples `[x,y,p,t]` | 468.3 | 180.6 | 180.0 | 175.5 | 114.9 | 188.0 | 137.3 | 7.64 |
| v3 JSON flat `[x,y,p,t,…]` | 421.1 | 168.9 | 168.6 | 167.1 | 115.1 | 176.5 | 133.0 | 7.15 |
| v3 JSON columnar absolute | 426.1 | 135.8 | 135.4 | 126.8 | 87.1 | 134.0 | 100.9 | 5.75 |
| **v3 JSON columnar delta** | 272.1 | **64.8** | 63.5 | 67.9 | 54.7 | 74.5 | 57.4 | **2.74** |
| CBOR (cbor-x) tuples | 293.4 | 175.3 | 175.3 | 154.0 | 124.6 | 175.8 | 167.0 | 7.42 |
| MessagePack tuples | 281.0 | 173.4 | 173.4 | 154.8 | 118.8 | 175.7 | 165.5 | 7.34 |
| binary varint, interleaved | 98.0 | 65.4 | 65.4 | 64.2 | 58.0 | 65.6 | 63.2 | 2.77 |
| **binary varint, per-stroke planar** | 98.0 | **51.5** | 51.2 | 50.5 | 47.2 | 53.0 | 47.6 | **2.18** |
| binary varint, whole-doc planar | 98.0 | 47.5 | 47.2 | 46.9 | 44.4 | 51.3 | 44.8 | 2.01 |

- Today's actual stored form, base64(gzip(v1 JSON)), is **102.1 KiB**. A tldraw-style Float16 delta of (x, y, p) without time would be 143.6 KiB raw, or 191.4 KiB as base64 — [local benchmark `sizes.mjs`]

**Same drawing at 60 Hz (finger/mouse)**
- Today's stored form: 115.0 KiB
- v3 JSON tuples gzip: 190.5
- v3 JSON columnar delta gzip: 87.8
- binary per-stroke planar gzip: 72.2 (brotli-11: 65.1)
- whole-doc planar gzip: 69.2

At 60 Hz the deltas are larger and less regular, so every encoding compresses worse — [local benchmark `sizes.mjs`]

**Heavy: 1,250 strokes, 100,413 pts, 240 Hz**
| encoding | raw | gzip-6 | brotli-11 | zstd-19 |
|---|---:|---:|---:|---:|
| today v1 JSON | 1010.7 | 313.2 | 155.0 | 206.6 |
| v3 JSON tuples | 1943.2 | 745.1 | 473.2 | 563.1 |
| v3 JSON columnar delta | 1131.1 | 264.9 | 217.7 | 223.8 |
| CBOR tuples | 1216.1 | 723.8 | 522.7 | 632.7 |
| MessagePack tuples | 1164.3 | 716.1 | 499.6 | 640.8 |
| binary per-stroke planar | 406.6 | 210.0 | 187.6 | 190.5 |
| binary whole-doc planar | 406.6 | 189.3 | 175.6 | 178.4 |

- Today's stored base64 form for the heavy document is 417.6 KiB. Today's v1 JSON at 100k points is already 1,010 KiB, right at the 1 MiB decompressed limit, and any v3 JSON tuple form would exceed it (1.9 MiB) — [local benchmark `sizes.mjs`]
- **Delta-of-delta** (second differences on x/y/t, as ISF does and as InkML's `"` prefix allows) on the per-stroke planar binary, gzip / brotli-11 in KiB:

  | | first deltas | second deltas |
  |---|---|---|
  | 240 Hz | 50.3 / 45.9 | 47.9 / 41.7 |
  | 60 Hz | 70.8 / 63.8 | 63.7 / 56.6 |

  That is 5–10% smaller — [local benchmark `dd.mjs`]; ISF precedent: [dotnet/wpf AlgoModule.cs](https://github.com/dotnet/wpf/blob/main/src/Microsoft.DotNet.Wpf/src/PresentationCore/MS/internal/Ink/InkSerializedFormat/AlgoModule.cs); InkML precedent: [W3C InkML](https://www.w3.org/TR/InkML/)
- **Codec speed (local benchmark, 99,662 pts, V8 with code generation disabled as on Workers):**
  - binary encode: 0.80 ms
  - gunzip of the binary: 0.72 ms
  - binary decode with full validation inline (stroke count, size range, per-point bounds, totals): 1.32 ms
  - `JSON.parse` of columnar-delta JSON (1.1 MiB): 1.90 ms
  - `JSON.parse` of tuple JSON (1.9 MiB): 3.73 ms

  [local benchmarks `binperf.mjs`, `perf.mjs`]
- tldraw chose a compact delta-encoded binary inside base64 strings within its JSON records, and needed five schema migrations to get there. That shows the cost of changing encodings after launch — [tldraw TLDrawShape.ts](https://raw.githubusercontent.com/tldraw/tldraw/main/packages/tlschema/src/shapes/TLDrawShape.ts)

### Inferences
**Why per-stroke planar**
- It is about 8% larger than whole-document planar, but every stroke is self-contained. A stroke can be appended to a draft, streamed to other players the moment it ends (or in partial chunks), and decoded without the rest of the document.
- Future game modes (exquisite corpse, live replicate) need exactly that, so per-stroke planar is the better default.

**Why not CBOR, MessagePack, Protobuf or FlatBuffers**
- CBOR and MessagePack mostly remove JSON punctuation, and gzip already removes most of that. They do not delta-encode, which is where the win is.
- Protobuf `sint32` packed repeated fields give zigzag varints for free, so a Protobuf schema with per-stroke `repeated sint32 dx, dy, dp; repeated uint32 dt` would land within a few percent of the custom binary. The cost is a codegen toolchain (protobuf-es / ts-proto) and a dependency, for a 6-field message.
- FlatBuffers offers zero-copy access, but its fixed-width fields are larger before compression and the benefit is irrelevant at 100k points (decode is about 1 ms).
- *I did not benchmark Protobuf or FlatBuffers*; the above is inference from their wire formats.

**Debuggability trade-off**
- A custom binary needs a `decodeToDebugJson()` helper and golden fixtures. Those are cheap, and they give the TDD workflow readable snapshots.
- Columnar-delta JSON is readable but semantically opaque, since deltas are not positions. It is still 26% larger gzipped (64.8 vs 51.5 KiB typical; 264.9 vs 210.0 KiB heavy) and 1.4× slower to parse.
- If the owner values "open the file in a text editor" above the roughly 25% size difference, columnar-delta JSON is an acceptable v3. It is still smaller than today's stored form and carries pressure and time.

**Delta-of-delta**
- It saves 5–10% for one more transform. It is optional; I would leave it out of v3.0 for simplicity, but reserve a per-channel "predictor" byte in the header so v3.x can add it without a new major version.

#### Consolidated v3 proposal (synthesis of sections 1–7)

**Document header**
- magic `NTL3` (4 B), `formatVersion` u8 = 3, `flags`
- `kind` u8 (artwork / avatar), `width`/`height` varint, `background` RGB (3 B)
- `xyScale` u8 = 4, `pressureMax` varint = 1023, `timeUnit` = ms
- **brush table:** count plus UTF-8 ids such as `pen@1`, `eraser@1`
- **lineage table:** for each ancestor, `{artworkId (uuid, 16 B), strokeCount}`, which replaces v2's base/tail split
- `strokeCount`

**Per stroke**
- `byteLength` varint (allows skipping and streaming)
- `brushIdx` u8, `flags` u8 (`hasPressure`, `pointerType` 2 bits, `hasTilt`)
- `color` RGB (omitted for the eraser), `size` varint
- `startDeltaMs` varint, `n` varint
- channel columns:
  - x: zigzag-varint deltas
  - y: zigzag-varint deltas
  - t: unsigned varint deltas
  - pressure: zigzag-varint deltas, only if `hasPressure`

The first value of each column is the absolute value (delta from 0).

**Container and debug view**
- The whole document is gzip'd (see section 4).
- A canonical JSON debug view, `{version:3, kind, …, brushes:[…], lineage:[…], strokes:[{brush, color, size, start, pointer, x:[abs…], y:[…], t:[…], p:[…]}]}`, is produced by the codec for tests, admin tooling and a "download JSON" button.

**Limits:** express them in points, strokes and bytes of the *binary* form, for example 5k strokes, 100k points and 512 KiB raw binary. Do not keep JSON-byte limits, which v3 JSON would blow through.

### Gaps
- I did not benchmark Protobuf (`@bufbuild/protobuf`) or FlatBuffers. Their sizes are inferred from their wire formats.
- Real production drawings were not available. Ratios on real stylus data are likely better (smoother pressure, more regular timestamps) than on my noisy synthetic data, but this is unverified.

---

## 4. Compression in 2026: which formats CompressionStream/DecompressionStream support in Chrome, Safari, Firefox and Cloudflare Workers; ratios on JSON vs binary

### Takeaway
**gzip, deflate and deflate-raw are the only formats available everywhere** (browsers since 2023 Baseline, plus Workers). **Brotli** is in the WHATWG spec and shipped in Safari 18.4 and Firefox 147, but **not in Chrome and not in Workers' CompressionStream**. **zstd** is not in the spec, and only Firefox 138 has it behind a pref. On delta-varint binary, gzip-6 comes within 3–9% of brotli-11 and zstd-19, so gzip loses almost nothing. Brotli's big wins (up to 50%) only appear on verbose JSON, which the binary avoids.

### Cited Findings
**CompressionStream format support (MDN BCD)**
| format | Chrome | Firefox | Safari | Bun |
|---|---|---|---|---|
| gzip, deflate | 80 | 113 | 16.4 | 1.3.3 |
| deflate-raw | 103 | 113 | 16.4 | 1.3.3 |
| brotli | not supported (impl. bug crbug.com/463397980) | 147 | 18.4 | 1.3.3 |
| zstd | no | 138, behind `dom.compression_streams.zstd.enabled` ("experimental", not standards-track) | no | 1.3.3 |

- Node has brotli since 24.7.0 and Deno since 2.7 — [MDN BCD CompressionStream.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/CompressionStream.json)
- The WHATWG Compression spec (last updated 19 Oct 2026) defines `brotli`, `deflate`, `deflate-raw` and `gzip`, and no zstd — [WHATWG Compression Standard](https://compression.spec.whatwg.org/)
- Safari 18.4: "Compression Streams now supports compressing and decompressing data using the Brotli format" — [WebKit: Safari 18.4 features](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- Interop 2027 proposal #1467 (opened 23 Sep 2026) asks to "make Brotli compression and decompression work across browsers" and notes that "Chrome support is still missing" — [web-platform-tests/interop#1467](https://github.com/web-platform-tests/interop/issues/1467)
- I found no blink-dev "Intent to Ship" for Brotli in CompressionStream — [search: blink-dev intents](https://groups.google.com/a/chromium.org/g/blink-dev/c/xdVm8c2GOMQ/m/DsIZc8mhkPcJ) (only the 2015 HTTP Brotli intent and the deflate-raw ship commit turned up: [Chromium commit](https://chromium.googlesource.com/chromium/src/+/e0c8013c9fdefeb1ec40b5e43d21e78bbe634322))
- **Workers:** CompressionStream/DecompressionStream "support the deflate, deflate-raw and gzip compression methods" — [Cloudflare Workers: Web standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/). The workerd source enforces `format == "deflate" || format == "gzip" || format == "deflate-raw"` with no compatibility flag; a `getStrictCompression()` flag only changes decompression strictness — [workerd compression.c++](https://raw.githubusercontent.com/cloudflare/workerd/main/src/workerd/api/streams/compression.c++)
- Workers does expose Brotli through the Node-compatible `node:zlib` module — [Cloudflare Workers: node:zlib](https://developers.cloudflare.com/workers/runtime-apis/nodejs/zlib)
- To serve already-compressed bytes from a Worker, set `encodeBody: "manual"` on the Response; the default "automatic" makes the runtime compress according to `Content-Encoding` — [Cloudflare Workers: Response](https://developers.cloudflare.com/workers/runtime-apis/response)
- **Ratios (local benchmark, typical 240 Hz document):**

  | encoding | gzip-6 | brotli-11 | zstd-19 |
  |---|---:|---:|---:|
  | binary per-stroke planar | 51.5 | 47.2 (−8%) | 47.6 |
  | columnar-delta JSON | 64.8 | 54.7 (−16%) | 57.4 |
  | JSON tuples | 180.6 | 114.9 (−36%) | 137.3 |
  | today's v1 JSON | 76.6 | 38.2 (−50%) | 51.1 |

  Brotli-5 and zstd-3 (the "fast" levels) are no better than gzip-6 on these inputs. gzip-9 gains under 1% over gzip-6 — [local benchmark `sizes.mjs`]
- **Speed (local benchmark):** gunzip of a 100k-point binary takes 0.72 ms with node zlib. `DecompressionStream('gzip')` through web streams in Node averaged 4.27 ms including stream overhead (not measured in workerd) — [local benchmark `binperf.mjs`]

### Inferences
- **Use gzip** via CompressionStream on both client and Worker (no WASM, no dependency).
  - CompressionStream exposes no level parameter, so in practice you get the zlib default. That is fine, because gzip-9 adds less than 1%.
  - deflate-raw saves the 18-byte gzip header/trailer. That is not worth losing the `1f 8b` magic, which lets one reader tell legacy rows apart.
- **Optional brotli precompression:** the Worker could brotli-11 a document via `node:zlib` (nodejs_compat) when writing to R2, and serve it with `Content-Encoding: br` + `encodeBody:"manual"` to clients that accept br. On the binary format that saves only about 8% for extra CPU and a second code path, so it is not worth it. It would only be worth revisiting if the format stayed JSON (−16% to −36%).
- **No zstd in the document pipeline before 2027.**

### Gaps
- I did not confirm whether Chrome has a Brotli CompressionStream implementation behind a flag or in progress beyond the crbug link in BCD.
- I did not time DecompressionStream inside workerd itself; the Node web-streams timing is only a proxy.

---

## 5. Validation on Workers: Zod 4 vs Valibot vs ArkType for documents up to 100k points; CPU time under Workers limits

### Takeaway
On Workers, **the JIT advantages of ArkType and compiled Zod disappear**. Workers forbids `eval`/`new Function`, and both libraries silently fall back to interpreted validators. Under that restriction, every schema library takes about **9–27 ms to validate 100k points**, while a **hand-written typed loop (or validation inside the binary decoder) takes 0.36–1.3 ms**.

Recommended split:
- Zod (already in the project) for the small header, stroke metadata and API payloads.
- Hand-written bounds/length/monotonicity checks over the point columns, fused into the binary decoder.

That keeps worst-case validation at about 1–2 ms CPU per 100k-point document.

### Cited Findings
- Workers disallows `eval()` and `new Function` "for security reasons", and likewise `WebAssembly.compile`/`instantiate` from a buffer — [Cloudflare Workers: Web standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/). The error users see is "EvalError: Code generation from strings disallowed for this context" — [Cloudflare Community thread](https://community.cloudflare.com/t/evalerror-code-generation-from-strings-disallowed-for-this-context/356430)
- **Workers limits:** Free 10 ms CPU per request. Paid defaults to 30 s and can be configured up to 5 min. 128 MB memory per isolate — [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- **Zod 4.5 (28 Aug 2026)** introduced `z.compile()`, which compiles "in-process" and uses `new Function`; environments that block it must install a parser generated elsewhere via `z.withParser()`. **Zod 4.6 (9 Sep 2026)** added a boolean-only `.validate()`. Release benchmarks (Moltar parseSafe): compiled Zod 47.5M ops/s, Typia 45.3M, Valibot 1.8M, ArkType 152k — [InfoQ, Oct 2026](https://infoq.com/news/2026/10/zod-schema-compliation)
- ArkType's homepage claims "20x faster than Zod 4"; reviewers call that a vendor benchmark — [OpenReplay: ArkType vs Zod](https://blog.openreplay.com/arktype-vs-zod/)
- **Local benchmark,** 99,662 points, median ms. "JIT allowed" = normal V8; "Workers-like" = `--disallow-code-generation-from-strings`. Versions: zod 4.6.7, valibot 1.5.0, arktype 2.2.9.

| validator | JIT allowed | Workers-like |
|---|---:|---:|
| Zod 4 `parse`, columnar-delta schema + semantic loop | 12.33 | 12.76 |
| Zod 4 `parse`, tuple schema with per-point bounds | 27.24 | 27.12 |
| Zod 4 `z.compile(columnar)` | **0.24** | **12.75** (silent fallback) |
| Valibot `parse`, columnar + semantic loop | 8.43 | 8.55 |
| Valibot `parse`, tuples | 13.57 | 13.41 |
| ArkType, columnar + semantic loop | **0.36** | **9.15** (silent fallback) |
| ArkType, tuples | **0.66** | **19.82** (silent fallback) |
| hand-rolled columnar validator (types + bounds + lengths + totals) | 0.37 | 0.36 |
| binary decode with validation inline | — | 1.32 |
| `JSON.parse` columnar-delta (1.1 MiB) / tuples (1.9 MiB) | 1.82 / 3.62 | 1.90 / 3.73 |

  [local benchmark `perf.mjs`, `binperf.mjs`]
- The current schema already pairs Zod structural parsing with a `superRefine` loop for bounds checks (x ≤ width, y ≤ height), i.e. per-point tuple validation, the slowest shape in the table — [repo: document.ts `DrawingDocumentSchema`](../../../apps/web/src/lib/features/stroke-json/document.ts)

### Inferences
**Which library**
- The choice between schema libraries is nearly irrelevant for the point payload on Workers; what matters is *not* running a per-element schema over 100k numbers.
- Zod stays: it is already used, and its header/metadata validation is microseconds. Switching to Valibot would save about 30% of interpreted time on point arrays, but those arrays should not go through a schema at all.

**CPU budget**
- Today's design costs about 27 ms per 100k points with tuples in Zod. That fails the Free plan's 10 ms on its own, and it is a large share of a request on Paid.
- With the fused decoder, the worst case is about 1.3 ms decode+validate plus about 0.7 ms gunzip on an M5 Pro. Absolute Workers numbers will differ, but the roughly 10–20× gap should hold.

**Validation rules worth enforcing in the decoder**
- magic and version
- kind consistent with the dimensions
- brush index < table length
- stroke count ≤ 5,000, n between 1 and 5,000, total ≤ 100,000
- each absolute x/y within 0..width·scale / 0..height·scale
- pressure within 0..pressureMax
- time deltas ≥ 0 (unsigned varint), and stroke start deltas ≥ 0
- varints ≤ 5 bytes, no trailing bytes, byte length consistent with the per-stroke `byteLength`
- decompressed size cap enforced *while streaming* (a zip-bomb guard), as the Rust codec did

**Do not use** `z.compile()` or ArkType JIT expectations in Worker code. If they are used client-side, results differ by environment, which is a subtle source of "works locally" performance surprises.

### Gaps
- I did not run the benchmark inside workerd / `wrangler dev`, and Workers CPUs are not M5 Pro class. Treat absolute numbers as optimistic.
- Typia (AOT codegen, eval-free) was not benchmarked. It would also avoid the eval restriction, but needs a build-time transformer.

---

## 6. Storage: R2 objects vs Postgres bytea/jsonb; write ordering against torn writes; versioning; migrating existing v1/v2 base64-gzip rows

### Takeaway
Store each document as an **immutable R2 object with a content-addressed key** (`drawings/{sha256}.ntl`, gzip bytes, no base64). Then **commit a small Postgres row** that points at it, written last as the commit marker. Postgres holds only `{document_key, document_sha256, format_version, stroke_count, point_count, duration_ms, byte_length}`.

This removes the large-Bind failure that forced today's chunked base64 appends, cuts 33% base64 overhead, and keeps the feed queries from dragging documents through the pooler.

Migrate legacy rows **byte-for-byte**: base64-decode the TEXT into the original gzip bytes, upload them unchanged under the same keying scheme, and record `format_version = 1|2`. A single reader sniffs the gzip payload and dispatches to the v1/v2 JSON or v3 binary decoders. Never migrate rows whose `drawing_version IS NULL` (torn).

### Cited Findings
**R2 semantics**
- Read-after-write and list-after-write are strongly consistent ("readers will immediately see the latest object globally"). For concurrent writes to the same key, "the last writer to complete 'wins'". Worker bindings bypass the cache. Custom domains with caching can serve stale objects or cached 404s until purge or TTL — [Cloudflare R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/)
- `put()` options:
  - `onlyIf` (`etagMatches`, `etagDoesNotMatch`, `uploadedBefore`, `uploadedAfter`, or conditional Headers). "If the condition check for `put()` fails, `null` will be returned instead of the `R2Object`."
  - `httpMetadata`, `customMetadata: Record<string,string>`
  - integrity hashes `md5|sha1|sha256|sha384|sha512` ("Only a single hashing algorithm can be specified at once")
  - `storageClass`

  `R2Object` exposes `etag`, `httpEtag`, `uploaded`, `version` and `checksums` — [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- **R2 limits:** key ≤ 1,024 bytes; object metadata ≤ 8,192 bytes; single-part upload ≤ 5 GiB; writes to the same key limited to 1 per second (HTTP 429 above that) — [Cloudflare R2 limits](https://developers.cloudflare.com/r2/platform/limits/)

**Why the current Postgres TEXT storage hurt**
- The Supavisor session pooler deterministically closed connections on large Binds. A 99,684-char `drawing_document` INSERT always died, the largest document that ever worked was 50,380 chars, and the threshold lies in between. The fix sends the INSERT with a null document, then appends 16,384-char base64 chunks guarded by expected length, then sets `drawing_version` only when the stored length matches. Readers treat versionless documents as missing.
- Known follow-ups:
  - the avatar save still sends its full document (up to about 342 KiB) in one Bind
  - feed queries fetch `drawing_document` per row (up to about 7 MB per feed page)

  — internal project memory: ntl-connection-closed-publish.md (memoria local del proyecto, fuera del repo)
- Columns today are `drawing_document text` and `drawing_version integer` — [repo: apps/web/src/lib/server/db/schema.ts](../../../apps/web/src/lib/server/db/schema.ts)
- The remaster plan is to move docs and media to R2 keeping keys, and to drop the Rust/WASM codec in favour of Zod + CompressionStream. Existing rows are base64(gzip(JSON)) v1/v2, and a NULL version marks a torn write — internal project memory: ntl-remaster-2026-10.md (memoria local del proyecto, fuera del repo)
- Postgres compresses large varlena values (> about 2 kB) in TOAST with pglz, or lz4 if configured. jsonb stores a parsed binary tree that cannot hold opaque binary — [PostgreSQL docs: TOAST](https://www.postgresql.org/docs/current/storage-toast.html)
- **Base64 overhead (local benchmark):** today's typical document is 76.6 KiB gzip, but 102.1 KiB once base64'd for TEXT. The heavy one is 313 KiB gzip and 418 KiB base64 — [local benchmark `sizes.mjs`]

### Inferences
**Option comparison**
| option | pros | cons |
|---|---|---|
| R2 object, content-addressed (recommended) | immutable, so CDN- and browser-cacheable forever (`Cache-Control: public, max-age=31536000, immutable`); dedupes identical forks automatically; integrity via the key itself (verify sha256 on read in tests); no large Binds; the doc downloads in parallel with metadata, straight from the edge; custom metadata (≤ 8 KiB) can carry `format`, `kind`, `strokes`, `points` for tooling | two-system consistency (solved by write ordering below); needs an orphan sweep |
| Postgres `bytea` | one transactional system; no base64 | the large-Bind exposure (now on Hyperdrive, but still a big row through the pool); bloats feed queries unless every query avoids the column; TOAST recompression wastes CPU on already-gzipped bytes |
| Postgres `jsonb` | queryable | largest on disk; JSON-only, so it cannot hold the binary; parse cost on every write; nobody needs to query inside strokes. Reject |

**Write ordering (torn-write-free)**
1. The client encodes the document and posts the gzip bytes. The Worker re-decodes and validates it (decoder ≈ 2 ms) and computes sha256 (WebCrypto).
2. `R2.put(key = "drawings/" + sha256hex + ".ntl", bytes, { sha256, onlyIf: { etagDoesNotMatch: "*" }?, httpMetadata: { contentType: "application/vnd.ntl.drawing", contentEncoding: "gzip" }, customMetadata: { format: "3", kind, strokes, points } })`.
   - A `null` result means the object already exists, which is fine because the key is the content.
   - Whether `etagDoesNotMatch:"*"` is honored as "create only" is an assumption to verify. Plain overwrite of identical content is harmless, apart from the 1-write/s/key limit.
3. Only after R2 confirms (strong read-after-write), run a single small transaction: insert the artwork row with `document_key`, `document_sha256`, `format_version` and the counts, plus lineage.
4. If step 3 fails, the R2 object is an orphan. A cron Worker deletes `drawings/*` objects older than 24 h that no row references (list plus an `IN` lookup).
5. Readers never see a torn document: a row exists only if its object does, and objects are never mutated.
6. Drop `drawing_version IS NULL` semantics for new rows. The chunked-append machinery and its three repository methods can then be deleted.

**Key scheme**
- `sha256` content addressing is better than `{artworkId}/v3` keys, because a document is immutable once published and forks of unchanged parents share bytes.
- The remaster note says "keeping keys" for media. Documents had no keys before, so content addressing is free to choose.
- Prefix by format family (`drawings/v1/…`, `drawings/v3/…`) only if listing by format is useful; the version also lives in metadata and in the bytes.

**Single reader (accepts v1/v2/v3)**
1. `bytes[0..1] == 1f 8b` → gunzip with a streaming size cap. Otherwise, for legacy TEXT not yet migrated, base64-decode first.
2. Inspect the decompressed bytes. If they start with `NTL3`, use the binary decoder. If they start with `{`, `JSON.parse` and dispatch on `version` 1/2 to the existing Zod schemas, ported unchanged.
3. Normalize everything to the in-memory v3 model. v1/v2 strokes become `xyScale = 1`, `hasPressure = false`, no time column (flag `timing: none`), `pointerType` unknown, brush `round@0` (the legacy polyline renderer).
4. v2 `base`/`tail` becomes lineage `[{parent, strokeCount: base.length}]`.

**Migration job**
- One idempotent script (a Worker or local bun script using the Hyperdrive/direct URL) loops over rows where `drawing_version IS NOT NULL AND document_key IS NULL`:
  1. base64-decode the TEXT
  2. verify gunzip + parse in the old schema, logging failures rather than fixing them
  3. compute sha256 over the **gzip bytes as stored**
  4. put to R2
  5. `UPDATE … SET document_key, document_sha256, format_version = drawing_version WHERE id = ? AND document_key IS NULL`
- Keep the TEXT column until a verification pass confirms every migrated row's R2 object re-hashes to its sha256. Drop it in a later migration (an AGENTS.md-compliant Drizzle schema change).
- Rows with `drawing_version IS NULL` stay document-less, as readers already treat them.
- Do *not* upconvert legacy docs to v3 bytes. Keeping the original bytes preserves auditability, and the reader cost is one extra JSON path. Upconvert lazily only when a legacy artwork is forked, since the fork is written as v3 with inherited strokes marked `timing: none`.

**Versioning**
- `format_version` lives in three places: the bytes (magic + u8), the R2 `customMetadata.format` and the Postgres column.
- The bytes are authoritative; the other two exist for queries and tooling.
- Minor, additive changes (new optional channel, new brush id) use flag bits and the brush table without bumping the major. A major bump needs a new magic (`NTL4`). The tldraw history shows the value of designing an "unknown optional field" story from day one (its `dim` field broke older clients).

### Gaps
- I did not verify whether R2 `onlyIf` on `put()` supports `If-None-Match: *` (create-only). The docs list `etagDoesNotMatch` but do not mention the wildcard.
- I did not verify the Hyperdrive behavior for large Binds (the original failure was Supavisor). It matters only if bytea is chosen.
- I measured no R2 GET latency from mobile networks. Edge caching of immutable keys behind a custom domain should be checked against the caveats above.

---

## 7. Timelapse replay: efficient client replay (idle-gap compression, speed controls) and client-side export to video/GIF (WebCodecs/MediaRecorder on Safari and Chrome in 2026)

### Takeaway
With per-point ms timing and per-stroke start deltas, a timelapse is a pure client-side function of the document:
- **Timeline:** build a cumulative timeline, compress idle gaps (for example clamp any pause above 1 s to 250–400 ms), and offer speed presets (1×/2×/4×/"fit to N seconds").
- **Rendering:** draw committed strokes into a cached offscreen canvas, redrawing only the in-progress stroke each frame, with periodic keyframe bitmaps for fast seeking.
- **Export:** use **WebCodecs `VideoEncoder`** (Chrome 94, Firefox 130, Safari 16.4) plus a muxer such as Mediabunny, rendering frames offline faster than real time. Fall back to `MediaRecorder` on `canvas.captureStream()`, which is real-time only (Safari records MP4/H.264, and WebM since 18.4).

### Cited Findings
- Quick, Draw! raw stores per-point `t` in ms since the first point, enough to replay drawing order and speed — [quickdraw-dataset README](https://github.com/googlecreativelab/quickdraw-dataset)
- PencilKit stores `timeOffset` per point relative to stroke start (seconds) — [Apple: PKStrokePoint](https://developer.apple.com/documentation/pencilkit/pkstrokepoint-swift.struct.md)
- Krita's raster recorder handles idle time implicitly by snapshotting only "when the image changes". It also offers a "Real Time Capture Mode" to match drawing speed, and an option to hold the final frame — [Krita docs: Recorder docker](https://docs.krita.org/en/reference_manual/dockers/recorder_docker.html)
- **WebCodecs `VideoEncoder`** (constructor, `configure`, `encode`, `isConfigSupported`) is in Chrome/Edge 94, Firefox 130, Safari and Safari iOS 16.4, with no partial-implementation notes — [MDN BCD VideoEncoder.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/VideoEncoder.json)
- **Mediabunny** is "a pure TypeScript library for reading and writing media" that uses WebCodecs for hardware-accelerated encoding. It writes MP4 and other containers, accepts canvas input, and is the successor to mp4-muxer/webm-muxer — [mediabunny.dev](https://mediabunny.dev/); [Mediabunny guide](https://mediabunny.dev/guide/introduction)
- **Safari MediaRecorder:** from 14.1 to 18.3 it was limited to MP4 with H.264/AAC. Safari 18.4 added WebM (Opus with VP8/VP9) and "video tracks in H264, HEVC, and AV1 (for devices with AV1 hardware support)" — [WebKit: MediaRecorder API](https://webkit.org/blog/11353/mediarecorder-api/); [WebKit: Safari 18.4 features](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- **Chrome MediaRecorder:** a Feb 2025 blink-dev Intent to Ship says MediaRecorder "now supports both MP4 and Matroska muxer types" with H.264/HEVC mime types, and HEVC depends on OS support — [blink-dev: H26x codec support for MediaRecorder](https://groups.google.com/a/chromium.org/g/blink-dev/c/YJ1QijNiHeM/m/3EhMjMVwAgAJ)
- Runtime detection via `MediaRecorder.isTypeSupported()` is recommended because accepted formats vary by version. One unverified report says Safari 17/18 produced empty MP4 output when recording a canvas stream with no audio track — [WebKit MediaRecorder post](https://webkit.org/blog/11353/mediarecorder-api/); [newreleases.io report](https://newreleases.io/project/github/Xunil99/ha-bosch-ebike/release/v1.15.3)
- An old WebKit bug (2023, Safari 16.4) reported a poor frame rate for WebCodecs canvas export muxed with mp4box.js. It is marked resolved — [WebKit Bugzilla 255869](https://bugs.webkit.org/show_bug.cgi?id=255869)
- The repo already keeps committed strokes in an offscreen cache canvas (`ensureCommittedCacheCanvas`), the same pattern replay needs — [repo: pointer-drawing.ts](../../../apps/web/src/lib/features/studio-drawing/pointer-drawing.ts)

### Inferences
**Replay algorithm**
1. Decode once into typed arrays.
2. Build `strokeStart[]` (cumulative ms) and a per-stroke point time column.
3. Map real time to replay time with a gap compressor, e.g. `gap' = min(gap, 400ms)` or `gap' = 400·log1p(gap/400)`. Apply the same compressor inside a stroke when a pause between two points exceeds about 250 ms (pen held still).
4. On each `requestAnimationFrame`, binary-search the replay time to (stroke k, point i):
   - blit the cached canvas holding strokes < k
   - draw stroke k up to point i, plus an interpolated partial segment
   - when stroke k completes, commit it to the cache
5. Seeking: keep an `ImageBitmap` keyframe every about 50 strokes or 2 s of replay time, so a scrub costs at most one keyframe blit plus about 50 stroke redraws.
6. At 100k points a full redraw is only a few tens of ms of Canvas2D work, so keyframes are a nicety rather than a necessity.

**Speed controls**
- 1×, 2×, 4×, 8×, plus "fit to 15/30 s" (computed from the compressed total) as the default for gallery previews.
- Forks: replay inherited strokes (lineage section) in a quick pre-roll, for example the first 10% of the duration or instantly with a "forked from …" chip, then the new author's strokes at chosen speed.
- Legacy v1/v2 documents (`timing: none`): synthesize uniform timing, for example a constant per-point dt and a fixed gap between strokes, so they still get a stroke-order replay.

**Export**
- **Primary path:** an offline loop that renders frame N into an `OffscreenCanvas`, wraps it in a `VideoFrame` with an exact timestamp, then `VideoEncoder.encode`, then Mediabunny MP4 (H.264). It runs faster than real time, gives exact frame pacing and does not depend on the tab staying visible.
- Check `VideoEncoder.isConfigSupported({codec:'avc1.42E01F'…})`, falling back to VP9/WebM if needed.
- **Fallback:** `canvas.captureStream(30)` + `MediaRecorder` with `isTypeSupported` probing. It records in real time, so a 30 s timelapse takes 30 s; add a silent audio track if the empty-output Safari report reproduces.
- **GIF:** no native encoder exists, so it would be a JS/WASM encoder at reduced resolution and palette. MP4 is smaller and better supported for sharing, so I would offer GIF only if users ask.
- **Server-side timelapse video is not needed.** It would be expensive in a Worker, and the document is the source of truth.

**Live streaming (future modes)**
- Because each v3 stroke record is self-contained and length-prefixed, the same encoder can emit a stroke record on `pointerup`. For lower latency it can send partial records every about 50 ms, holding `n` points with timestamps relative to the stroke start.
- These go over a WebSocket (for example a Durable Object room), and receivers feed them into the same replay engine in "live" mode.
- The final saved document is the header plus the concatenated stroke records, so wire format equals storage format (no second codec).

### Gaps
- I found no 2026 measurements of WebCodecs encode throughput on iPad Safari, or of Mediabunny-specific Safari issues.
- I did not confirm Firefox MediaRecorder MP4 output support. WebCodecs + Mediabunny avoids depending on it.
- I found no published UX study of idle-gap compression constants. The 250–400 ms values are design suggestions to tune by user testing.
