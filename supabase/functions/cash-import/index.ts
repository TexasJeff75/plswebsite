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
// It can also set a week's actual ending bank balance (ap_cash_actuals), from
// -10,000,000 to 10,000,000.
//
// POST body: { "amounts": [ { "line": "Payroll", "week_start": "2026-11-15", "amount": 20662.46 } ],
//              "actuals": [ { "week_start": "2026-11-08", "actual_ending": 21291.49 } ],
//              "source": "daily bank update" }
// Either list may be left out, but not both.
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
export type Actual = { week_start: string; actual_ending: number };

function sundayError(week: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return `week_start must be YYYY-MM-DD (got ${week})`;
  const day = new Date(`${week}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== week) return `Not a real date: ${week}`;
  if (day.getUTCDay() !== 0) return `week_start must be a Sunday (got ${week})`;
  return null;
}

// Returns the clean rows and actuals, or an error message.
export function validate(body: unknown): { rows: Row[]; actuals: Actual[] } | { error: string } {
  const rawList = (body as { amounts?: unknown })?.amounts;
  const rawActuals = (body as { actuals?: unknown })?.actuals;
  const list = rawList === undefined ? [] : rawList;
  const actualList = rawActuals === undefined ? [] : rawActuals;
  if (!Array.isArray(list) || !Array.isArray(actualList) || list.length + actualList.length === 0) {
    return { error: "Send amounts: a list of { line, week_start, amount }, and/or actuals: a list of { week_start, actual_ending }" };
  }
  if (list.length > MAX_ROWS) return { error: `Send at most ${MAX_ROWS} amounts at a time` };
  if (actualList.length > MAX_ROWS) return { error: `Send at most ${MAX_ROWS} actuals at a time` };
  const actuals: Actual[] = [];
  const seenWeeks = new Set<string>();
  for (const item of actualList) {
    const week = String(item?.week_start ?? "");
    const bad = sundayError(week);
    if (bad) return { error: bad };
    const value = Number(item?.actual_ending);
    if (item?.actual_ending === null || item?.actual_ending === "" || !Number.isFinite(value) || Math.abs(value) > MAX_AMOUNT) {
      return { error: `actual_ending must be a number from -${MAX_AMOUNT} to ${MAX_AMOUNT} (got ${item?.actual_ending})` };
    }
    if (seenWeeks.has(week)) return { error: `Actual ending for ${week} is listed twice` };
    seenWeeks.add(week);
    actuals.push({ week_start: week, actual_ending: Math.round(value * 100) / 100 });
  }
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const line = String(item?.line ?? "");
    const week = String(item?.week_start ?? "");
    const amount = Number(item?.amount);
    if (!ALLOWED_LINES.includes(line)) return { error: `Line must be one of: ${ALLOWED_LINES.join(", ")}` };
    const bad = sundayError(week);
    if (bad) return { error: bad };
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return { error: `Amount must be 0 to ${MAX_AMOUNT} (got ${item?.amount})` };
    const key = `${line}|${week}`;
    if (seen.has(key)) return { error: `${line} for ${week} is listed twice` };
    seen.add(key);
    rows.push({ line, week_start: week, amount: Math.round(amount * 100) / 100 });
  }
  return { rows, actuals };
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
  for (const a of checked.actuals) {
    const { error } = await db.from("ap_cash_actuals").upsert(
      { week_start: a.week_start, actual_ending: a.actual_ending, updated_by: null, updated_at: new Date().toISOString() },
      { onConflict: "week_start" },
    );
    results.push({ line: "Actual ending", week_start: a.week_start, amount: a.actual_ending, result: error ? `error: ${error.message}` : "saved" });
  }
  const failed = results.filter((r) => r.result.startsWith("error")).length;
  return json({ results, saved: results.length - failed, failed }, failed ? 207 : 200);
});
