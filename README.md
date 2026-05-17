# Grabio

> **The iPhone utility toolkit. One Apple Shortcut. 23 file utilities. No app, no signup, no tracking.**

[![Website](https://img.shields.io/badge/website-grabio.adityaarsharma.com-ea580c?style=flat-square)](https://grabio.adityaarsharma.com)
[![Privacy](https://img.shields.io/badge/privacy-first-16a34a?style=flat-square)](./PRIVACY.md)
[![License](https://img.shields.io/badge/docs-MIT-blue?style=flat-square)](./LICENSE)
[![iOS](https://img.shields.io/badge/iOS-14%2B-000000?style=flat-square&logo=apple&logoColor=white)](#)

This repository is a **transparency layer** for Grabio — a privacy-first iPhone utility toolkit that lives inside the iOS share sheet. It documents what Grabio is, what it collects, how it processes your files, your rights under GDPR / CCPA, and how to report security issues.

> ⚠️ **This is not the shipping source code.** Grabio runs as an Apple Shortcut + a private Node/Express backend on Hetzner (Germany). This repo exists so anyone can audit our privacy posture, architecture, and contractual surface before installing the Shortcut.

## Install Grabio

The Shortcut is distributed via iCloud (no App Store needed). One tap, no sign-up, free forever for 5 actions/day.

→ **[grabio.adityaarsharma.com](https://grabio.adityaarsharma.com)**

## Quick facts

| | |
|---|---|
| **What it is** | An iOS 14+ Apple Shortcut that adds 23 file utilities to your iPhone share sheet |
| **What it does** | Compress, convert, PDF tools, background remove, QR codes, photo resize, format conversion, privacy stripping |
| **Free tier** | 5 actions/day, every utility, forever |
| **Pro tier** | $3/month → 30 actions/day. 7-day refund, no questions. |
| **Where it runs** | Backend on Hetzner Online GmbH, Germany (EU). Files processed in memory or in a permission-locked temp folder. |
| **What it collects** | SHA-256 hash of your iOS device identifier (rate-limit only). Pro users: email + license key. **No name, no phone, no IP stored long-term.** |
| **What it retains** | Device hash: 30 days rolling · daily counter: 48h · files: ≤1 hour · request logs: 24h |
| **Trackers** | **None.** No Google Analytics, no Facebook Pixel, no third-party ad SDKs. Plausible (self-hosted) for aggregate page views only. |
| **License** | Documentation in this repo: MIT. The Apple Shortcut itself is closed-source. |

## What you'll find in this repo

| File / dir | What it covers |
|---|---|
| [`PRIVACY.md`](./PRIVACY.md) | Architecture, data-flow diagrams, retention table, GDPR rights, subprocessors |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | How the Shortcut, the backend, and the Redis layer fit together |
| [`SECURITY.md`](./SECURITY.md) | Responsible disclosure — how to report a vulnerability |
| [`CHANGELOG.md`](./CHANGELOG.md) | Public release history |
| [`openapi.yaml`](./openapi.yaml) | Machine-readable contract for every public endpoint |
| [`verify/`](./verify) | **Runnable Node CLI** that mechanically validates every privacy claim against the live host |
| [`reference/`](./reference) | MIT-licensed reference modules (device hashing, TTL janitor, sliding-window rate limiter, bot-resistant subscribe) |
| [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE) | Templates for bugs, feature requests, privacy questions |

### Run the privacy verifier

You don't have to take the docs at face value. Clone this repo and run:

```bash
cd verify
node verify-privacy.js
```

It hits the live host and checks 15+ claims (no cookies, no trackers, self-hosted fonts, rate-limit headers, JSON-LD on legal pages, sitemap exclusions, HSTS, etc.). Exits 0 if all pass, 1 if any fail. Anything that fails is a [SECURITY.md](./SECURITY.md) report waiting to happen.

## Why open this up

When a free privacy tool comes from a single solo developer, the obvious next thought is: "wait, what's the catch?". The catch is normally **your data**. This repo exists so you can verify there isn't one before you install anything.

You can:

- Read [`PRIVACY.md`](./PRIVACY.md) to see exactly what hits the server.
- Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) to see why the architecture makes it structurally impossible for the operator to see your files.
- Run your own HTTPS inspector (Charles Proxy on iPhone) and confirm the only thing Grabio sends is a SHA-256 hash + the file you're processing — no telemetry, no identifiers.
- File a privacy question via the issue template if anything looks off.

## How the Shortcut works (in plain English)

1. You install the Shortcut from iCloud (one tap).
2. The Shortcut adds itself to your iOS share sheet.
3. When you tap Share → Grabio on any file, the Shortcut sends the file to our backend over HTTPS.
4. The backend processes the file in memory (compress, convert, etc.) and returns the result.
5. The result lands back in Photos or Files. The original file on the server is deleted within 1 hour.

No account, no email, no telemetry. The backend's database is a row of integers (`hash:date = count`) for rate-limiting. That's it.

## Operator

Grabio is operated by **Aditya R Sharma**, an independent developer.

- 📧 [grabio@adityaarsharma.com](mailto:grabio@adityaarsharma.com) — human reply within 24 hours on weekdays
- 🌐 [adityaarsharma.com](https://adityaarsharma.com) — personal site
- 🛡 [Privacy Policy](https://grabio.adityaarsharma.com/privacy) · [Terms](https://grabio.adityaarsharma.com/terms) · [Refund](https://grabio.adityaarsharma.com/refund)

## Contributing

Issues + privacy questions: open in the [Issues tab](https://github.com/adityaarsharma/grabio/issues).

Pull requests on **this docs repo** are welcome — typos, clarifications, architecture corrections, additions to the privacy table.

Code contributions to the Apple Shortcut or the backend are not accepted (closed-source for legal-surface reasons).

## License

The documentation in this repository is released under [MIT](./LICENSE).
The Grabio Apple Shortcut and backend service are proprietary.

---

<sub>Built solo by [Aditya R Sharma](https://adityaarsharma.com), in public.</sub>
