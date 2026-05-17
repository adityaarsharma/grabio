# verify/ — Verify Grabio's privacy claims yourself

This is a small Node CLI that hits the live Grabio backend and **mechanically validates** every privacy claim in [`../PRIVACY.md`](../PRIVACY.md).

You don't have to trust the privacy policy. You can run this, see real responses, and decide.

## What it checks

| Claim from PRIVACY.md | What the script verifies |
|---|---|
| HTTPS only | All endpoints return 200 over TLS, no plain-HTTP fallback |
| No tracking cookies | `Set-Cookie` headers absent on landing, blog, legal pages |
| No third-party trackers on landing | HTML scan for known tracker domains (Google Analytics, FB Pixel, Hotjar, Mixpanel, etc.) — must be zero hits |
| Self-hosted fonts only | All `@font-face` URLs are same-origin (`/fonts/...`) |
| Analytics is cookieless | The Plausible script tag is the only analytics, and it's served from `analytics.adityaarsharma.com` |
| Rate-limit headers exposed | `RateLimit-*` headers present on subscribe endpoint |
| Subscribe spam protection works | A POST with empty Turnstile token gets `spam_check_failed` (not silently accepted) |
| Honeypot field is hidden | The `name="company"` input has `aria-hidden` + off-screen positioning in the HTML |
| Blog REST API works | `/api/blog/posts` returns ok:true with categories array |
| Legal pages have schema | Each of /terms /privacy /refund returns a JSON-LD `<script>` |
| Cross-domain canonical pointing to Grabio | The CMS-of-record (adityaarsharma.com) posts in the Grabio category set `rel=canonical` to grabio.adityaarsharma.com |
| Sitemap exposes only Grabio URLs | `/sitemap.xml` contains landing + blog + legal, no internal admin paths |

## Run it

```bash
cd verify
npm install
node verify-privacy.js
```

You'll see a pass/fail table for each check. Anything that fails opens an obvious target for a [SECURITY](../SECURITY.md) report.

You can also target a different host (useful if you're testing a local clone or a future staging environment):

```bash
GRABIO_HOST=https://grabio.adityaarsharma.com node verify-privacy.js
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All checks passed |
| 1 | One or more checks failed (CI-friendly) |
| 2 | Network error / host unreachable |

## Why this matters

Privacy policies are normally a vibe document — vague language designed to satisfy a regulator without committing to anything testable. This script reframes those promises as **assertions**. If a future version of Grabio adds a tracker or starts setting cookies, the check fails and any user running this locally sees it instantly.

It's not a substitute for full source access. It's the next-best thing: a public, reproducible audit you can run any time.

## Contributing checks

Open a PR. Each check is a 10-30 line function in `verify-privacy.js`. If you find a privacy claim in the policy that we don't yet verify mechanically, add it.

Good additions:
- TLS cipher inspection (ensure no weak suites)
- DNS records (CAA, SPF, DMARC)
- HSTS header value
- Cloudflare WAF rule sanity (e.g. confirm `/admin/*` returns 401 from the public internet)

Bad additions:
- Anything that requires authentication
- Anything that hits the Shortcut-only endpoints (they're rate-limited per device hash and not designed for third-party calls)
