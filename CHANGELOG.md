# Changelog

All notable user-facing changes to the public Grabio Shortcut and backend.

The format follows [Keep a Changelog](https://keepachangelog.com/) loosely. Semver applies to the Shortcut binary version users see on iCloud.

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
