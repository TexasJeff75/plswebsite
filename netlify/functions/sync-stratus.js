// "Sync now" for the StratusDX LIS Integration API (Super Admins only).
// Called by the Lab Orders tab and the StratusDX Sync settings page. The
// same sync also runs on a schedule (sync-stratus-scheduled). Each call
// does about 8 seconds of work; a response with summary.more = true means
// call again to continue.
const { requireSuperAdmin } = require('../lib/requireSuperAdmin.cjs');
const { runSync } = require('../lib/stratusSync.cjs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function respond(statusCode, body) {
  return { statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  const access = await requireSuperAdmin(event);
  if (!access.ok) return respond(access.status, { error: access.error, details: access.error });

  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  try {
    const budgetMs = Number(process.env.STRATUS_SYNC_BUDGET_MS) || 7000;
    const result = await runSync({ budgetMs, trigger: 'manual' });
    if (!result.ok) return respond(result.status || 500, { error: result.error, details: result.error });
    return respond(200, { success: true, message: 'StratusDX sync completed', summary: result.summary, errors: result.errors });
  } catch (error) {
    console.error('[SYNC] Error:', error.message);
    return respond(500, { error: 'Sync failed', details: error.message });
  }
};
