# Privacy Architecture

> **TL;DR:** We collect almost nothing about you. No name, no real email unless you go Pro, no phone, no IP stored long-term. Your files are deleted within 1 hour. No ads, no analytics on your behaviour, no data resale. There is literally nothing on our server to leak.

The canonical Privacy Policy lives at **[grabio.adityaarsharma.com/privacy](https://grabio.adityaarsharma.com/privacy)** and is the legally binding document.

This file is the technical companion: how the architecture *makes* the privacy posture true, not just the legal text.

---

## What we collect, and why

| Data | Why | Lawful basis (GDPR) | Retention |
|---|---|---|---|
| SHA-256 hash of your iOS device identifier | Rate-limit free tier (5 actions/day) + bind Pro license to one device | Legitimate interest (free) / Contract (Pro) | 30 days rolling |
| Daily action counter per device | Enforce free-tier daily cap | Legitimate interest | 48 hours |
| Files you share to Grabio | Process the requested action (compress, convert, etc.) | Contract performance | **≤ 1 hour, then deleted** |
| Email address (Pro only) | Deliver purchase receipt + license key | Contract performance | Subscription lifetime + 1 year |
| Pro license key (random 32-char string) | Activate Pro on your iPhone | Contract performance | Subscription lifetime + 1 year |
| IP address | Per-request rate-limit window only | Legitimate interest | Discarded within 1 hour, never persisted |
| Request metadata (endpoint, status, time) | Server health monitoring + debugging | Legitimate interest | 24 hours |

## What we do not collect

- No name. No phone. No address.
- No behavioural analytics tied to you.
- No third-party ad networks. No Google Analytics. No Facebook Pixel. None.
- No content of your files or URLs is logged. Bytes are processed and forgotten.
- No fingerprinting. No tracking cookies. No cross-site identifiers.

## Subprocessors

We use the smallest possible set of third-party services that touch any Grabio data. Each one is chosen for minimal data exposure.

| Provider | Country | Purpose | Data they receive |
|---|---|---|---|
| Hetzner Online GmbH | Germany (EU) | Server hosting | All processed data in transit + 1-hour cache |
| Plausible (self-hosted) | Germany | Aggregate page-view analytics | No personal data; aggregate counts only |
| Brevo | France (EU) | Transactional email (license delivery) | Pro user email + license key |
| Polar.sh **or** DodoPayments | United States | Payment processing for Pro | Email + card data (we never see card numbers) |
| Cloudflare | United States | DNS for grabio.adityaarsharma.com | Inferred IP at DNS resolution (not stored by us) |
| Apple iCloud | International | Distributes the Shortcut binary | Anonymous to us; Apple's terms apply |

## Architecture diagram

```
                       ┌────────────────────────────────────────┐
                       │            Your iPhone                 │
                       │  • Apple Shortcut (local)              │
                       │  • SHA-256 hashes your device name     │
                       │  • License key cached in Shortcut var  │
                       └─────────────┬──────────────────────────┘
                                     │ HTTPS (TLS 1.3)
                                     ▼
                    ┌────────────────────────────────────────────┐
                    │  grabio.adityaarsharma.com → Hetzner DE    │
                    │                                            │
                    │  ┌───────────────────────────────────────┐ │
                    │  │  Node / Express backend               │ │
                    │  │  • Receives file in memory            │ │
                    │  │  • Runs ffmpeg / sharp / pdf-lib /    │ │
                    │  │    rembg / Puppeteer locally          │ │
                    │  │  • Returns result to Shortcut         │ │
                    │  │  • Deletes file within 1 hour         │ │
                    │  └───────────────┬───────────────────────┘ │
                    │                  │                         │
                    │                  ▼                         │
                    │  ┌───────────────────────────────────────┐ │
                    │  │  Redis (localhost, password-gated)    │ │
                    │  │  • grabio:usage:<hash>:date = count   │ │
                    │  │  • grabio:pro:<hash> = expires_at     │ │
                    │  │  • grabio:license:<key> = JSON meta   │ │
                    │  │  ← That is the entire database.       │ │
                    │  └───────────────────────────────────────┘ │
                    └────────────────────────────────────────────┘
                              │                              ▲
                              │ payment + license            │ Pro purchase only
                              ▼                              │
                ┌─────────────────────────┐       ┌────────────────────────┐
                │ Brevo (FR) — email      │       │ Polar.sh / DodoPayments│
                │ Pro license delivery    │       │ (US) — card processing │
                └─────────────────────────┘       └────────────────────────┘
```

## Why a hacker would find nothing useful

If the Hetzner server were fully compromised, the attacker would find a Redis instance with rows like:

```
grabio:usage:c5d8...e3:2026-05-16  =  4
grabio:usage:91a7...0b:2026-05-16  =  2
grabio:pro:c5d8...e3                =  2027-05-15T00:00:00Z
grabio:license:GR-x82f-p4qz...       =  {"email_hash":"…","activated":"2026-05-15"}
```

- No file content — files were deleted within 1 hour and exist only on disk during active processing
- No real emails — Pro emails are stored encrypted at rest with the system disk encryption only; never indexed
- No IPs — discarded within 1 hour, never persisted to Redis or disk logs
- No URLs — never logged
- No tracking IDs — nothing to correlate to a person

The worst-case data breach for Grabio is genuinely **boring**, and that's the point.

## Your rights

| GDPR right | How to exercise |
|---|---|
| **Access (Art. 15)** | Email [grabio@adityaarsharma.com](mailto:grabio@adityaarsharma.com) with your device hash or Pro purchase ID. JSON export within 7 days. |
| **Rectification (Art. 16)** | Email us to update your Pro email. The only correctable field. |
| **Erasure (Art. 17)** | Email us. We purge your device hash, Pro license, audit log entries, and any backups within 30 days. |
| **Portability (Art. 20)** | JSON export, same flow as Access. |
| **Objection (Art. 21)** | Stop using Grabio. Rate-limit data ages out within 48 hours. |
| **Complaint (Art. 77)** | Your country's data protection authority. |

CCPA (California), LGPD (Brazil), PIPEDA (Canada), UK GDPR, EU GDPR — all covered.

## Security posture

- HTTPS everywhere (Let's Encrypt)
- Redis password-protected and bound to localhost
- Device identifiers hashed with SHA-256 before storage
- Files processed in memory or in a permission-restricted temporary folder, then deleted by a cleanup cron within 1 hour
- Admin dashboard is HTTP Basic Auth + HMAC-signed session cookies
- Backups are encrypted at rest on Hetzner and rotate every 24 hours
- Rate limiting at IP + device-hash levels via Redis-backed sliding windows

## Children

Grabio is not directed at children under 16. We do not knowingly process data from anyone under 16. If you believe a child has used Grabio, email us and we will purge any related device hash immediately.

## Audit it yourself

You don't have to trust this document. You can verify it:

1. Open Charles Proxy (or any HTTPS inspector) on your iPhone
2. Trust the Charles root cert
3. Fire any Grabio action
4. Watch the bytes

You will see exactly two things: a SHA-256 hash of your device name, and the file or URL you're processing. No telemetry. No third-party SDKs. No "anonymous analytics".

---

For the legally binding version (and any updates), the canonical Privacy Policy is at **[grabio.adityaarsharma.com/privacy](https://grabio.adityaarsharma.com/privacy)**. Last updated 16 May 2026.
