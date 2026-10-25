# Canonical server-side rendering of stroke documents and high-quality image delivery for a Pinterest-fluid gallery on Cloudflare (as of October 2026)

Scope note: "Not The Louvre" artworks are 768×768 flat-colour drawings made of round-cap/round-join polylines on a constant cream background (`#fdfbf7` for artworks, `#f5f0e1` for avatars; brush size 1–64; limits 5,000 strokes / 100,000 points / 1 MiB decompressed JSON, per `apps/web/src/lib/features/stroke-json/document.ts`). Today the Worker builds an SVG (`features/stroke-json/svg.ts`), rasterizes with resvg-wasm 2.6.2, then runs up to four AVIF encodes with jsquash 2.1.1 (4:2:0, q70 → q55 → q42 → q32, speed 6) to fit a 100 KiB cap (`server/drawing-document/media.ts`, `server/artwork/config.ts`), and stores a 24 px PNG data URI as a placeholder. Hard constraint: never visibly degrade quality, never serve variants smaller than 768 px.

Own-benchmark methodology (referenced below as **[Own benchmark]**): run in this session on an Apple M5 Pro with Node 24.15 (V8, the same JS/WASM engine as workerd). Three synthetic stroke documents were generated with the app's exact SVG shape (polyline, round caps/joins, cream `#fdfbf7` rect, 12-colour flat palette, brush sizes 3–48): **light** = 25 strokes / 1,520 points / 20 KB JSON; **medium** = 120 strokes / 14,980 points / 189 KB JSON; **heavy** = 600 strokes / 121,138 points / 1.48 MB JSON (deliberately beyond the app's 100k-point and 1 MiB limits, a stress case). Rendering used the repo's own resvg-wasm 2.6.2 WASM; WASM encoders were the repo's jsquash webp 1.5.0 / avif 2.1.1; native comparisons used cwebp 1.6.0, avifenc 1.4.2 (aom 3.14.1), and libjxl via imagecodecs 2026.10.10. Quality was measured against the lossless resvg raster with Pillow (PSNR, max per-channel error, share of pixels off by >8 levels). Scripts: `un directorio temporal fuera del repo, no conservado` (session scratchpad, not in the repo). Absolute timings on Cloudflare servers will differ (likely slower per core than an M5 Pro); treat them as relative.

## (a) How should drawings be rendered from stroke documents into canonical images on Cloudflare?

### Takeaway
Keep rendering inside a Worker with resvg-wasm, but replace the multi-attempt jsquash AVIF loop with a single **lossless WebP** encode (jsquash `webp_enc`, ~0.28 MB of WASM vs ~3.5 MB for the AVIF encoder): in V8 this measured 4–29 ms to render plus 21–42 ms to encode for realistic drawings, against 153–226 ms for *each* current AVIF attempt. That is cheap enough to render synchronously at publish time. Use Queues only for backfills and re-render jobs. The Images binding cannot rasterize SVG or vector strokes, and Browser Rendering or Containers add cost and latency for no quality gain at this scale.

