import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.93.1";
import { BillClient, BillEnv, mapBill, mapBillLines, mapPayment, mapPaymentBills } from "../bill-sync/sync.ts";
import { cancelInstallment, checkInstallments, Installment, PayStore, releaseInstallments } from "./release.ts";

// Weekly release: creates scheduled payments in BILL for planned installments,
// and cancels them while BILL has not started processing. Super Admin only.
//
// Uses BILL_PAY_CLIENT_ID and BILL_PAY_CLIENT_SECRET if set (a separate Full
// access app), otherwise the same BILL_CLIENT_ID and BILL_CLIENT_SECRET as
// bill-sync. Either way the app must have Full access to create payments.
// BILL_ENV is shared. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// POST body: { action: "check", installmentIds }
//            { action: "release", installmentIds, fundingAccountId, confirmLarge }
//            { action: "cancel", installmentId }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Region, " +
    "X-Supabase-Client-Platform, X-Supabase-Client-Platform-Version, " +
    "X-Supabase-Client-Runtime, X-Supabase-Client-Runtime-Version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function supabasePayStore(db: SupabaseClient, userId: string): PayStore {
  const check = (error: { message: string } | null, what: string) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };
  return {
    async loadInstallments(ids) {
      const { data, error } = await db
        .from("ap_pay_plan_installments")
        .select("id, amount, planned_date, status, seq, matched_payment_id, ap_pay_plans!inner(bill_id, ap_bills!inner(vendor_id, vendor_name, invoice_number))")
        .in("id", ids);
      check(error, "Loading installments");
      return (data ?? []).map((r: any): Installment => ({
        id: r.id,
        bill_id: r.ap_pay_plans.bill_id,
        vendor_id: r.ap_pay_plans.ap_bills.vendor_id,
        vendor_name: r.ap_pay_plans.ap_bills.vendor_name,
        invoice_number: r.ap_pay_plans.ap_bills.invoice_number,
        amount: Number(r.amount),
        planned_date: r.planned_date,
        status: r.status,
        seq: r.seq,
        matched_payment_id: r.matched_payment_id,
      }));
    },
    async claim(installmentId, fundingAccountId, processDate) {
      const { data, error } = await db.rpc("ap_claim_release", {
        p_installment_id: installmentId, p_requested_by: userId,
        p_funding_account_id: fundingAccountId, p_process_date: processDate,
      });
      check(error, "Could not start this release");
      return { actionId: data.action_id, transactionNumber: data.transaction_number };
    },
    async finishAction(actionId, patch) {
      const { error } = await db.from("ap_payment_actions").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", actionId);
      check(error, "Recording the release");
    },
    async logAction(row) {
      const { error } = await db.from("ap_payment_actions").insert({ ...row, requested_by: userId, finished_at: new Date().toISOString() });
      check(error, "Recording the cancel");
    },
    async savePayment(payment) {
      const { error } = await db.from("ap_payments").upsert(mapPayment(payment));
      check(error, "Saving the payment");
      await db.from("ap_payment_bills").delete().eq("payment_id", payment.id);
      const allocations = mapPaymentBills(payment);
      if (allocations.length) {
        const { error: e2 } = await db.from("ap_payment_bills").insert(allocations);
        check(e2, "Saving the payment allocation");
      }
    },
    async saveBill(bill) {
      const { error } = await db.from("ap_bills").upsert(mapBill(bill));
      check(error, "Saving the bill");
      await db.from("ap_bill_lines").delete().eq("bill_id", bill.id);
      const lines = mapBillLines(bill);
      if (lines.length) {
        const { error: e2 } = await db.from("ap_bill_lines").insert(lines);
        check(e2, "Saving bill lines");
      }
    },
    async linkInstallment(installmentId, paymentId, processDate, pending) {
      const { error } = await db.from("ap_pay_plan_installments").update({
        matched_payment_id: paymentId, matched_by: "release", status: pending ? "scheduled" : "paid",
        bill_process_date: processDate, updated_at: new Date().toISOString(),
      }).eq("id", installmentId);
      check(error, "Linking the payment to the plan");
    },
    async unlinkInstallment(installmentId, billId) {
      const { error } = await db.from("ap_pay_plan_installments").update({
        matched_payment_id: null, matched_by: null, bill_process_date: null, status: "planned", updated_at: new Date().toISOString(),
      }).eq("id", installmentId);
      check(error, "Updating the plan");
      await db.rpc("ap_refresh_pay_plans", { p_bill_id: billId });
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const requested = req.headers.get("Access-Control-Request-Headers");
    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, ...(requested ? { "Access-Control-Allow-Headers": requested } : {}) },
    });
  }
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sign in required" }, 401);
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Sign in required" }, 401);
  const { data: isSuperAdmin, error: roleError } = await asUser.rpc("is_super_admin");
  if (roleError || !isSuperAdmin) return json({ error: "Only Super Admin can release payments" }, 403);

  const env = (Deno.env.get("BILL_ENV") ?? "sandbox") as BillEnv;
  const clientId = Deno.env.get("BILL_PAY_CLIENT_ID") || Deno.env.get("BILL_CLIENT_ID");
  const clientSecret = Deno.env.get("BILL_PAY_CLIENT_SECRET") || Deno.env.get("BILL_CLIENT_SECRET");
  if (!clientId || !clientSecret || !["sandbox", "production"].includes(env)) {
    return json({ error: "Payment release is not set up. Add BILL_CLIENT_ID and BILL_CLIENT_SECRET (a BILL app with Full access) to the function secrets." }, 500);
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: settings } = await admin.from("ap_settings").select("data_source_env").eq("id", 1).maybeSingle();
  if (settings?.data_source_env && settings.data_source_env !== env) {
    return json({ error: `The tracker holds ${settings.data_source_env} data but BILL_ENV is ${env}. Fix the setting before releasing payments.` }, 409);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send a JSON body" }, 400);
  }

  const client = new BillClient(clientId, clientSecret, env);
  const store = supabasePayStore(admin, user.id);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

  try {
    if (body.action === "check") {
      const ids: string[] = Array.isArray(body.installmentIds) ? body.installmentIds : [];
      if (!ids.length) return json({ error: "Choose at least one payment" }, 400);
      return json({ rows: await checkInstallments(client, store, ids), today });
    }
    if (body.action === "release") {
      const ids: string[] = Array.isArray(body.installmentIds) ? body.installmentIds : [];
      if (!ids.length) return json({ error: "Choose at least one payment" }, 400);
      const result = await releaseInstallments(client, store, {
        ids, fundingAccountId: String(body.fundingAccountId ?? ""), confirmLarge: body.confirmLarge === true, today,
      });
      return json(result);
    }
    if (body.action === "cancel") {
      if (!body.installmentId) return json({ error: "Choose a payment to cancel" }, 400);
      return json({ result: await cancelInstallment(client, store, String(body.installmentId)) });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
