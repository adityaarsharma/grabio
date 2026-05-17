# Privacy Architecture

> **TL;DR:** We collect almost nothing about you. No name. **No email — not even for Pro** (your email stays with Polar, our payment processor). No phone. No IP stored long-term. Your files are deleted within 1 hour. No ads, no analytics on your behaviour, no data resale. There is literally nothing on our server to leak.

The canonical Privacy Policy lives at **[grabio.adityaarsharma.com/privacy](https://grabio.adityaarsharma.com/privacy)** and is the legally binding document.

This file is the technical companion: how the architecture *makes* the privacy posture true, not just the legal text.

---

## What we collect, and why

| Data | Why | Lawful basis (GDPR) | Retention |
|---|---|---|---|
| SHA-256 hash of your iOS device identifier | Rate-limit free tier (5 actions/day) + bind Pro to one device | Legitimate interest (free) / Contract (Pro) | 30 days rolling |
| Daily action counter per device | Enforce free-tier daily cap | Legitimate interest | 48 hours |
| Files you share to Grabio | Process the requested action (compress, convert, etc.) | Contract performance | **≤ 1 hour, then deleted** |
| Polar subscription ID + device-hash binding (Pro only) | Unlock Pro on the iPhone that paid. Your **email is held by Polar**, not by Grabio. | Contract performance | Subscription lifetime + 35-day grace |
| IP address | Per-request rate-limit window only | Legitimate interest | Discarded within 1 hour, never persisted |
| Request metadata (endpoint, status, time) | Server health monitoring + debugging | Legitimate interest | 24 hours |

## What we do not collect

- **No email.** Pro purchase emails sit with Polar (Merchant of Record). Grabio's database has no email column anywhere.
- No name. No phone. No address.
- No behavioural analytics tied to you.
- No third-party ad networks. No Google Analytics. No Facebook Pixel. None.
- No content of your files or URLs is logged. Bytes are processed and forgotten.
- No fingerprinting. No tracking cookies. No cross-site identifiers.

## How Pro activation works (no email required on Grabio's side)

1. You tap **Get Pro** in the iOS Shortcut.
2. The Shortcut opens `grabio.adityaarsharma.com/pro/checkout/monthly?device_id=<sha256-of-your-device>`.
3. The server passes that device hash to Polar as `metadata.device_id` and redirects you to Polar's checkout.
4. Polar collects your email and card. Polar — not Grabio — sends the receipt.
5. Polar's webhook fires to Grabio with `metadata.device_id` + the subscription ID.
6. Grabio writes a single Redis key: `grabio:pro:<device_hash>` = `{polar_subscription_id, expires_at}`. **No email is stored.**
7. The Shortcut sees Pro is active on the next call and unlocks higher limits.

If you replace your iPhone, you contact `grabio@adityaarsharma.com` with your Polar receipt ID. The operator unbinds the old hash via the admin endpoint and shares a fresh activation URL. No license keys, no codes to enter, no email lookup on Grabio's side.

## Subprocessors

We use the smallest possible set of third-party services that touch any Grabio data.

| Provider | Country | Purpose | Data they receive |
|---|---|---|---|
| Hetzner Online GmbH | Germany (EU) | Server hosting | All processed data in transit + 1-hour cache |
| Plausible (self-hosted) | Germany | Aggregate page-view analytics | No personal data; aggregate counts only |
| Polar.sh (Merchant of Record) | United States | Payment processing, VAT/tax compliance, receipt email to buyer | Buyer email + card data (we never see card numbers; **Polar keeps the email, not us**) |
| Cloudflare | United States | DNS for grabio.adityaarsharma.com | Inferred IP at DNS resolution (not stored by us) |
| Apple iCloud | International | Distributes the Shortcut binary | Anonymous to us; Apple's terms apply |

## Architecture diagram

```
                       ┌────────────────────────────────────────┐
                       │            Your iPhone                 │
                       │  • Apple Shortcut (local)              │
                       │  • SHA-256 hashes your device name     │
                       │  • Pro status cached locally           │
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
                    │  │    rembg / Puppeteer / ghostscript    │ │
                    │  │  • Returns result to Shortcut         │ │
                    │  │  • Deletes file within 1 hour         │ │
                    │  └───────────────┬───────────────────────┘ │
                    │                  │                         │
                    │                  ▼                         │
                    │  ┌───────────────────────────────────────┐ │
                    │  │  Redis (localhost, password-gated)    │ │
                    │  │  • grabio:usage:<hash>:date = count   │ │
                    │  │  • grabio:pro:<hash> = expires_at     │ │
                    │  │  ← That is the entire database.       │ │
                    │  │     No email column. Anywhere.        │ │
                    │  └───────────────────────────────────────┘ │
                    └────────────────────────────────────────────┘
                                                   ▲
                                                   │ Pro purchase only
                                                   │ (webhook: metadata.device_id)
                                                   │
                                       ┌────────────────────────┐
                                       │ Polar.sh (US)          │
                                       │ Merchant of Record:    │
                                       │ holds buyer email,     │
                                       │ card data, VAT records │
                                       └────────────────────────┘
```

## Why a hacker would find nothing useful

If the Hetzner server were fully compromised, the attacker would find a Redis instance with rows like:

```
grabio:usage:c5d8...e3:2026-05-16  =  4
grabio:usage:91a7...0b:2026-05-16  =  2
grabio:pro:c5d8...e3                =  {"polar_subscription_id":"sub_xxx","expires_at":"2026-06-17T00:00:00Z"}
```

- **No emails** — none are stored. Pro emails live at Polar.
- No file content — files deleted within 1 hour, exist only during active processing
- No IPs — discarded within 1 hour, never persisted
- No URLs — never logged
- No tracking IDs — nothing to correlate to a person

The worst-case data breach for Grabio is genuinely **boring**, and that's the point.

## Your rights

| GDPR right | How to exercise |
|---|---|
| **Access (Art. 15)** | Email [grabio@adityaarsharma.com](mailto:grabio@adityaarsharma.com) with your Polar receipt ID. JSON export within 7 days. For email/receipt itself, contact Polar. |
| **Rectification (Art. 16)** | Grabio holds no editable personal data on you. Email/billing changes go to Polar. |
| **Erasure (Art. 17)** | Email us with your Polar receipt ID. We purge your device hash, Pro entitlement, audit log entries, and any backups within 30 days. |
| **Portability (Art. 20)** | JSON export, same flow as Access. |
| **Objection (Art. 21)** | Stop using Grabio. Rate-limit data ages out within 48 hours. |
| **Complaint (Art. 77)** | Your country's data protection authority. |

CCPA (California), LGPD (Brazil), PIPEDA (Canada), UK GDPR, EU GDPR — all covered.

## Security posture

- HTTPS everywhere (Let's Encrypt)
- Redis password-protected and bound to localhost
- Device identifiers hashed with SHA-256 before storage
- Files processed in memory or in a permission-restricted temporary folder, then deleted by a cleanup cron within 1 hour
- Admin dashboard is HMAC-signed session cookies
- Polar webhook signatures verified via Standard Webhooks HMAC-SHA256
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

For the legally binding version (and any updates), the canonical Privacy Policy is at **[grabio.adityaarsharma.com/privacy](https://grabio.adityaarsharma.com/privacy)**. Last updated 17 May 2026.
