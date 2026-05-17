#!/usr/bin/env node
// verify-privacy.js — Mechanically validates Grabio's PRIVACY.md claims against
// the live host. Zero dependencies beyond Node 18+ built-in fetch.
//
// Usage:
//   node verify-privacy.js
//   GRABIO_HOST=https://grabio.adityaarsharma.com node verify-privacy.js
//
// Exits 0 if all checks pass, 1 if any fail, 2 on network errors.
//
// License: MIT — Aditya R Sharma, 2026.

const HOST = (process.env.GRABIO_HOST || 'https://grabio.adityaarsharma.com').replace(/\/$/, '');

// Known third-party tracker patterns that must NOT appear in Grabio HTML.
const TRACKER_PATTERNS = [
  { name: 'Google Analytics (gtag)', re: /googletagmanager\.com|google-analytics\.com/i },
  { name: 'Facebook Pixel',          re: /connect\.facebook\.net\/.*\/fbevents\.js|fbq\(['"]init['"]/i },
  { name: 'Hotjar',                  re: /static\.hotjar\.com|hj\(/i },
  { name: 'Mixpanel',                re: /cdn\.mxpnl\.com|mixpanel\.track/i },
  { name: 'Segment',                 re: /cdn\.segment\.com|analytics\.load\(/i },
  { name: 'Amplitude',               re: /cdn\.amplitude\.com|amplitude\.getInstance/i },
  { name: 'Heap',                    re: /heapanalytics\.com/i },
  { name: 'TikTok Pixel',            re: /analytics\.tiktok\.com|ttq\.load/i },
  { name: 'LinkedIn Insight',        re: /snap\.licdn\.com\/li\.lms-analytics/i },
  { name: 'X (Twitter) Pixel',       re: /static\.ads-twitter\.com\/uwt\.js/i },
];

const CHECKS = [];
function check(name, fn) { CHECKS.push({ name, fn }); }

// Tiny pretty-printer for the result table
function tableRow(name, pass, detail) {
  const dot = pass ? '[32m✓[0m' : '[31m✗[0m';
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`  ${dot} ${tag.padEnd(4)}  ${name}${detail ? '   —  ' + detail : ''}`);
}

async function get(path, opts = {}) {
  const url = HOST + path;
  const res = await fetch(url, { redirect: 'follow', ...opts });
  const text = await res.text();
  return { res, text, url };
}

// ============================================================================
// CHECKS
// ============================================================================

check('Homepage responds 200 over HTTPS', async () => {
  if (!HOST.startsWith('https://')) return { pass: false, detail: 'HOST is not https://' };
  const { res } = await get('/');
  return { pass: res.status === 200, detail: 'status=' + res.status };
});

check('No Set-Cookie on landing (user gets zero cookies)', async () => {
  const { res } = await get('/');
  const cookie = res.headers.get('set-cookie');
  return { pass: !cookie, detail: cookie ? 'unexpected cookie: ' + cookie.slice(0, 80) : 'none' };
});

check('No Set-Cookie on /blog, /terms, /privacy, /refund', async () => {
  const paths = ['/blog', '/terms', '/privacy', '/refund'];
  for (const p of paths) {
    const { res } = await get(p);
    const cookie = res.headers.get('set-cookie');
    if (cookie) return { pass: false, detail: `cookie set on ${p}: ${cookie.slice(0, 80)}` };
  }
  return { pass: true, detail: paths.length + ' paths clean' };
});

check('No third-party trackers in landing HTML', async () => {
  const { text } = await get('/');
  const hits = TRACKER_PATTERNS.filter(t => t.re.test(text));
  return { pass: hits.length === 0, detail: hits.length ? 'leaked: ' + hits.map(h => h.name).join(', ') : '0 trackers' };
});

check('Webfonts self-hosted (no fonts.googleapis.com / fonts.gstatic.com)', async () => {
  const { text } = await get('/');
  const remoteFonts = /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(text);
  return { pass: !remoteFonts, detail: remoteFonts ? 'leaks Google Fonts' : 'all /fonts/ same-origin' };
});

check('Plausible script is the only analytics script (cookieless)', async () => {
  const { text } = await get('/');
  const plausibleHits = (text.match(/analytics\.adityaarsharma\.com\/js\/script/g) || []).length;
  const otherAnalytics = TRACKER_PATTERNS.some(t => t.re.test(text));
  return { pass: plausibleHits >= 1 && !otherAnalytics, detail: `plausible=${plausibleHits} other_trackers=${otherAnalytics}` };
});

check('Subscribe endpoint rejects empty Turnstile token', async () => {
  const res = await fetch(HOST + '/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': HOST },
    body: 'email=verify-probe@example.com&company='
  });
  const body = await res.text();
  let json = {}; try { json = JSON.parse(body); } catch {}
  return { pass: json.ok === false && /spam|turnstile|captcha/i.test(json.error || ''), detail: 'response=' + JSON.stringify(json).slice(0, 80) };
});

check('Honeypot field is hidden from real users (offscreen + aria-hidden)', async () => {
  const { text } = await get('/');
  const hasHoneypot = /name="company"[^>]*aria-hidden="true"/.test(text) || /aria-hidden="true"[^>]*name="company"/.test(text) || /name="company"[^>]*position:\s*absolute;\s*left:-9999px/.test(text);
  return { pass: hasHoneypot, detail: hasHoneypot ? 'name=company is hidden' : 'honeypot not found or visible' };
});

check('Blog API returns ok:true with categories', async () => {
  const { res, text } = await get('/api/blog/posts');
  let json = {}; try { json = JSON.parse(text); } catch {}
  return { pass: res.status === 200 && json.ok === true && Array.isArray(json.categories), detail: `posts=${json.posts ? json.posts.length : '?'} cats=${json.categories ? json.categories.length : '?'}` };
});

check('Legal pages each carry application/ld+json', async () => {
  const out = [];
  for (const p of ['/terms', '/privacy', '/refund']) {
    const { text } = await get(p);
    const has = /<script type="application\/ld\+json">/.test(text);
    if (!has) out.push(p);
  }
  return { pass: out.length === 0, detail: out.length ? 'missing on: ' + out.join(', ') : '3/3 legal pages' };
});

check('Sitemap lists landing, blog, legal — no /admin or /v2', async () => {
  const { res, text } = await get('/sitemap.xml');
  if (res.status !== 200) return { pass: false, detail: 'sitemap status=' + res.status };
  const required = ['/blog', '/terms', '/privacy', '/refund'];
  const missing = required.filter(p => !text.includes(p));
  const leakedAdmin = /\/admin|\/v2\//i.test(text);
  return { pass: missing.length === 0 && !leakedAdmin, detail: missing.length ? 'missing: ' + missing.join(', ') : 'clean' };
});

check('robots.txt disallows /admin and /v2', async () => {
  const { res, text } = await get('/robots.txt');
  if (res.status !== 200) return { pass: false, detail: 'status=' + res.status };
  const disallowAdmin = /Disallow:\s*\/admin/i.test(text);
  const disallowV2    = /Disallow:\s*\/v2/i.test(text);
  return { pass: disallowAdmin && disallowV2, detail: `admin=${disallowAdmin} v2=${disallowV2}` };
});

check('Self-hosted font woff2 served with correct Content-Type', async () => {
  const { res } = await get('/fonts/space-grotesk-latin.woff2');
  const ct = res.headers.get('content-type') || '';
  return { pass: res.status === 200 && ct.includes('woff2'), detail: `status=${res.status} ct=${ct}` };
});

check('HSTS header present + max-age >= 6 months', async () => {
  const { res } = await get('/');
  const hsts = res.headers.get('strict-transport-security') || '';
  const m = hsts.match(/max-age=(\d+)/);
  const sixMonths = 60 * 60 * 24 * 180;
  const ok = m && parseInt(m[1], 10) >= sixMonths;
  return { pass: !!ok, detail: hsts || 'absent' };
});

check('No X-Powered-By disclosure beyond Express', async () => {
  const { res } = await get('/');
  const xpb = res.headers.get('x-powered-by') || '';
  return { pass: !xpb || xpb === 'Express', detail: xpb || 'none' };
});

// ============================================================================
// RUNNER
// ============================================================================

(async () => {
  console.log(`\n  Grabio privacy audit  —  host: ${HOST}\n`);
  let pass = 0, fail = 0, errors = 0;
  for (const c of CHECKS) {
    try {
      const r = await c.fn();
      tableRow(c.name, r.pass, r.detail);
      r.pass ? pass++ : fail++;
    } catch (e) {
      tableRow(c.name, false, 'ERROR: ' + (e.message || e));
      errors++;
    }
  }
  console.log(`\n  Result: [32m${pass} passed[0m, [31m${fail} failed[0m, ${errors} errored\n`);

  if (errors > 0 && pass + fail === 0) process.exit(2);
  process.exit(fail > 0 ? 1 : 0);
})();
