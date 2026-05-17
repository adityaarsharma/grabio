// device-hash.js — Hash an iOS device identifier so the server never stores
// the raw name. Used by Grabio to rate-limit free-tier abuse and bind Pro
// licenses without ever learning who you are.
//
// Pattern:
//   - SHA-256 over (device_name + peppered_salt)
//   - Static salt is a server-side secret env var, NOT per-user — by design.
//     Rotating it would invalidate every device hash on the planet and break
//     existing Pro entitlements. The salt is just a defense against rainbow
//     tables on common device names ("iPhone", "Aditya's iPhone", etc.).
//
// Why not bcrypt / argon2? Performance. We hash on every request (~5K/day on
// our box). SHA-256 is ~10µs; bcrypt would be ~100ms. The threat model is
// "stop trivial reverse lookups", not "protect a password from offline crack".
//
// License: MIT — Aditya R Sharma, 2026.

import crypto from 'node:crypto';

const DEFAULT_SALT_ENV = 'GRABIO_DEVICE_HASH_SALT';

/**
 * Compute a stable, irreversible identifier for an iOS device name.
 *
 * @param {string} deviceName       The raw iOS device identifier (e.g. "Aditya's iPhone")
 * @param {object} [opts]
 * @param {string} [opts.salt]      Override the env-loaded salt (useful for tests)
 * @param {string} [opts.saltEnv]   Env var name to read salt from (default GRABIO_DEVICE_HASH_SALT)
 * @returns {string}                64-char lowercase hex SHA-256 digest
 */
export function hashDeviceId(deviceName, opts = {}) {
  if (typeof deviceName !== 'string' || deviceName.length === 0) {
    throw new TypeError('hashDeviceId: deviceName must be a non-empty string');
  }
  const salt = opts.salt ?? process.env[opts.saltEnv || DEFAULT_SALT_ENV];
  if (!salt) {
    throw new Error(
      `hashDeviceId: no salt configured. Set env ${opts.saltEnv || DEFAULT_SALT_ENV} ` +
      `or pass opts.salt explicitly. Rotating this salt is destructive — do it once at install.`
    );
  }
  // Trim + lowercase to absorb common iOS device-name variations (curly quotes,
  // trailing spaces) so the same physical device always hashes to the same value.
  const normalized = deviceName.trim().toLowerCase();
  return crypto
    .createHash('sha256')
    .update(normalized + ':' + salt)
    .digest('hex');
}

/**
 * Constant-time comparison so a returned hash can be checked without leaking
 * timing information. Use this when matching a stored hash against an incoming
 * value (e.g. when validating a Pro license bound to a device hash).
 *
 * @param {string} a 64-char hex digest
 * @param {string} b 64-char hex digest
 * @returns {boolean}
 */
export function hashEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  // crypto.timingSafeEqual needs equal-length Buffers
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// Self-check: run `node device-hash.js` for a quick sanity test.
if (import.meta.url === `file://${process.argv[1]}`) {
  process.env.GRABIO_DEVICE_HASH_SALT = 'demo-salt-do-not-use-in-prod';
  const h1 = hashDeviceId("Aditya's iPhone");
  const h2 = hashDeviceId("aditya's iphone ");   // case + trailing space
  console.log('hash 1:', h1);
  console.log('hash 2:', h2);
  console.log('match :', hashEquals(h1, h2));     // → true (normalization)
  console.log('64-hex:', /^[0-9a-f]{64}$/.test(h1));
}
