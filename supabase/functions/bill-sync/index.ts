import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.93.1";
import { BillClient, BillEnv, runSync, Store } from "./sync.ts";

// Syncs BILL accounts payable data into the ap_* tables (read-only to BILL).
// Callers: a Super Admin ("Sync now" in the Payables tab), or the nightly
// schedule, which sends the x-cron-secret header.
//
// Secrets: BILL_ENV (sandbox | production), BILL_CLIENT_ID, BILL_CLIENT_SECRET,
// BILL_SYNC_CRON_SECRET. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Cron-Secret, X-Region, " +
    "X-Supabase-Client-Platform, X-Supabase-Client-Platform-Version, " +
    "X-Supabase-Client-Runtime, X-Supabase-Client-Runtime-Version",
};

// Stop starting new pages after this long; the caller runs again to continue.
const TIME_BUDGET_MS = 100_000;
// A "running" row older than this is treated as a crashed run.
const STALE_RUN_MS = 15 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function supabaseStore(db: SupabaseClient): Store {
  return {
    async getState(entity) {
      const { data, error } = await db.from("ap_sync_state").select("last_updated_time").eq("entity", entity).maybeSingle();
      if (error) throw error;
      return data?.last_updated_time ?? null;
    },
    async setState(entity, lastUpdatedTime) {
      const { error } = await db.from("ap_sync_state")
        .upsert({ entity, last_updated_time: lastUpdatedTime, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    async upsert(table, rows) {
      if (!rows.length) return;
      const { error } = await db.from(table).upsert(rows);
      if (error) throw new Error(`${table}: ${error.message}`);
    },
    async replaceChildren(table, parentColumn, parentIds, rows) {
      if (!parentIds.length) return;
      const { error: delError } = await db.from(table).delete().in(parentColumn, parentIds);
      if (delError) throw new Error(`${table}: ${delError.message}`);
      if (rows.length) {
        const { error } = await db.from(table).insert(rows);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    // Allow whatever headers the browser asks for: supabase-js adds new
    // X-Supabase-Client-* headers over time, and a missing one blocks the call.
    const requested = req.headers.get("Access-Control-Request-Headers");
    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, ...(requested ? { "Access-Control-Allow-Headers": requested } : {}) },
    });
  }
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  // Who is calling?
  let trigger: "manual" | "scheduled";
  let userId: string | null = null;
  const cronSecret = Deno.env.get("BILL_SYNC_CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
    trigger = "scheduled";
  } else {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required" }, 401);
    const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401);
    const { data: isSuperAdmin, error } = await asUser.rpc("is_super_admin");
    if (error || !isSuperAdmin) return json({ error: "Only Super Admin can sync BILL data" }, 403);
    trigger = "manual";
    userId = user.id;
  }

  const env = (Deno.env.get("BILL_ENV") ?? "sandbox") as BillEnv;
  const clientId = Deno.env.get("BILL_CLIENT_ID");
  const clientSecret = Deno.env.get("BILL_CLIENT_SECRET");
  if (!clientId || !clientSecret || !["sandbox", "production"].includes(env)) {
    return json({ error: "BILL connection is not set up. Add BILL_ENV, BILL_CLIENT_ID and BILL_CLIENT_SECRET to the function secrets." }, 500);
  }

  // One sync at a time.
  const { data: running } = await admin.from("ap_sync_runs")
    .select("id, started_at").eq("status", "running")
    .gte("started_at", new Date(Date.now() - STALE_RUN_MS).toISOString())
    .limit(1);
  if (running?.length) return json({ error: "A sync is already running. Try again in a few minutes." }, 409);
  await admin.from("ap_sync_runs")
    .update({ status: "failed", error: "Stopped without finishing", finished_at: new Date().toISOString() })
    .eq("status", "running");

  const { data: run, error: runError } = await admin.from("ap_sync_runs")
    .insert({ trigger, triggered_by: userId, status: "running" })
    .select("id").single();
  if (runError) return json({ error: runError.message }, 500);

  // Never mix sandbox and production data. Skipped if the guard migration is not applied yet.
  const { data: source, error: sourceError } = await admin.rpc("ap_record_data_source", { p_env: env });
  if (sourceError) {
    console.error("Data source check skipped:", sourceError.message);
  } else if (typeof source === "string" && source.startsWith("mismatch:")) {
    const saved = source.slice("mismatch:".length);
    const message = `Data source mismatch: the saved payables data came from the BILL ${saved}, ` +
      `but the connection is now set to ${env}. Click "Clear BILL data" on the Payables page, then sync again.`;
    await admin.from("ap_sync_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return json({ runId: run.id, status: "failed", error: message }, 409);
  }

  try {
    const client = new BillClient(clientId, clientSecret, env);
    const result = await runSync(client, supabaseStore(admin), Date.now() + TIME_BUDGET_MS);
    // Match newly synced BILL payments to Pay Plan installments.
    const { error: refreshError } = await admin.rpc("ap_refresh_pay_plans");
    if (refreshError) console.error("Pay plan refresh failed:", refreshError.message);
    const status = result.complete ? "succeeded" : "partial";
    await admin.from("ap_sync_runs")
      .update({ status, counts: result.counts, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return json({ runId: run.id, status, counts: result.counts, more: !result.complete });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from("ap_sync_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return json({ runId: run.id, status: "failed", error: message }, 502);
  }
});
