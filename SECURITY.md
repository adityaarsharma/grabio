# Security Policy

## Reporting a vulnerability

If you've found a security issue in Grabio — the Apple Shortcut, the backend at `grabio.adityaarsharma.com`, or anywhere data is processed — please report it privately so we can fix it before it's public.

**Email:** [grabio@adityaarsharma.com](mailto:grabio@adityaarsharma.com)
**Subject line prefix:** `[SECURITY]`

Encryption: ask for a PGP key in your first email if you need to send anything sensitive. We'll respond with one within 24 hours.

### What to include

- A clear description of the issue
- Steps to reproduce (curl commands, screenshots, request/response pairs)
- Why you think it's a security issue (impact, affected users)
- Whether you've already disclosed it publicly anywhere

### What to expect from us

- **Acknowledgement within 24 hours** (often within a few hours during weekdays)
- A timeline for a fix, usually within 7 days for serious issues
- Credit in the [`CHANGELOG.md`](./CHANGELOG.md) once the fix ships, unless you'd rather stay anonymous
- No legal action against good-faith security research

### What's in scope

| In scope | Out of scope |
|---|---|
| Authentication bypass on `/admin` | Self-XSS that requires the victim to paste a payload |
| Server-side injection (SQLi, command injection, SSRF) | Vulnerabilities in third-party services (Brevo, payment processors) — please report directly to them |
| Leaking SHA-256 hashes or Pro emails | Findings that require physical access to the server |
| Bypassing the rate limit | UX issues, design feedback (use the regular issues tab) |
| File processing pipelines exfiltrating data | Vulnerabilities in user iPhones / iOS / Apple Shortcuts core |
| Privacy posture mismatches vs. [`PRIVACY.md`](./PRIVACY.md) | Spam / phishing reports against the operator's email |

### What we will NOT do

- Threaten legal action against good-faith researchers
- Ask for your real name unless you choose to share it
- Publicly disclose your identity without explicit permission

## Supported versions

| Version | Supported |
|---|---|
| Latest Shortcut on grabio.adityaarsharma.com | ✅ Yes |
| Older Shortcut binaries | ⚠️ Update via the site for fixes |
| Forks / clones | ❌ Not supported |

The backend is single-tenant and is always running the latest patched version. The Shortcut auto-prompts to update when a new version is required.

## Bounty?

No formal bug bounty program yet (Grabio is a solo project with a small revenue base). For genuinely serious findings (account takeover, data exfiltration, mass-impact rate-limit bypass), I'll happily offer:

- A free year of Grabio Pro
- A public credit on `CHANGELOG.md` and a thank-you post if you'd like one
- A handwritten note (yes, paper) if your fix saved real users from real harm

This is not a substitute for a bounty — it's a thank-you, not a transaction.

---

For any security question that doesn't fit the above, just email [grabio@adityaarsharma.com](mailto:grabio@adityaarsharma.com). Human reply within 24 hours.
