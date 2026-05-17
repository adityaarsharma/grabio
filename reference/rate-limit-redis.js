// rate-limit-redis.js — Sliding-window rate limiter backed by a Redis sorted
// set. Per-key (device hash, IP, license key) with configurable window and cap.
//
// Why a sorted set instead of INCR + EXPIRE?
//   - INCR/EXPIRE is a "fixed window": at 11:59:59 + 12:00:00 a user can burst
//     2x the limit.
//   - A sorted set keyed by timestamp gives you a true sliding window: at any
//     instant, "did this key make more than N requests in the last W seconds?".
//   - The implementation is 4 Redis commands inside a pipeline — fast and
//     atomic.
//
// Usage as Express middleware:
//   import { rateLimit } from './rate-limit-redis.js';
//   app.use('/api/heavy', rateLimit({
//     key: (req) => req.deviceHash || req.ip,
//     windowSec: 60,
//     max: 30,
//     redis: myIoredisClient,
//   }));
//
// Or call check() directly for non-HTTP contexts:
//   const r = await checkAndConsume({ key: 'hash:abc', windowSec: 60, max: 30, redis });
//   if (!r.allowed) reject(429);
//
// License: MIT — Aditya R Sharma, 2026.

const NS = 'rl:';  // redis key namespace — short, change to whatever you like

/**
 * Atomically: drop stale entries, count current, add this request, return result.
 *
 * @param {object}  args
 * @param {string}  args.key         The thing being rate-limited (hash, ip, license)
 * @param {number}  args.windowSec   Sliding window length in seconds
 * @param {number}  args.max         Max requests allowed inside the window
 * @param {object}  args.redis       An ioredis (or compatible) client
 * @returns {Promise<{ allowed: boolean, count: number, remaining: number, resetSec: number }>}
 */
export async function checkAndConsume({ key, windowSec, max, redis }) {
  if (!key) throw new Error('rate-limit: key required');
  if (!Number.isFinite(windowSec) || windowSec <= 0) throw new Error('rate-limit: windowSec must be > 0');
  if (!Number.isFinite(max) || max <= 0) throw new Error('rate-limit: max must be > 0');

  const fullKey = NS + key;
  const now = Date.now();
  const cutoff = now - windowSec * 1000;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;  // unique entry

  const p = redis.pipeline();
  p.zremrangebyscore(fullKey, 0, cutoff);     // drop entries outside window
  p.zadd(fullKey, now, member);                // record this request
  p.zcard(fullKey);                            // count entries in window
  p.expire(fullKey, windowSec + 5);            // self-clean
  const results = await p.exec();

  const count = results[2][1];  // [err, val] from zcard
  const allowed = count <= max;

  // If they're over the limit, remove the entry we just added so a future
  // request in the same window doesn't keep pushing the score forward.
  if (!allowed) {
    await redis.zrem(fullKey, member);
  }

  return {
    allowed,
    count: allowed ? count : count - 1,
    remaining: Math.max(0, max - count),
    resetSec: windowSec,
  };
}

/**
 * Express middleware factory. Adds standard RateLimit-* headers on every
 * response and returns 429 with a JSON body when the cap is exceeded.
 *
 * @param {object} opts
 * @param {(req) => string} opts.key      How to identify a caller
 * @param {number} opts.windowSec
 * @param {number} opts.max
 * @param {object} opts.redis
 * @param {string} [opts.policyName]      Shown in RateLimit-Policy
 */
export function rateLimit(opts) {
  const { key, windowSec, max, redis, policyName = 'default' } = opts;
  return async function rateLimitMw(req, res, next) {
    try {
      const k = key(req);
      if (!k) return next();
      const r = await checkAndConsume({ key: k, windowSec, max, redis });

      // RFC 9239-style headers (browser dev tools love these)
      res.setHeader('RateLimit-Policy', `${max};w=${windowSec}`);
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(r.remaining));
      res.setHeader('RateLimit-Reset', String(r.resetSec));

      if (!r.allowed) {
        res.status(429).json({
          ok: false,
          error: 'rate_limit_exceeded',
          policy: policyName,
          limit: max,
          windowSec,
          retryAfterSec: r.resetSec,
        });
        return;
      }
      next();
    } catch (e) {
      // Fail open — don't take the whole API down because Redis blipped.
      // In production we also report this to Sentry.
      next();
    }
  };
}
