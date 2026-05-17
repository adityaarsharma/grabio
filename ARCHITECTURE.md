# Architecture

How Grabio fits together. This is the audit-friendly companion to [`PRIVACY.md`](./PRIVACY.md).

## Three moving parts

1. **The Apple Shortcut** — runs on your iPhone. Local-only. Hashes your device name, signs HTTPS requests, parses responses, drops the result into Photos / Files.
2. **The backend** — Node.js + Express, monolithic, on Hetzner Online GmbH in Germany. Receives a file, runs a single CLI/library (ffmpeg, sharp, pdf-lib, rembg, Puppeteer), returns the result.
3. **Redis** — running on the same machine, password-gated, bound to `localhost`. Holds 4 kinds of keys, all with TTLs.

That's it. No microservices. No queue brokers. No third-party AI in the hot path (one rare exception: a single LLM call for the optional URL summary feature, capped at $0.0001/request).

## Request shape

Every action follows the same flow:

```
iPhone Shortcut ──HTTPS──▶ Express  ──┐
                                      ├─▶ process (ffmpeg / sharp / pdf-lib / rembg / puppeteer)
                                      │
                                      └─▶ rate-limit check (Redis)
                                                 ▼
                              ◀────────  result back to Shortcut
                                                 │
                                                 ▼
                                        file deleted within 1 hour
```

The Shortcut never writes anything to Redis directly. The backend is the only writer.

## Redis schema (the entire database)

```
grabio:usage:<sha256-device-hash>:YYYY-MM-DD   String (int) — daily action count   TTL: 48h
grabio:pro:<sha256-device-hash>                String (epoch) — Pro expiry         TTL: matches subscription
grabio:license:<key>                           Hash — { email_hash, activated_at } TTL: subscription + 1y
grabio:metrics:*:YYYY-MM-DD                    String/HLL — aggregate counters     TTL: 30d
```

That's the full surface. No file content, no URLs, no IPs, no real emails, no device names — only their SHA-256 hashes.

## Why we can't see your files

The backend processes files **in memory** (or in a permission-locked `/tmp` subdirectory when the tool requires disk I/O — e.g. ffmpeg). No file path is logged. No bytes are persisted to a database. The cleanup cron runs every minute and removes anything older than:

- Temp processing buffer: **5 minutes**
- User-uploaded source: **5 minutes**
- Output cache (returned to Shortcut): **≤ 1 hour**

After 1 hour, the file is unrecoverable even with full disk access. (Backups don't capture `/tmp`.)

## Why we can't tie hashes to people

The hash is `SHA-256(device_name + static_salt)`. We never see the pre-image. The Shortcut computes the hash locally and sends only the digest. You could uninstall, change your iPhone name, and reinstall — and the new hash would not be linkable to the old one without you telling us.

## Why the operator can't see what you processed

The architecture has no admin endpoint that returns file content, URLs, or processed data. The admin dashboard surfaces:

- Aggregate daily counts (totals + per-feature breakdown)
- Per-device hash usage (number only, not content)
- Health metrics (request rate, error rate, queue depth)
- A 200-row rolling log of request *metadata* (endpoint, status code, duration — no payload)

There's no "show me what device X processed today" endpoint. Building one would require modifying the code, redeploying, and **still** finding the file before the 1-hour cleanup. It's structurally infeasible to do at scale or retroactively.

## Why this is hard to walk back

Once you ship a privacy posture, every future feature has to fit inside it. If we wanted to add (say) cloud sync, we'd have to:

1. Either store file content (breaks "no file retention") — visible in a diff
2. Or store user identity (breaks "no accounts") — visible in a diff
3. Or build a separate consented product, leaving Grabio alone

We're choosing option 3 every time. Anything that requires persistent user data will be a separate product, not bolted onto Grabio.

## Build & deploy

- **Language:** Node.js 22 LTS
- **Web framework:** Express + ioredis
- **Process manager:** PM2 (single fork worker)
- **Reverse proxy:** RunCloud (nginx + Cloudflare in front)
- **Server:** Hetzner CX31 (Ampere ARM, Falkenstein DE)
- **TLS:** Let's Encrypt, auto-renew via certbot
- **Backups:** Hourly Redis RDB snapshot to encrypted disk, rotating 24 hours
- **Monitoring:** Sentry (errors only, no user PII), Telegram alerts for backend health

## What's intentionally not in this repo

- The Express server source (`index.js`)
- The Apple Shortcut binary
- Any code that previously called third-party media APIs (the feature was removed 2026-05-17 — see CHANGELOG)
- API keys, env files, secrets

The repo's purpose is **transparency about privacy**, not reproducible builds. The shipping product is closed-source for legal-surface reasons (rate-limit logic, billing, abuse prevention). If you need to verify a specific privacy claim against real behaviour, run an HTTPS inspector on your iPhone (Charles Proxy works well) and watch the wire.

## Questions?

Open an issue with the `privacy-question` template, or email [grabio@adityaarsharma.com](mailto:grabio@adityaarsharma.com).
