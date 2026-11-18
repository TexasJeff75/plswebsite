// Runs the StratusDX sync every 5 minutes (schedule in netlify.toml).
// Netlify does not let scheduled functions be called by URL in production,
// so this needs no sign-in check. Each run does about 24 seconds of work and
// the next run continues where it stopped.
const { runSync } = require('../lib/stratusSync.cjs');

exports.handler = async () => {
  try {
    const result = await runSync({ budgetMs: 24000, trigger: 'schedule' });
    if (!result.ok) console.error('[SYNC] Scheduled run not started:', result.error);
    return { statusCode: 200 };
  } catch (error) {
    console.error('[SYNC] Scheduled run failed:', error.message);
    return { statusCode: 500 };
  }
};
