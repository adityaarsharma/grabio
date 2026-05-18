# Changelog

All notable user-facing changes to the public Grabio Shortcut and backend.

The format follows [Keep a Changelog](https://keepachangelog.com/) loosely. Semver applies to the Shortcut binary version users see on iCloud.

## [3.3.4] — 2026-05-18

### Fixed — WhatsApp text STILL misclassified after v3.3.2 (real-world iPhone payload)

v3.3.2 added a `text` kind to `decideKindFromHints` but it only triggered when
`input_text` was non-empty AND no other signal won. Real iPhone Shortcut payloads
for shared WhatsApp text actually look like:

```
text=Food pedllar Bread pocket hrisjha ka ghar
hint=Text         ← typeOf hint correctly says 'Text'
media=Image       ← iOS Shortcut binary defaults media_type to 'Image' for text
ext=?
```

The binary-side `media=Image` quirk meant Tier 2 (`kindFromMediaType('Image') → 'image'`)
won before Tier 5 (text fallback). Users saw the image-conversion menu for text shares.

Fix: added **Tier 1.5 — TEXT HINT OVERRIDE** in `decideKindFromHints`. When
`input_type_hint` matches `/\btext\b/i` AND there's no real `file_ext`, force
`kind='text'` regardless of what `media_type` claims. Verified against the exact
log payload that triggered the user-reported bug.

### Improved — QR decode robustness (3-strategy fallback)

Real-world iPhone-camera QR shares (photo of a printed board / poster / sticker)
fail with a single-pass decode because the QR can be:
- Small in a large frame (needs no downscale)
- Inverted (dark QR on light bg vs light on dark)
- Low contrast / printed

Both `/v2/run qr-decode` and `/api/v3/qr/decode` now try 3 strategies and return
the first success:

1. **2048×2048 max** (preserve detail for small-in-frame QR) + `inversionAttempts: 'attemptBoth'`
2. **1024×1024** (current fast path) + attemptBoth
3. **1536×1536 grayscale + sharpen** (last-resort for low-contrast / printed QR)

Friendly error message updated when all 3 fail: "Make sure the QR is centered,
well-lit, and takes up at least 1/4 of the photo."

## [3.3.3] — 2026-05-18

### Removed — 3 zombie v2 routes that violated share-first contract

Logic Lens audit caught 3 dead routes that still accepted typed `license_key`
in request body — unreachable from any v3 UI surface, but technically callable
by anyone who knew the URL. v3 contract is share-first (no typed inputs from
users); these endpoints violated that contract by their mere existence.

Routes neutralized (return 410 Gone with friendly redirect):
- `POST /pro/activate` — v2 license paste-key fallback
- `POST /validate` — v2 license validate stub
- `POST /convert-url` — v2 social-URL converter (long-dead since social
  feature was retired in v3.0.0)

Each 410 response includes `open_url` pointing to /#pricing so any old client
hitting these routes can guide the user to the v3 share-first flow.

## [3.3.2] — 2026-05-18

### Fixed — WhatsApp text share misclassified as image

`decideKindFromHints` returned `'unknown'` for plain text input (WhatsApp/Notes/
Messages share). `menuForKind('unknown')` then fell through to a default
`{ '📷 JPEG', '🎵 MP3-192', '📱 Compress as video', '📞 Ringtone }` menu — the
first option ('📷 JPEG') made users perceive Grabio was treating their text as
an image.

Fix:
- `decideKindFromHints` now returns `'text'` when non-empty `input_text` exists
  but no URL/file/media signal does.
- `menuForKind('text')` returns 2 sensible options:
  - 🔳 Generate QR code from this text
  - 📋 Just copy the text
- `menuForKind` default fallback is now an empty object. /v2/menu detects the
  empty case and returns a friendly `feature-info` message listing supported
  share types instead of the old confusing menu.

### Added — text → QR code generation

- New `/v2/run` option `text-qr-generate`: encodes shared text as a 512×512
  PNG QR code (errorCorrection M) and saves to Photos.
- New `/v2/run` option `text-copy`: returns the text via `clipboard` field
  for the Shortcut to copy back. Free 5/day rate-limit applies.

### Audited — every share type now classifies correctly

| Share | Kind | First option |
|---|---|---|
| Photo (jpg/png/heic) | image | 🔄 Change Format |
| Live Photo | image | 🔄 Change Format |
| Video (mp4/mov) | video | 📱 Compress for sharing |
| Audio (mp3/m4a/wav) | audio | 🎵 MP3 — 128 kbps |
| PDF | pdf | 📉 Compress PDF |
| Webpage URL | url | 📄 Save as PDF |
| Social URL (IG/TikTok/YT/FB) | feature-info | 📖 Read why this changed |
| **Plain text (NEW)** | **text** | **🔳 Generate QR code** |
| Empty / unrecognized | feature-info | 🚀 OK got it (with help text) |

## [3.3.1] — 2026-05-18

### Added — desktop checkout → QR-scan bind flow

Pro users can now buy from any device. Previously only iPhone-initiated checkouts
(where the Shortcut passed `metadata.device_id`) bound Pro automatically — desktop
purchases required a manual email rebind.

- **Server**: when the Polar webhook fires without `metadata.device_id`, server mints
  a `bind_token` (24-hex, 30-day TTL) and maps both `subscription_id` and `checkout_id`
  to the token in Redis.
- **`/pro/success`**: detects desktop checkout (no device tag in metadata) and renders
  a QR code (PNG, 320×320, errorCorrection M) encoding `https://grabio.adityaarsharma.com/r/<token>`.
- **`/r/<token>`**: UA-detected redemption page. iPhone Safari sees an "⚡ Activate Pro now"
  button using `shortcuts://run-shortcut?name=Grabio&input=text&text=<activation URL>`.
  Desktop UA sees "open this on your iPhone".
- **`/v2/menu`**: detects the `/r/<token>` URL pattern in `input_text` and calls
  `bindProToDevice(this iPhone's device_id)`, burns the token, returns success alert.
- **No Shortcut binary update required** — existing iPhones running the v3 binary
  already pass any text input to `/v2/menu`. Server-side URL pattern detection does
  the rest.

### Fixed — critical refund/cancel bug

`subscription.canceled` / `subscription.revoked` / `order.refunded` handler only
revoked Pro via `grabio:license_devices:<license>` — a **v2 legacy path**. In v3
Pro is bound by `metadata.device_id` with no license, so the revoke silently did
nothing. **Net effect: refunded customers would keep Pro forever.**

Fix: handler now revokes through 3 paths:
1. License-key path (v2 back-compat)
2. `grabio:polar_customer_devices:<customer_id>` (v3 — reverse index already maintained at bind time)
3. `data.metadata.device_id` direct hash (v3 metadata fallback)

### Added — webhook hardening

- **`benefit_grant.cycled`** handler — extends Pro TTL on monthly recurring benefit
  re-issuance (defensive: subscription.active already covers renewals, but this catches
  the grant directly).
- **`subscription.uncanceled`** handler — when a user clicks "Keep my plan" in Polar
  dashboard after starting to cancel, re-extends Pro TTL (or recreates the Pro key
  if the cancel event already deleted it).
- **Explicit webhook dedupe by `webhook-id`** — atomic `SET grabio:wh_seen:<wid> NX EX 86400`
  at top of handler. Polar retries no longer reprocess events. Belt-and-suspenders
  protection for future INCR-based metrics.

### Landing polish

- Removed Free "Want more than 5/day…" footnote (cleaner card)
- Removed Pro "Open this page on your iPhone to buy…" callout (no longer needed
  with QR-bind flow)
- Added `<link rel="preload" as="image">` for hero PNG + `<link rel="preconnect">`
  to source CDN to improve mobile LCP

### Smoke test results

38/38 distinct cases passing across 8 sections:
A · Landing/assets · B · Free flow (5/day cap) · C · Pro iPhone-direct · D · Pro
Desktop+QR (11 sub-tests) · E · Refund/cancel · F · Idempotency+security ·
G · Rebind · H · Watchdog

## [3.2.1] — 2026-05-17

### Fixed — **Critical webhook bug found during launch audit**

`UPLOAD_PATHS` regex matched `/pro/webhook` but **not** `/pro/webhook-polar`
(the `-` after `webhook` broke the suffix). Consequence: the global
`smallJson` body parser consumed the raw request body before
`express.raw()` could read it inside the route handler. Every real Polar
webhook would have computed an HMAC over an empty body and returned
`401 invalid_signature`.

This means **no Pro purchase has ever auto-activated via webhook in v3**.
The /pro/success desktop fallback was the only path users could rely on
(emailing the operator with a Polar receipt).

After fix:
- Localhost simulation: webhook 200, `grabio:pro:<hash>` written, Brevo enrolled
- Public URL simulation (Cloudflare → nginx → Node): same — 200, Pro bound,
  TTL = subscription + 35-day grace
- Logs confirm `[polar-webhook] event=subscription.created` +
  `[brevo-pro] enrolled <email>`

### Other clean-up in this audit

- Legacy v2 `pro-redeem-<token>` activation flow neutralized — returns a
  friendly v3 redirect instead of confusing 410 (in case anyone has an old
  email-link bookmark).
- Removed the dead `grabio:pro_redeem:<token>` mint from the webhook
  handler (writer prefix never matched the reader's `grabio:activation:`
  prefix — structurally dead since v3.0.0).

### Landing page polish

- Hero image swapped to the Step-1 Adding-Shortcut screenshot.
- Step-3 image placeholder hidden (pending real screenshot upload).
- "See it in action" demo video section commented out (pending new v3
  recording).

## [3.2.0] — 2026-05-17

### Added — Pro onboarding via Brevo

Brevo is back in the stack but only for Pro customer onboarding. Free users still have **zero email collected**. The flow:

1. User buys Pro on Polar → Polar webhook fires `subscription.created` / `benefit_granted`.
2. Server extracts `data.customer.email` and pushes the contact into **Brevo list #9** with `PRO_PURCHASE_DATE` attribute.
3. Brevo dashboard automations fire on schedule: **Day 1** thank-you, **Day 2** + **Day 7** feedback prompts. Configured in Brevo UI, no code on Grabio's side.
4. Grabio's own Redis still stores no email — the address lives only inside Brevo.

### Changed

- Privacy Policy updated:
  - TL;DR now mentions Brevo for Pro buyer onboarding (Day 1/2/7).
  - Subprocessor table re-adds Brevo (France, EU) as Pro-only.
  - Data table adds a row for "Pro buyer email — relayed from Polar to Brevo".

### Why

User research on the v3 launch showed Pro customers want a confirmation + a quick feedback channel. Brevo handles three transactional/onboarding emails per Pro signup with zero ongoing marketing list bloat. Free users gain nothing from being emailed; they stay opt-out by design.

## [3.1.0] — 2026-05-17

### Added — sharing-first UX

Every feature is now reachable from the iOS share sheet. No text-input or paste flows.

- **Share a webpage URL → /v2/menu returns "Save as PDF / Save as Image / Copy link"**. New `url-to-pdf-share` and `url-to-image-share` option_ids in `/v2/run` produce a clean PDF (puppeteer A4) or a full-page PNG screenshot.
- **Share a QR code image → "🔳 Decode QR Code" appears in image submenu**. Server runs `sharp` + `jsqr` to extract the text. If the QR contains a URL, the response includes `open_url` so the Shortcut can offer to open it.
- New `/api/v3/qr/decode` endpoint (multipart image upload → `{found, text, is_url}` JSON).

### Changed

- Image submenu now has **9 options** (was 8): added 🔳 Decode QR Code.
- URL-direct (any non-social webpage) no longer shows the v3 pitch — it now goes straight to the Save-as menu.
- URL-social (TikTok / IG / YouTube / Facebook) still shows the pitch — social downloads remain retired in v3.
- Landing page copy updated: "QR Generator" → "Decode QR Code", URL feature card now reads "Share webpage → PDF/Screenshot" instead of marketing speak.

### Why

Apple Shortcuts are great because the share sheet is the entry point. Asking users to type or paste defeats the point. Every claimed feature on the landing page must be invokable by "Share → Grabio" with zero typing.

## [3.0.0] — 2026-05-17

### Added

Ten new file-utility endpoints, all rate-limited (5/day free, 30/day Pro):

- `POST /api/v3/resize` — Photo resize with 16 social-media presets (instagram-square, twitter-post, youtube-thumb, 4K, 1080p, etc.), plus custom width×height and percent modes.
- `POST /api/v3/bg-fill` — Flatten transparent images with white/black/hex background fill.
- `POST /api/v3/compress-exact` — Compress to an exact target KB ±8% via iterative JPEG quality binary search.
- `POST /api/v3/pdf/from-photo` — Single photo → PDF (auto, A4, or Letter sizing).
- `POST /api/v3/pdf/from-photos` — Multi-photo → combined PDF (up to 25 photos).
- `POST /api/v3/pdf/combine` — Merge multiple PDFs into one.
- `POST /api/v3/pdf/extract-pages` — Extract pages by spec like `1,3,5-7`.
- `POST /api/v3/pdf/delete-pages` — Drop pages, keep the rest.
- `POST /api/v3/pdf/compress` — Ghostscript-driven PDF compression with screen/ebook/printer/prepress profiles.
- `POST /api/v3/url/to-pdf` — Render any webpage to PDF via Puppeteer + headless Chrome.

Plus the existing `POST /api/v3/qr` (QR code PNG generator).

### Changed — Privacy architecture (major)

- **Dropped Brevo (transactional email provider) entirely.** Grabio now sends zero emails. The previous "license key emailed on purchase" flow is gone.
- **Pro entitlement is now device-bound at purchase time.** Polar checkout receives `metadata.device_id` (your iPhone's SHA-256 hash). The Polar webhook writes a single Redis key — `grabio:pro:<hash>` — and unlock is instant on next API call. **No email is stored on Grabio's server.**
- **Removed all email-collection surfaces.** The landing-page email-subscribe form is gone. The `/subscribe` endpoint returns `410 Gone`. The PRIVACY.md "Email (Pro only)" row is replaced with "Polar subscription ID + device hash binding".
- **New `/admin/api/rebind` endpoint** lets the operator move a Pro entitlement to a new iPhone manually (used when users contact support after device replacement). Replaces the old "email the license key" recovery flow.
- **`/pro/success`** now shows two paths: iPhone visitors see "✨ Pro is active on this iPhone"; desktop visitors see a "📱 open this on your iPhone or email us your Polar receipt" fallback.

### Removed

- Brevo subprocessor (was in PRIVACY subprocessor table).
- All `sendActivationEmail()` calls in the Polar webhook (neutralized to no-ops).
- The email-collection section of the landing page.

### Why

Architecture reset: Polar is a Merchant of Record, so it already holds the buyer's email and handles the receipt. Storing that email a second time on Grabio's server only adds breach surface for zero user benefit. The device-bound model means the worst-case breach reveals zero personal data — there is no `email` column anywhere in Redis.

## [2.1.0] — 2026-05-17

### Removed

- **URL Save Media (social media downloader)** — permanently removed from Grabio. The feature was always hidden under Advanced and never marketed, but it created legal and payment-processor risk that no longer fits Grabio's strategy. Grabio is now exclusively a file-utilities tool: compress, convert, PDF, background remove, QR, privacy strip. All payment processors and merchant-of-record platforms now treat Grabio as low-risk SaaS.

### Changed

- `/download` endpoint now returns 410 Gone with a "feature removed, update Grabio" message
- `/v2/menu` rejects any social-platform URL with the same message
- `/health` no longer advertises the third-party media backend
- Welcome prompt reframed from "Download · Convert · Resize" to "Compress · Convert · PDF · BG Remove"
- Privacy policy subprocessor table dropped the "Third-party media API" row
- Terms §5 dropped the neutral-conduit / user-supplied-URL language

### Why

Decision D-79: Going fully legal to enable clean payment processing on Polar.sh or any mainstream MoR. Trades 1 niche feature for unrestricted growth runway.

## [2.0.2] — 2026-05-15

### Fixed

- iPhone HEVC video files (`hvc1` / `hev1` brands) now correctly route to the MP4 pipeline instead of crashing ffmpeg. Resolves "convert failed" alerts on iOS 17+ camera output.
- Added detection for `iso2`, `iso5`, `iso6`, `M4A `, `WAV`, `OGG`, `FLAC`, `AAC`, `WebM` magic bytes so the backend recognizes more file types from raw uploads.

### Added

- Hourly Redis RDB snapshot to encrypted disk, 24-hour rotation.
- RunCloud cron-managed backup orchestration (no user crontab, visible/manageable from the panel).

### Privacy

- D-77 / D-78 locked: operator's public-surface location is "India" (no city, no state). Applied to landing footer, legal pages, payment processor KYC, GitHub README.

## [2.0.1] — Earlier 2026

- Added Pro tier ($3/month → 30 actions/day) via DodoPayments.
- Brevo transactional email integration for license delivery.
- Plausible self-hosted analytics (aggregate page views only, no personal data).

## [2.0.0] — Earlier 2026

- Original launch: free utility shortcut with rate-limit backend.

---

For older history (v1 — closed beta), see internal docs. The v1 shortcut is no longer supported; users on v1 are prompted to update.
