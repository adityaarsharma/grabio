# reference/ — Privacy patterns we use in production

Small, MIT-licensed, copy-pasteable Node modules that demonstrate **how** Grabio implements the privacy claims documented in [`../PRIVACY.md`](../PRIVACY.md).

These are not the actual Grabio source files. They're cleaned-up reference implementations of the same patterns. Use them in your own indie SaaS — they're battle-tested at ~3K daily requests on a single Hetzner box.

| File | What it shows | Lines |
|---|---|---|
| [`device-hash.js`](./device-hash.js) | Hash an iOS device identifier so the server never sees the raw name. SHA-256 + static peppered salt. | ~40 |
| [`ttl-janitor.js`](./ttl-janitor.js) | Periodic file cleanup. Walks N directories every minute, deletes anything older than each dir's TTL. | ~60 |
| [`rate-limit-redis.js`](./rate-limit-redis.js) | Sliding-window rate limiter using a Redis sorted set. Per-key (device hash, IP, license) with configurable window + cap. | ~80 |
| [`subscribe-honeypot.js`](./subscribe-honeypot.js) | Bot-resistant email capture: honeypot field + Cloudflare Turnstile token validation + per-IP rate limit. | ~90 |

## Why publish these

Three reasons:

1. **They prove the architecture is real.** Anyone reading `PRIVACY.md` can read these and see we're not hand-waving about "SHA-256 hashing" or "1-hour TTL" — the actual code patterns are sitting here.

2. **They're useful to other devs.** Every indie SaaS needs a rate limiter, a janitor, and a bot-resistant signup form. These work, and they're the smallest reasonable implementations.

3. **They cost us nothing.** None of these expose business logic, and none reveal the Grabio backend's specifics — they're pure privacy patterns.

## Usage

Each file is self-contained. Just copy + adapt:

```js
import { hashDeviceId } from './device-hash.js';
const hash = hashDeviceId('iPhone-of-Aditya');
// → '4f3c1...e9d2' — 64 chars, irreversible
```

```js
import { startJanitor } from './ttl-janitor.js';
startJanitor([
  { dir: '/tmp/grabio-uploads', ttlMs: 5 * 60 * 1000 },   // 5 min
  { dir: '/tmp/grabio-cache',   ttlMs: 60 * 60 * 1000 },  // 1 hour
]);
```

```js
import { rateLimit } from './rate-limit-redis.js';
app.use('/api/heavy', rateLimit({
  key: (req) => req.deviceHash || req.ip,
  windowSec: 60,
  max: 30,
  redis: myRedis,
}));
```

```js
import { subscribeHandler } from './subscribe-honeypot.js';
app.post('/subscribe', subscribeHandler({
  turnstileSecret: process.env.TURNSTILE_SECRET,
  onValid: async (email) => { /* add to Brevo, Mailchimp, etc. */ },
}));
```

## License

MIT. Use freely. If these save you a weekend, send Aditya a thank-you note: [grabio@adityaarsharma.com](mailto:grabio@adityaarsharma.com).

## Caveats

- Production code may differ slightly (logging, metrics, error reporting). These are the minimum useful versions.
- The rate limiter and janitor expect a Redis 6+ server and Node 18+.
- The honeypot pattern works best paired with Cloudflare Turnstile — fall back to hCaptcha or Friendly Captcha if you prefer.
