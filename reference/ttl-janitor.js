// ttl-janitor.js — Periodic file cleanup. Walks N directories every minute,
// deletes anything older than each dir's TTL.
//
// This is how Grabio enforces its "files deleted within 1 hour" claim. The
// real production version logs to a metrics counter and reports stuck files
// to Sentry, but the core loop is 30 lines — exactly this.
//
// Usage:
//   import { startJanitor, stopJanitor } from './ttl-janitor.js';
//   const j = startJanitor([
//     { dir: '/tmp/grabio-uploads', ttlMs: 5  * 60 * 1000 },   // 5 min
//     { dir: '/tmp/grabio-cache',   ttlMs: 60 * 60 * 1000 },   // 1 hour
//   ]);
//   // ... later
//   stopJanitor(j);
//
// License: MIT — Aditya R Sharma, 2026.

import fsp from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INTERVAL_MS = 60 * 1000;  // sweep every minute

/**
 * Start a janitor loop. Returns a handle you can pass to stopJanitor().
 *
 * @param {Array<{dir: string, ttlMs: number}>} dirs
 * @param {object} [opts]
 * @param {number} [opts.intervalMs]    How often to sweep (default 60s)
 * @param {(msg: string, meta?: object) => void} [opts.log]  Optional logger
 * @returns {{stop: () => void, runOnce: () => Promise<{deleted: number, errors: number}>}}
 */
export function startJanitor(dirs, opts = {}) {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const log = opts.log ?? (() => {});

  async function runOnce() {
    let deleted = 0, errors = 0;
    const now = Date.now();
    for (const { dir, ttlMs } of dirs) {
      let entries;
      try {
        entries = await fsp.readdir(dir);
      } catch (e) {
        if (e.code !== 'ENOENT') { errors++; log('readdir failed', { dir, err: e.message }); }
        continue;
      }
      for (const e of entries) {
        const p = path.join(dir, e);
        try {
          const st = await fsp.stat(p);
          if (st.isFile() && now - st.mtimeMs > ttlMs) {
            await fsp.unlink(p);
            deleted++;
          }
        } catch (e) {
          // Ignore "file gone" races; surface others
          if (e.code !== 'ENOENT') { errors++; log('cleanup failed', { path: p, err: e.message }); }
        }
      }
    }
    if (deleted || errors) log('janitor sweep', { deleted, errors });
    return { deleted, errors };
  }

  // Don't block process exit (.unref()) — Grabio uses this as a side-task,
  // not a critical worker.
  const handle = setInterval(() => { runOnce().catch(() => {}); }, intervalMs);
  handle.unref?.();

  return {
    stop: () => clearInterval(handle),
    runOnce,
  };
}

/** Convenience alias if you stored the return value as `j`. */
export function stopJanitor(j) { j?.stop?.(); }

// Self-test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Janitor module loaded. Run it in your server like:');
  console.log("  startJanitor([{ dir: '/tmp/uploads', ttlMs: 300000 }]);");
}
