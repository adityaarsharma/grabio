# Changelog

All notable user-facing changes to the public Grabio Shortcut and backend.

The format follows [Keep a Changelog](https://keepachangelog.com/) loosely. Semver applies to the Shortcut binary version users see on iCloud.

## [Unreleased]

- v3 — 23 file utilities across compress / convert / PDF / photo / privacy / URL → X
- Open-source transparency repo (this one)

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
