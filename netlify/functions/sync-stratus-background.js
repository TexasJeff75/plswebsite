// Background StratusDX catch-up: up to about 14 minutes of sync work per call.
// Netlify answers the caller with 202 straight away and keeps this running.
// Started by sync-stratus-scheduled and sync-stratus when there is more to
// import. Only those functions (by a key derived from the service role key)
// or a signed-in Super Admin can start it.
const crypto = require('crypto');
const { requireSuperAdmin } = require('../lib/requireSuperAdmin.cjs');
const { runSync, backgroundKey } = require('../lib/stratusSync.cjs');

function sameKey(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

exports.handler = async (event) => {
  const sent = (event.headers && (event.headers['x-stratus-sync-key'] || event.headers['X-Stratus-Sync-Key'])) || '';
  const expected = backgroundKey();
  let allowed = Boolean(sent && expected && sameKey(sent, expected));
  if (!allowed) allowed = (await requireSuperAdmin(event)).ok;
  if (!allowed) {
    console.error('[SYNC] Background run refused: not authorized');
    return { statusCode: 401 };
  }

  try {
    const result = await runSync({ budgetMs: 14 * 60 * 1000, trigger: 'background' });
    if (!result.ok) console.error('[SYNC] Background run not started:', result.error);
  } catch (error) {
    console.error('[SYNC] Background run failed:', error.message);
  }
  return { statusCode: 200 };
};
