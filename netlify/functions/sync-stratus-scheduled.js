// Runs the StratusDX sync every 5 minutes (schedule in netlify.toml).
// Netlify does not let scheduled functions be called by URL in production,
// so this needs no sign-in check. It does about 20 seconds of work; if there
// is more to import it starts the background catch-up (up to 15 minutes).
const { runSync, startBackground } = require('../lib/stratusSync.cjs');

exports.handler = async () => {
  try {
    const result = await runSync({ budgetMs: 20000, trigger: 'schedule' });
    if (!result.ok) {
      console.error('[SYNC] Scheduled run not started:', result.error);
    } else if (result.summary.more && !result.busy) {
      const started = await startBackground();
      console.log(`[SYNC] Background catch-up ${started ? 'started' : 'could not be started'}`);
    }
    return { statusCode: 200 };
  } catch (error) {
    console.error('[SYNC] Scheduled run failed:', error.message);
    return { statusCode: 500 };
  }
};
