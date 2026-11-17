import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.93.1";

// Receives weekly bank actuals for the Cash Flow tab from the daily bank
// update and writes them to ap_cash_amounts. It is not called from the app.
//
// Deploy with "Verify JWT" turned OFF: the caller has no user session. It is
// protected by its own key instead: requests must send the header
// x-cash-import-key equal to the CASH_IMPORT_KEY secret.
//
// Only the lines in ALLOWED_LINES can be written, only for Sunday weeks, and
// only with amounts from 0 to 10,000,000. An amount of 0 clears that week.
//
// POST body: { "amounts": [ { "line": "Payroll", "week_start": "2026-11-15", "amount": 20662.46 } ],
//              "source": "daily bank update" }
//
// Secrets: CASH_IMPORT_KEY. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase.

const ALLOWED_LINES = ["Cash Collected", "Payroll"];
const MAX_ROWS = 20;
const MAX_AMOUNT = 10_000_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Compares two strings in constant time so the key can't be guessed by timing.
export function sameKey(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export type Row = { line: string; week_start: string; amount: number };

// Returns the clean rows, or an error message.
export function validate(body: unknown): { rows: Row[] } | { error: string } {
  const list = (body as { amounts?: unknown })?.amounts;
  if (!Array.isArray(list) || list.length === 0) return { error: "Send amounts: a list of { line, week_start, amount }" };
  if (list.length > MAX_ROWS) return { error: `Send at most ${MAX_ROWS} amounts at a time` };
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const line = String(item?.line ?? "");
    const week = String(item?.week_start ?? "");
    const amount = Number(item?.amount);
    if (!ALLOWED_LINES.includes(line)) return { error: `Line must be one of: ${ALLOWED_LINES.join(", ")}` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { error: `week_start must be YYYY-MM-DD (got ${week})` };
    const day = new Date(`${week}T00:00:00Z`);
    if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== week) return { error: `Not a real date: ${week}` };
    if (day.getUTCDay() !== 0) return { error: `week_start must be a Sunday (got ${week})` };
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return { error: `Amount must be 0 to ${MAX_AMOUNT} (got ${item?.amount})` };
    const key = `${line}|${week}`;
    if (seen.has(key)) return { error: `${line} for ${week} is listed twice` };
    seen.add(key);
    rows.push({ line, week_start: week, amount: Math.round(amount * 100) / 100 });
  }
  return { rows };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const expected = Deno.env.get("CASH_IMPORT_KEY") ?? "";
  if (expected.length < 24) return json({ error: "CASH_IMPORT_KEY is not set up (use at least 24 characters)" }, 500);
  if (!sameKey(req.headers.get("x-cash-import-key") ?? "", expected)) return json({ error: "Not authorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send a JSON body" }, 400);
  }
  const checked = validate(body);
  if ("error" in checked) return json({ error: checked.error }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: lines, error: lineError } = await db.from("ap_cash_lines").select("id, name").in("name", ALLOWED_LINES);
  if (lineError) return json({ error: `Reading lines: ${lineError.message}` }, 500);
  const idByName = new Map((lines ?? []).map((l: { id: string; name: string }) => [l.name, l.id]));

  const results: { line: string; week_start: string; amount: number; result: string }[] = [];
  for (const row of checked.rows) {
    const lineId = idByName.get(row.line);
    if (!lineId) {
      results.push({ ...row, result: "skipped: line not found in the Cash Flow tab" });
      continue;
    }
    const { error } = row.amount === 0
      ? await db.from("ap_cash_amounts").delete().eq("line_id", lineId).eq("week_start", row.week_start)
      : await db.from("ap_cash_amounts").upsert(
        { line_id: lineId, week_start: row.week_start, amount: row.amount, updated_by: null, updated_at: new Date().toISOString() },
        { onConflict: "line_id,week_start" },
      );
    results.push({ ...row, result: error ? `error: ${error.message}` : row.amount === 0 ? "cleared" : "saved" });
  }
  const failed = results.filter((r) => r.result.startsWith("error")).length;
  return json({ results, saved: results.length - failed, failed }, failed ? 207 : 200);
});