### Cited Findings
- **resvg-wasm render cost [Own benchmark]:** WASM init took 16 ms. Warm render medians were 4.2 ms (light), 29.4 ms (medium) and 222.7 ms (heavy, over the app's limits). Render plus resvg's built-in PNG encode took 10.4 / 37.4 / 231.4 ms. The first render of the light document took 18.6 ms. The resvg WASM binary is 2,478,606 bytes (`@resvg/resvg-wasm` 2.6.2 in the repo's node_modules).
- **Encode cost inside WASM [Own benchmark]:** jsquash WebP lossless with method 4 and quality 75 produced 15,896 B in 21 ms (light), 84,010 B in 41 ms (medium) and 107,926 B in 42 ms (heavy). Method 6 with quality 100 shrank output by only 1–2% but took 864–2,902 ms. The current first AVIF attempt (q70, 4:2:0, speed 6) took 153 / 216 / 226 ms. AVIF q80 4:4:4 took 135 / 308 / 345 ms.
- **WASM sizes [Own benchmark: file sizes in node_modules/.bun]:** `avif_enc.wasm` is 3,485,872 B, `avif_dec.wasm` 1,170,930 B, `webp_enc.wasm` 281,261 B (345,584 B for the SIMD build), `webp_dec.wasm` 137,960 B, `squoosh_png_bg.wasm` 181,088 B and `mozjpeg_dec.wasm` 166,470 B. A resvg plus WebP-encoder build therefore needs about 2.8 MB of WASM, versus the ~7.6 MB the current codec set carries.
- **The repo itself notes AVIF cost:** the comment in `apps/web/wrangler.jsonc` says "AVIF encoding in WASM can take several seconds of CPU per upload". This is a repo source, not a URL.
- **Workers Paid limits:** default CPU per HTTP request is 30 s, configurable up to 5 minutes (300,000 ms) via `cpu_ms`. Memory is 128 MB per isolate, including WASM allocations. Worker size is 64 MiB uncompressed, and the docs say "There is no compressed size limit". The global scope has a 1 s startup limit. Queue consumers have a 15-minute wall-time limit per invocation — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- **The 64 MiB uncompressed limit is recent:** a secondary blog dates the change from the old 10 MB compressed (Paid) limit to September 4, 2026 — [classmethod](https://dev.classmethod.jp/en/articles/cloudflare-workers-64mib-size-limit/); the [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) page confirms the current figure.
- **Images binding capabilities:** `.input(stream)` accepts up to 20 MB of image bytes. It offers `.transform()` (width, height, blur, rotate, and so on), `.draw()` to overlay another image with opacity, repeat, position and composite options, `.text()` to rasterize text, and `.output({format, quality})`, which is required. Binding results are not cached automatically, and calls are billed as unique transformations — [Images binding](https://developers.cloudflare.com/images/transform-images/bindings/)
- **The binding cannot draw vectors:** Cloudflare Images "does not resize SVGs" and "will ignore any optimization parameters"; it only sanitizes them with svg-hush. Input formats are PNG, JPEG, GIF, WebP, SVG, HEIC and AVIF (AVIF input is Enterprise only). Output formats are PNG, JPEG, GIF, WebP, SVG and AVIF. AVIF output is capped at 1,200 px per dimension — [Images limits](https://developers.cloudflare.com/images/get-started/limits/)
- **Browser Rendering pricing on Workers Paid:** 10 browser hours per month are included, then $0.09 per hour. Browser Sessions also include 10 concurrent browsers (monthly average of the daily peak), then $2.00 per extra browser. Quick Actions are billed on browser hours only — [Browser Rendering pricing](https://developers.cloudflare.com/browser-rendering/pricing/)
- **Containers pricing on Workers Paid:** billed per 10 ms of active running time. Included each month: 25 GiB-hours of memory, 375 vCPU-minutes and 200 GB-hours of disk. Overage is $0.0000025 per GiB-second, $0.000020 per vCPU-second and $0.00000007 per GB-second. The smallest "lite" instance has 1/16 vCPU, 256 MiB and 2 GB. Every container also requires a Worker and a Durable Object, both billed. The page gives no cold-start figures — [Containers pricing](https://developers.cloudflare.com/containers/pricing/)
- **CanvasKit size:** the canvaskit-wasm 0.40.0 npm package is 25.3 MB unpacked. No Workers-specific measurement was found — [npm canvaskit-wasm](https://npmjs.com/package/canvaskit-wasm)
- **Queues semantics and cost:** Queues provide "at least once delivery by default", so messages "may be delivered more than once". The docs recommend a unique ID per message for de-duplication — [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/). Workers Paid includes 1,000,000 Queue operations per month, then $0.40 per million. An operation is counted per 64 KB written, read or deleted — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### Inferences
- **Recommended renderer:** resvg-wasm, already in the repo and battle-tested in the Worker. It renders exactly the SVG the client draws (round caps and joins, flat fills), and realistic drawings cost tens of milliseconds. Even the over-limit stress case stays near 0.25 s, far below the 30 s default CPU budget. The 768×768 RGBA raster is 2.36 MB, so it fits easily within 128 MB.
- **CanvasKit is not worth it:** its multi-MB WASM adds bundle and cold-start cost without improving fidelity over resvg (resvg is built on tiny-skia) for polylines.
- **Browser Rendering:** this means a headless Chrome round-trip per publish, with seconds of latency and session management. It also introduces a second rasterizer whose anti-aliasing can drift with Chrome versions. It is defensible only if the client canvas is not a 2D canvas. (Assumption, unsourced: about 1–3 s of browser time per render. Under that assumption, 1k publishes a month is roughly 0.3–0.8 h, inside the 10 free hours.)
- **Containers with native resvg or Skia:** cheap at this scale (a lite instance gets about 100 awake-hours a month inside the included 25 GiB-hours), but they add a Durable Object, cold starts and an OCI image to maintain. They only make sense if per-render CPU in Workers becomes a problem, which the benchmark does not suggest.
- **Bundle hygiene:** put the renderer (resvg plus WebP encoder, ~2.8 MB) in a separate "renderer" Worker reached through a service-binding RPC, or in a Queue consumer Worker, rather than in the SvelteKit app Worker. This keeps the app Worker's startup and bundle small. It also matters for placement: placement "does not affect RPC methods or named entrypoints" — [Placement](https://developers.cloudflare.com/workers/configuration/placement/)
- **Sync vs async:**
  - **Synchronous render at publish** (recommended): ~50–100 ms of CPU on Workers (estimated from the V8 numbers, scaled for slower server cores). The canonical image exists before the artwork appears in anyone's feed, and failures surface to the author immediately.
  - **Queue only for:** (1) a backfill that re-renders all existing AVIF artworks from their stored stroke documents into lossless WebP; (2) future render-version bumps, such as a resvg upgrade; (3) retrying a failed synchronous render.
  - **Idempotency:** with at-least-once delivery, derive the R2 key deterministically, e.g. `{renderVersion}/{sha256(doc)}.webp`, so a duplicate job overwrites identical bytes.
  - **Async-first is also viable:** the author's client already holds the strokes and can show its own canvas render optimistically. The feed then lists the artwork only once the canonical object exists, or shows the placeholder until it does.
- **Determinism:** pin the resvg version and record `renderVersion` with each artwork. A canonical image is then reproducible from the stroke document, which fits the AGENTS.md reproducibility manifesto, and can be regenerated in bulk cheaply (see the cost section).
- **Drop the quality ladder:** with lossless WebP there is only one encode and no degradation. If a pathological drawing exceeds the byte cap, the right move under the owner's constraint is to raise the cap (e.g. 256–300 KiB), not to degrade.

### Gaps
- No published Cloudflare measurement of resvg-wasm CPU ms per render on production Workers hardware; the numbers above are V8 on an M5 Pro. Verify on Workers by logging CPU time (Workers Logs) on a canary deploy.
- No measured cold-start time for loading ~2.8 MB versus ~7.6 MB of WASM in workerd. The 1 s startup limit applies to global scope, but compiled WASM modules' instantiation cost was not measured.
- Browser Rendering per-screenshot browser time and Containers cold-start latency were not found in docs.
- Worst-case lossless WebP size for an adversarial drawing within app limits (e.g. 100k points of multicolour noise) was not tested.

## (b1) Which image format is best for flat-colour line art without visible quality loss?

### Takeaway
For this content, **lossless WebP is the best canonical format**. It is pixel-exact, 2.3–3× smaller than PNG, 2.4–3.6× smaller than lossless AVIF, and similar in size to lossy AVIF 4:4:4 q70–80, while decoding faster than AVIF and being supported everywhere. The current AVIF 4:2:0 pipeline is the visible-quality culprit: chroma subsampling smears saturated line edges, with 2–15% of pixels off by more than 8 levels and max errors of 107–168. JPEG XL brought no size win on this content in the tests and is not yet universally supported.

### Cited Findings
- **Size and quality table [Own benchmark]**, 768×768, against the lossless raster. Format (light / medium / heavy):
  - resvg default PNG: 45,882 / 199,834 / 244,085 B (lossless).
  - **WebP lossless `-z 6`: 15,896 / 84,008 / 107,926 B (lossless). Encode 27–46 ms.**
  - WebP lossless `-z 9`: 15,562 / 83,114 / 106,914 B (lossless). Encode 0.5–1.7 s.
  - WebP near-lossless 60: 17,820 / 89,944 / 113,828 B. PSNR 53–60 dB, max error 2. Larger than lossless.
  - WebP lossy q90 with sharp_yuv: 27,214 / 110,044 / 126,856 B. PSNR 29–39 dB, max error 148–184.
  - AVIF lossless: 57,001 / 289,472 / 334,651 B (lossless, 3.1–3.6× WebP lossless).
  - AVIF q90 4:4:4: 20,930 / 104,853 / 132,802 B. PSNR 51 / 45.7 / 43.9 dB, max error 29–43.
  - AVIF q80 4:4:4: 16,669 / 84,337 / 107,835 B. PSNR 49 / 43 / 41 dB, max error 34–68.
  - AVIF q70 4:4:4: 14,409 / 72,872 / 94,124 B. PSNR 48 / 41.5 / 40 dB, max error 51–75.
  - **AVIF q70 4:2:0** (the current first attempt): 13,603 / 61,223 / 72,900 B. PSNR 38 / 30.5 / 28 dB, max error 109–164, 2.4% / 8.5% / 13.4% of pixels off by more than 8.
  - AVIF q55 4:2:0: 11,388 / 46,650 / 54,252 B. PSNR 38 / 30 / 27.7 dB, 2.4% / 9.7% / 14.7% of pixels off by more than 8.
- **JPEG XL lossless [Own benchmark]** (libjxl via imagecodecs 2026.10.10, round-trip verified exact): effort 7 gave 19,253 / 157,070 / 207,241 B and effort 9 gave 17,273 / 147,522 / 193,251 B. Both are larger than WebP lossless on all three drawings. Settings were not tuned (e.g. effort 10, palette or patch options), so this result is specific to these defaults.
- **Decode cost [Own benchmark]:** native single-threaded decode of the medium image, median of 20 runs, wall time including process start. WebP lossless 4.7 ms, WebP lossy 7.6 ms, AVIF lossy 4:4:4 11.6 ms, AVIF lossless 21.7 ms. These are indicative only, not mobile-browser measurements.
- **AVIF decode is costlier than WebP:** Bunny.net (undated, limited testing) reported "as much as 10X increase in the decoding time of an AVIF image compared to WebP", with some large images taking up to 300 ms on a top-end laptop — [bunny.net](https://bunny.net/blog/lets-talk-avif-and-why-we-are-not-adding-support-just-yet/). This is a vendor blog; treat it as directional.
- **Independent corroboration on a flat illustration:** Jake Archibald (September 2020, older but format behaviour is unchanged) measured PNG at 16.3 kB, lossless WebP 12.9 kB, lossless AVIF 41.7 kB ("isn't very good") and lossy AVIF 8.69 kB. He turned off AVIF chroma subsampling "to keep the colours sharp" — [AVIF has landed](https://jakearchibald.com/2020/avif-has-landed/)
- **Google's WebP claim:** "WebP lossless images are 26% smaller in size compared to PNGs". WebP is natively supported in Chrome, Safari, Firefox, Edge and Opera — [Google WebP](https://developers.google.com/speed/webp)
- **JPEG XL in Chrome:** Chrome announced on October 6, 2026 that it is "shipping decoding support" for JPEG XL starting with Chrome 155, using the Rust jxl-rs decoder. The post positions JXL for "high-fidelity or lossless compression", especially photographs, and fine-grained progressive decoding. It gives no stable date — [Chrome blog](https://developer.chrome.com/blog/jpeg-xl-in-chrome)
- **JPEG XL elsewhere:** Safari has had partial support since 17 (no animation, no progressive decoding). Firefox has it only in Nightly behind `image.jxl.enabled`. This comes from an early-2026 secondary article and may be outdated — [corewebvitals.io](https://www.corewebvitals.io/pagespeed/jpeg-xl-core-web-vitals-support)

### Inferences
- **Why 4:2:0 fails here:** 4:2:0 halves colour resolution. Thin saturated strokes on cream are exactly the case where that shows: coloured fringes and desaturated 1–3 px lines. The current fallback ladder (q70 → q32 at 4:2:0) is the most likely source of any "quality loss" the owner has seen.
- **Lossy AVIF has no size advantage here:** AVIF 4:4:4 at quality levels plausibly "visually lossless" for line art (q80–90) produces files the same size as or larger than lossless WebP. Only q70 4:4:4 is 9–13% smaller, and it is still lossy (max errors of 51–75 at edges). Exact pixels for roughly the same bytes is the better trade under a "never visibly degraded" rule.
- **Recommendation:** canonical = lossless WebP, 768×768 (and 340×340 for avatars), method 4 / `-z 6`. This yields one format and no `Accept` negotiation, so there is no `Vary: Accept` and no per-format cache fragmentation. AVIF is not needed as a fallback or as a primary format.
- **On mobile:** WebP lossless decodes faster than AVIF, which matters in a grid where dozens of 768² images are decoded during a fling scroll.
- **JPEG XL:** revisit only once Chrome 155 is stable and Firefox ships. On this content it showed no win even then.
- **Lower-effort WebP is enough:** `-z 9` / method 6 buys 1–2% for 20–60× the CPU. Not worth it in a Worker.

### Gaps
- No mobile-browser decode benchmark (e.g. on a mid-range Android) comparing lossless WebP and AVIF for 768² images was found. The local native numbers are a proxy.
- No public 2025–2026 study specifically on lossless WebP vs AVIF vs JXL for anti-aliased flat line art was found; the comparison relies on own measurements plus Archibald (2020).
- The synthetic drawings are random walks. Real doodles, with longer smooth strokes and more empty background, will likely compress even better in lossless WebP, but this was not measured on production data.

## (b2) Which delivery pipeline on Cloudflare (R2, Images transformations, custom domain, caching) and what does it cost?

### Takeaway
Pre-generate one immutable lossless-WebP object per artwork at publish, store it in R2 under a versioned or content-hashed key, and serve it from an **R2 custom domain** with `Cache-Control: public, max-age=31536000, immutable`. Turn on Smart Tiered Cache, and keep no Worker in the image path. Cloudflare Images transformations are unnecessary (single size, single format) and would only add cost. At 10k artworks and 500k views a month, the incremental cost is about $0 beyond the $5 Workers Paid base.

### Cited Findings
- **R2 pricing:** Standard storage $0.015 per GB-month; Class A $4.50 per million; Class B $0.36 per million; egress free. The monthly free tier is 10 GB-month, 1M Class A and 10M Class B. GetObject and HeadObject are Class B; PutObject is Class A; DeleteObject is free — [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- **Cache hits do not touch R2:** "Every cache hit avoids origin fetch costs, Argo routing charges, Workers execution, and R2 operations" — [How charges accrue](https://developers.cloudflare.com/billing/understand/how-charges-accrue/). The cost guide recommends Cache-Control on R2 objects so cached objects never reach R2 — [Optimize costs](https://developers.cloudflare.com/billing/manage/optimize-costs/). Both are search-result excerpts of the official pages.
- **Custom domain caching:** a custom domain "allows you to use Cloudflare Cache to accelerate access to your R2 bucket". Configure Smart Tiered Cache to get "a single upper-tier data center next to your R2 bucket". WAF and Access require a custom domain. r2.dev "is rate-limited and should only be used for development purposes" — [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- **Smart Tiered Cache** (Smart Topology) is available on Free, Pro, Business and Enterprise. It picks "the single closest upper tier for each of your website's origins" — [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/)
- **Default caching:** WebP and AVIF are among the default cached extensions, and Cloudflare "only caches based on file extension and not by MIME type". A public `max-age` > 0 makes the response cacheable — [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)
- **Cache API limits:** "the contents of the cache do not replicate outside of the originating data center". "The `cache.put` method is not compatible with tiered caching". `cache.delete` purges only the local data center — [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- **Workers Caching** (newer, separate from the Cache API) puts a cache in front of a Worker via `"cache": {"enabled": true}` and needs Wrangler ≥ 4.69.0. It honours `cloudflare-cdn-cache-control` > `cdn-cache-control` > `Cache-Control`, supports `Cache-Tag` and `ctx.cache.purge()`, and by default includes the Worker version in the cache key ("cache hit rate resets on every deployment") unless `cross_version_cache` is set. `stale-while-revalidate` is disabled by `s-maxage`, `must-revalidate` or `proxy-revalidate` — [Workers Caching](https://developers.cloudflare.com/workers/cache/configuration/). It was added as experimental in Wrangler 4.69.0 in late February 2026 — [Gemcook weekly (secondary)](https://zenn.dev/gemcook/articles/weekly-cloudflare_2026_0222-0228). Under Workers Caching, cache hits are billed as Worker requests but use no CPU — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- **Workers pricing:** $5 per month base, 10M requests and 30M CPU-ms included, then $0.30 per million requests and $0.02 per million CPU-ms. Static asset requests are free and unlimited — [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- **Images transformation pricing:** 5,000 unique transformations per month included, then $0.50 per 1,000. A unique transformation is a source image plus a parameter set, counted once per calendar month. "`format` and `quality` are excluded from uniqueness." For images stored outside Images (e.g. R2), only "Images Transformed" is billed, whichever method is used. Binding `.info()` is free — [Images pricing](https://developers.cloudflare.com/images/pricing/)
- **Images URL options:** `format=auto|avif|webp|jpeg|baseline-jpeg|json`. Quality accepts 1–100 or `high | medium-high | medium-low | low`, default 85. "Lossless WebP: use `format=webp` with `quality=100`". AVIF can be "an order of magnitude slower" and falls back to WebP or JPEG when too slow. Transformed images follow the original's caching rules with a one-hour minimum. Purging the original URL purges its variants; `/cdn-cgi/` URLs cannot be purged — [Transform via URL](https://developers.cloudflare.com/images/transform-images/transform-via-url/)
- **HTTP/3** is available on all plans and toggled under Speed › Settings › Protocol Optimization — [HTTP/3](https://developers.cloudflare.com/speed/optimization/protocol/http3/)
- **Current code:** media is streamed through a SvelteKit Worker endpoint with the Cache API and a 1 h edge TTL, because `cache.delete` is datacenter-local (`apps/web/src/routes/api/artworks/[artworkId]/media/+server.ts`). This is a repo source.

### Inferences
- **Recommended pipeline:**
  1. **Publish:** validate the document, render with resvg, encode lossless WebP, then `PUT` to R2 at `art/{artworkId}/{renderVersion}-{hash8}.webp`, with object metadata `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`.
  2. **Database:** store the key, width, height and byte size.
  3. **Serving:** the gallery JSON returns the full public URL `https://media.<domain>/art/...webp`.
  4. **Delivery:** R2 custom domain plus Smart Tiered Cache, with a Cache Rule ("Eligible for cache", Edge TTL "respect origin", Browser TTL "respect origin"). No Worker runs per image view, so there is no Worker request charge, no Cache-API locality problem, and tiered caching works.
- **Moderation and hiding:** an immutable public URL can only be revoked by deleting the R2 object and purging that URL. A global purge by URL replaces today's local-only `cache.delete`. The unguessable `hash8` in the key keeps hidden artworks from being enumerated. Truly private media (e.g. unpublished drafts) should stay behind an authenticated Worker endpoint, or never be rendered to R2 until publish.
- **Why not Images transformations:** they would only be needed for multiple sizes or formats, both excluded by the owner's constraint and the format analysis. With AVIF output limited to 1,200 px and lossy by default, they bring no fidelity benefit. If used anyway, e.g. `format=auto` from an R2 PNG or WebP master, the cost would be about (10,000 − 5,000) / 1,000 × $0.50 = **$2.50 per month** if every one of 10k artworks is requested in a month, growing linearly ($47.50 per month at 100k active artworks).
- **Cost model at 10k artworks and 500k image views a month (recommended pipeline):**
  - **Storage:** 10k × ~15–110 KB (say 60 KB average) ≈ 0.6 GB plus avatars and stroke documents, inside the 10 GB free tier, so $0.
  - **Class A:** ~1k publishes a month is ~1k PUTs, inside 1M free, so $0.
  - **Class B:** only edge cache misses (worst case 500k, realistically far fewer with tiered cache), inside 10M free, so $0.
  - **Egress:** $0.
  - **Workers CPU:** 1k renders × ~100 ms ≈ 0.1M CPU-ms, inside the included 30M. A one-off backfill of 10k artworks is ≈ 1M CPU-ms, also included.
  - **Queues** (if used for backfill): 10k messages × 3 operations = 30k, inside 1M, so $0.
  - **Total:** $0 incremental beyond the $5 per month Workers Paid base. Even at 10× scale (100k artworks, 5M views) it stays within free tiers, except perhaps R2 storage (~6 GB, still free).
- **If media must stay on the app origin** (same host), use a tiny un-placed media Worker with an R2 binding and Workers Caching enabled on `/media/*`. Expect 500k Worker requests (inside the 10M included) with near-zero CPU. A custom domain on a subdomain is simpler and cheaper.

### Gaps
- No official statement was fetched that defines precisely how R2 Class B billing treats tiered-cache upper-tier misses versus lower-tier hits. The billing pages say cache hits avoid R2 operations, without edge cases.
- Whether Cloudflare's single-URL purge is available on all plans, and its rate limits, were not verified in this session.
- No source documents whether Workers Caching lookups run in the eyeball colo or the placed colo for a Smart-Placed Worker.

## (c1) Which placeholder technique should the gallery use?

### Takeaway
Because every artwork shares a constant cream background, the cheapest effective placeholder is a CSS cream fill: zero bytes, and identical to the image's dominant colour for most drawings. If a hint of content is wanted, use a ~20–25-byte ThumbHash, or a mean colour, stored per artwork. Replace the 24 px PNG data URI, which costs 1.6–2.4 KB per artwork (50–70 KB per 30-item feed page). A "first strokes" SVG would need a separate simplification step and has no evidence base.

### Cited Findings
- **Current LQIP payload [Own benchmark]:** a 24×24 PNG data URI (Pillow, optimized) of the three test drawings is 1,606 / 2,398 / 2,430 characters. A 16×16 PNG is 878 / 1,158 / 1,158 characters. A 24×24 WebP q60 data URI is 311 / 639 / 651 characters, and 16×16 is 175 / 295 / 287.
- **Mean colours [Own benchmark]:** light (246, 241, 236), nearly the cream background; medium (176, 174, 168); heavy (140, 123, 147).
- **ThumbHash vs BlurHash:** the ThumbHash demo hash is 20 bytes, and BlurHash at recommended settings is "roughly the same size as a ThumbHash encoded using base64". ThumbHash "Encodes more detail in the same space" (up to 7 luminance DCT terms per dimension), supports alpha, encodes aspect ratio, "Gives more accurate colors", and stores the DC term first so the average colour is directly readable. The code is "similar in complexity" to BlurHash, and decoding needs JS to produce pixels — [ThumbHash](https://evanw.github.io/thumbhash/)
- **Pinterest used dominant colours:** "A placeholder with the dominant color is initially used for each Pin." Pin images were served as progressive JPEGs (2017 PWA case study; older source) — [Pinterest PWA case study (mirror of Medium dev-channel)](https://readmedium.com/a-pinterest-progressive-web-app-performance-case-study-3bd6ed2e6154)
- **Placeholders must not change tile size:** Pinterest's Gestalt Masonry warns that "placeholder images that don't match final sizes" force grid reflow — [Gestalt Masonry](https://gestalt.pinterest.systems/web/masonry)

### Inferences
- **Recommendation:** tile `background: #fdfbf7` via CSS (`#f5f0e1` for avatars), plus `aspect-ratio: 1`. Optionally add a per-artwork `placeholderColor` (3 bytes, e.g. the mean colour), or a ThumbHash computed at publish from the same raster (decoded client-side to a tiny canvas, or to a CSS gradient). For a 30-item page that is about 1 KB of JSON instead of about 50–70 KB.
- **Why a blur adds little here:** for sparse line art, a 16–24 px blur is nearly uniform cream with faint tint. It adds bytes and decode work without telling the user much. A well-timed image load (see c2) matters more than the placeholder's fidelity.
- **"First strokes" SVG placeholder:** shipping raw stroke JSON to the grid is far too heavy (20–190 KB per drawing in the benchmark). A pre-simplified SVG (e.g. Douglas–Peucker on the longest N strokes, quantised to a 1–2 KB path) is possible, but adds a second render path whose look differs from the final image. No sources were found on its perceived benefit.
- **Fade-in:** once loaded, a short opacity fade of 120–200 ms (or none) hides the swap. Since the image is lossless and the placeholder is the same cream, the swap is visually gentle.

### Gaps
- No quantitative study comparing user-perceived quality or speed of ThumbHash, BlurHash and dominant-colour placeholders was found.
- ThumbHash and BlurHash decode times on mobile were not found in primary sources.

## (c2) Which frontend techniques make entering and scrolling the gallery feel instant (Pinterest-like)?

### Takeaway
Square tiles remove the hardest part of Pinterest's grid (masonry measurement), so a plain CSS grid with fixed `aspect-ratio` gives zero layout shift. On top of that:
- **First paint:** eager-load and `fetchpriority="high"` the first visible row.
- **Below the fold:** use native `loading="lazy"` with `decoding="async"`.
- **Infinite scroll:** fetch the next keyset page 2–3 viewports ahead.
- **Long sessions:** bound DOM and decoded memory with content-visibility or a small virtualizer (virtua supports Svelte 5).
- **Opening the detail view:** make it instant by reusing the grid's image URL (already cached) plus the feed item data, and preload detail data on hover/touchstart.
- **Back navigation:** restore the list via SvelteKit snapshots or an in-memory feed store.
- **Edge:** cache anonymous feed JSON with short TTLs. Speculation Rules and Early Hints are only marginal for a client-routed SvelteKit app.

### Cited Findings
- **Pinterest PWA (2017, older but still the canonical write-up):**
  - Its Masonry grid "has built-in support for virtualization and only mounting children that are in the viewport". "Virtualizing the grid" helped component unmount time.
  - Placeholders used dominant colour, and images were progressive JPEGs.
  - Results: TTI fell from 23 s to 5.6 s, the core bundle from 650 KB to 150 KB, First Meaningful Paint from 4.2 s to 1.8 s. Time spent rose 40%, core engagements 60%.
  - [Pinterest PWA case study (mirror)](https://readmedium.com/a-pinterest-progressive-web-app-performance-case-study-3bd6ed2e6154)
- **Pinterest one-year PWA retrospective (c. 2018, older):** "An easy-to-use route preloading system was built into our client-side router." "The biggest driver of client-side performance was our normalized redux store which allows for near-instant route changes". The store "makes it trivial to show the information you have while waiting for more to load" — [Pinterest retrospective (mirror)](https://readmedium.com/a-one-year-pwa-retrospective-f4a2f4129e05)
- **Pinterest metrics:** Pinterest tracks per-surface "Pinner Wait Time", e.g. on the Pin closeup "how long it takes to load the large hero image" (2024) — [Pinterest web perf regression detection](https://medium.com/pinterest-engineering/web-performance-regression-detection-part-1-of-3-86dcc6d5fce9). Its "Performance for Everyone" post (2026) defines user-perceived latency ("Visually Complete") as the time until all images are rendered on the Home Feed — [Pinterest: Performance for everyone](https://medium.com/pinterest-engineering/performance-for-everyone-21a560260d08). Both are known only from search snippets: Medium returned 403 to fetch.
- **Gestalt Masonry (Pinterest's current component):**
  - `virtualize` requires `scrollContainer`. `virtualBufferFactor` defaults to 0.7 of the container height.
  - Rendering takes two passes, an off-screen measurement then on-screen positioning.
  - `measurementStore` and `positionStore` caches avoid re-measuring "when users navigate away and back".
  - `loadItems` handles infinite scroll.
  - [Gestalt Masonry](https://gestalt.pinterest.systems/web/masonry)
- **Native lazy-load thresholds:** Chrome's `loading="lazy"` distance-from-viewport thresholds are 1,250 px on fast connections and 2,500 px on 3G or slower (changed July 2020). The thresholds are hardcoded. web.dev advises: don't lazy-load likely in-viewport or LCP images, and always set `width` and `height` (missing dimensions can make a gallery load everything) — [web.dev lazy loading](https://web.dev/articles/browser-level-image-lazy-loading)
- **Fetch Priority:**
  - Supported in Chrome 102, Edge 102, Firefox 132 and Safari 17.2.
  - Images start at Low priority and in-viewport images are boosted to High after layout. Since Chrome 117 the first five large images get Medium.
  - Use `fetchpriority="high"` on the LCP image and `"low"` on offscreen carousel-like images.
  - "Preload ... still fetches the resource with the default priority."
  - [web.dev Fetch Priority](https://web.dev/articles/fetch-priority)
- **`decoding`:** `async` decodes "so it doesn't hold up other content from being displayed". `HTMLImageElement.decode()` resolves once the image is downloaded and decoded, which avoids blank frames when swapping images. Baseline widely available since January 2020 — [MDN decoding](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding)
- **`content-visibility: auto`** skips layout and paint for offscreen content. In web.dev's example rendering fell from 232 ms to 30 ms. `contain-intrinsic-size: auto <size>` remembers the last rendered size (good for infinite scrollers). Support: Chrome 85, Firefox 125, Safari 18; now "available in all three major browser engines". The page labels it Baseline Newly available; the summary gave the date as September 15, 2025, although Safari 18 shipped in September 2024, so verify the date — [web.dev content-visibility](https://web.dev/articles/content-visibility)
- **virtua:** requires `svelte >= 5.0` (`VList` from `virtua/svelte`), components "start from ~3kB gzipped and are tree-shakeable", and scroll restoration is listed as built in. Its SSR support (`ssrCount`) covers lists; `VGrid` has no SSR — [virtua](https://github.com/inokawa/virtua)
- **SvelteKit link preloading:**
  - `data-sveltekit-preload-data="hover"` starts on mouse rest, or on `touchstart` on mobile; `"tap"` starts on touchstart or mousedown.
  - `data-sveltekit-preload-code` accepts `eager`, `viewport`, `hover` or `tap`. `eager` and `viewport` apply only to links present right after navigation.
  - Data is never preloaded when `navigator.connection.saveData` is true.
  - `preloadData` is available from `$app/navigation`.
  - [SvelteKit link options](https://svelte.dev/docs/kit/link-options)
- **SvelteKit snapshots:** `capture` runs before leaving a page, and `restore` runs on back/forward "as soon as the page is updated". Values persist in `sessionStorage` (they survive reloads), are serialized with devalue, and should be kept small. The exported `snapshot` object form is deprecated in favour of `snapshot({capture, restore})` from `$app/navigation` — [SvelteKit snapshots](https://svelte.dev/docs/kit/snapshots)
- **Speculation Rules:** support is Chromium-only: Chrome 109+ per caniuse, Safari 26.2–26.5 disabled by default, Firefox unsupported through 155 — [caniuse speculation rules](https://caniuse.com/wf-speculation-rules). MDN marks it "limited availability" — [MDN Speculation Rules](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)
- **Cloudflare Speed Brain** adds a `Speculation-Rules` header for `conservative` prefetch (Chromium 121+). It is on by default only on Free plans. It "won't prefetch on routes that run Workers" and only serves already-cached content — [Speed Brain](https://developers.cloudflare.com/speed/optimization/content/speed-brain/)
- **Cloudflare Early Hints:**
  - Cloudflare caches `Link` headers with `preconnect` or `preload` from HTML responses (`.html`, `.htm`, `.php` or extensionless URIs, status 200/301/302) and replays them as a 103. Cache entries are keyed by URI, ignoring the query string.
  - It works only over HTTP/2 and HTTP/3, is available on all plans, and is sent less often for cacheable content. The page does not say whether Worker-generated responses qualify.
  - [Early Hints](https://developers.cloudflare.com/cache/advanced-configuration/early-hints/)
- **SvelteKit's Link headers:** SvelteKit 2.55.0 (the repo's version) emits `Link: <...>; rel="modulepreload"; nopush` headers for its JS chunks (`@sveltejs/kit/src/runtime/server/page/render.js`, lines 363–371 and 639–640). This is a local source in node_modules.

### Inferences
- **Layout:** a uniform square grid, e.g. `grid-template-columns: repeat(auto-fill, minmax(min(45vw, 240px), 1fr))`, with `aspect-ratio: 1` and `<img width="768" height="768">`, gives CLS ≈ 0 without Pinterest's two-pass measurement or a masonry library.
- **768 px in tiles is the right size anyway:** on 2–3× DPR phones, a 256 CSS-px tile needs ~512–768 device pixels, so serving 768 px in the grid is visually appropriate. No smaller variant is needed, which agrees with the owner's constraint.
- **First rows:** the first ~4–8 tiles (about the first two rows on mobile and the first row on desktop) get `loading="eager" fetchpriority="high"`. Everything else gets `loading="lazy" decoding="async"`. Chrome then fetches lazily ~1,250 px ahead on fast networks, about 1–2 screens of tiles.
- **Infinite scroll:**
  - **Trigger:** an IntersectionObserver sentinel with `rootMargin: "200% 0px"` (2–3 viewports) fetches the next keyset page (`?after=<cursor>`) well before the user reaches the end.
  - **Render:** append the items immediately. Their images begin loading through the lazy threshold.
  - **Fast flings:** optionally warm the next page's first row with `new Image().src = url` (low priority) once the JSON arrives.
- **Memory is the real Pinterest-feel risk:** each 768² tile decodes to about 2.36 MB of RGBA, so 200 tiles is about 470 MB if all stay decoded. Use virtualization (virtua `VList` of rows, or a window virtualizer) or `content-visibility: auto; contain-intrinsic-size: auto 260px` on row wrappers, so offscreen tiles skip paint and the browser can discard decoded bitmaps. This matters more on iOS Safari. (Inference: browser decoded-image eviction policies were not sourced.)
- **Detail view (no shared-element morph; route-level transition only):**
  - **Images:** reuse the exact same 768 px URL for the detail image. It is already in the HTTP and memory cache from the grid, so the image appears on the first frame.
  - **Data:** keep feed items in a client store keyed by artwork ID (Pinterest's normalized-store idea). The detail route renders title, author and image instantly from the store while `load` fetches comments, votes and the fork tree.
  - **Preload:** add `data-sveltekit-preload-data="hover"` on tiles, plus `preloadData()` on `pointerdown`.
- **Back navigation:** keep the loaded pages and cursor in a module-level store (in memory across client navigations), and restore the scroll offset via `snapshot({capture, restore})`. Only the cursor, page count and scroll position go in the snapshot; refetch pages from the edge-cached JSON on reload rather than serializing all items into `sessionStorage`. virtua's built-in scroll restoration can help if adopted.
- **Edge caching of anonymous feed JSON:**
  - **First page:** `Cache-Control: public, max-age=15, stale-while-revalidate=120`, with no `s-maxage`, because it disables SWR under Workers Caching.
  - **Later keyset pages** (stable by cursor): `max-age=300` or longer, with `Cache-Tag: feed`, purged on moderation.
  - **Authenticated responses** (votes or "liked" state) should be split out: fetch per-user overlay data separately so the item list stays cacheable.
  - **Mechanism:** use Workers Caching (if adopted, mind `cross_version_cache` and the version-keyed default) or the Cache API in an un-placed Worker.
- **Speculation Rules:** low value here. SvelteKit intercepts in-app link clicks (client-side routing), so document prefetch/prerender helps only the first full navigation and is Chromium-only. Speed Brain skips Worker routes anyway. SvelteKit's own preload attributes work cross-browser and are the right tool.
- **Early Hints:** marginal. Per the docs, only `preconnect`/`preload` qualify, so SvelteKit's default `modulepreload` Link headers likely do not trigger a 103. That is an inference from the docs' wording; it was not tested. The useful addition is `Link: <https://media.<domain>>; rel=preconnect` (if media is on a subdomain) plus preload for fonts and CSS. Do **not** put per-page LCP image preloads in `Link`, because Cloudflare caches hints per URI and would replay stale image hints for a changing feed.
- **HTTP/3:** enable it in the dashboard. It is free and helps lossy mobile networks. Its exact impact on this app was not measured.
- **Infinite-scroll reliability:** the repo's recent commit "re-scroll the gallery sentinel on every poll" suggests the sentinel pattern is already in use. The `rootMargin` look-ahead is the key tuning knob.

### Gaps
- Pinterest's 2024–2026 web posts (Medium) could not be fetched (HTTP 403); only search snippets were available. No recent Pinterest primary source on its current image formats, placeholder or prefetch logic was found.
- No source on browser policies for discarding decoded images offscreen (Chrome or Safari), which determines how much virtualization is needed for 768² tiles.
- Whether Chrome honours `modulepreload` inside a 103 Early Hints response, and whether Cloudflare forwards it, was not verified.
- `@tanstack/svelte-virtual` Svelte 5 compatibility was not checked; virtua was verified to require Svelte ≥ 5.

## (d) How do Smart Placement and placement hints interact with Cache API edge caching and R2 delivery, and how should the system be split?

### Takeaway
The docs never mention the Cache API under placement. However, they say a placed Worker runs its fetch handler in the placed location, assets fetched through the Worker's binding are "served from the location where your Worker runs", and Cache API contents "do not replicate outside of the originating data center". Together these imply that a placed Worker's `caches.default` is the placed colo's cache, not the user's. Media therefore should not be served by a placed Worker: serve it from an R2 custom domain, or from a separate un-placed media Worker, and place only the DB-heavy app or back-end Worker.

### Cited Findings
- **How Smart Placement decides:** Cloudflare forwards a request to a candidate location only if it is "significantly faster", and only among locations the Worker already runs in. Analysis can take 15 minutes. If placement slows the Worker, it is reverted (`UNSUPPORTED_APPLICATION`) — [Placement](https://developers.cloudflare.com/workers/configuration/placement/)
- **Placement Hints:** `region` (e.g. `aws:us-east-1`), `host` (TCP, experimental) and `hostname` (HTTP). They are not meant for anycast or replicated resources — [Placement](https://developers.cloudflare.com/workers/configuration/placement/). Explicit placement hints were announced on January 22, 2026 — [Changelog](https://developers.cloudflare.com/changelog/2026-01-22-explicit-placement-hints)
- **Scope of placement:** it applies only to fetch handlers and "does not affect RPC methods or named entrypoints" — [Placement](https://developers.cloudflare.com/workers/configuration/placement/)
- **Static assets:** "Static assets are always served from the location nearest to the incoming request", but if code retrieves assets through the static assets binding, "assets are served from the location where your Worker runs" — [Placement](https://developers.cloudflare.com/workers/configuration/placement/)
- **Docs-recommended split:** edge logic (auth, routing) goes in one un-placed Worker, back-end logic (DB) in another, connected with Service Bindings and RPC: "Enable placement on your back-end Worker to invoke it close to your database" — [Placement](https://developers.cloudflare.com/workers/configuration/placement/)
- **Worker-first routing under placement:** with Worker-first asset routing, requests go through the Smart-Placed Worker, "which can add latency to asset requests". The PR suggests splitting into multiple Workers — [cloudflare-docs PR 18780](https://github.com/cloudflare/cloudflare-docs/pull/18780/files)
- **Cache API locality:** contents "do not replicate outside of the originating data center", and `cache.delete` acts only "in the data center that the Worker was invoked" — [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- **The current app is not placed:** `apps/web/wrangler.jsonc` has no `placement` block and uses Hyperdrive and the Cache API for media (repo source).

### Inferences
- **If the app Worker is placed near Postgres** (via Smart Placement or a `region` hint matching the Supabase region), every Cache-API hit in the current media endpoint would be served from that one colo. A user in Asia would get a cross-ocean round trip even on a cache hit, and the cache hit ratio would concentrate in one location. That defeats edge caching for images.
- **Recommended split:**
  1. **Media:** an R2 custom domain (`media.<domain>`) with Smart Tiered Cache and immutable keys, with no Worker involved. Alternatively, a dedicated un-placed media Worker (R2 binding plus Workers Caching) on `/media/*`.
  2. **App edge:** the un-placed SvelteKit Worker serving static assets (always nearest), the HTML shell, and the anonymous edge-cached feed JSON.
  3. **Data back end:** if placement is wanted for DB-heavy SSR or API calls, put the DB access in a back-end Worker with `placement` (region hint), called via RPC/service binding from the edge Worker. RPC methods are not placed, so the placed back end must expose a fetch handler for placement to apply. Alternatively, place the whole app Worker but keep media off it.
  4. **Renderer:** a separate Worker (resvg plus WebP), called via service binding at publish or as a Queue consumer. Its placement is irrelevant because it writes to R2, which is not latency-critical for viewers.
- **Hyperdrive and placement:** Hyperdrive already reduces connection setup, but each query still crosses from the user's colo to the DB region. Placement therefore benefits multi-query SSR routes, which is exactly why media and cacheable feed reads should not live on the placed Worker.

### Gaps
- No Cloudflare documentation or staff statement explicitly confirms which data center's Cache API a Smart-Placed Worker uses. The conclusion is an inference from the static-assets-binding sentence and the Cache API locality statement; verify empirically by logging `request.cf.colo` and Cache-API hit headers from a placed test Worker.
- How Workers Caching (the cache in front of a Worker) behaves for placed Workers (lookup in the eyeball colo or the placed colo) is not documented in the pages fetched.
