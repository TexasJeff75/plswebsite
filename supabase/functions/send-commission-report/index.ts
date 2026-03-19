import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function fmt(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const s = String(d);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s.substring(0, 10)) && s.length === 10;
  const dt = isDateOnly ? new Date(`${s}T12:00:00Z`) : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" });
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  const s = String(d);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s.substring(0, 10)) && s.length === 10;
  const dt = isDateOnly ? new Date(`${s}T12:00:00Z`) : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "numeric", day: "numeric", year: "2-digit" });
}

function buildCustomerSummaryHtml(report: any): string {
  const items = report.commission_report_items || [];
  const byCustomer: Record<string, { amount: number; commission: number; count: number }> = {};
  items.forEach((item: any) => {
    const key = item.qbo_invoices?.customer_name || "Unknown";
    if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
    byCustomer[key].amount += item.commissionable_amount || 0;
    byCustomer[key].commission += item.commission_amount || 0;
    byCustomer[key].count += 1;
  });

  const rows = Object.entries(byCustomer)
    .sort((a, b) => b[1].commission - a[1].commission)
    .map(([customer, t], idx) => `
      <tr style="${idx % 2 !== 0 ? "background-color:#f8fafc;" : ""}">
        <td style="padding:10px 14px;color:#1e293b;font-size:13px;">${customer}</td>
        <td style="padding:10px 14px;text-align:center;color:#64748b;font-size:13px;">${t.count}</td>
        <td style="padding:10px 14px;text-align:right;color:#1e293b;font-size:13px;">${fmt(t.amount)}</td>
        <td style="padding:10px 14px;text-align:right;color:#64748b;font-size:13px;">${t.amount > 0 ? ((t.commission / t.amount) * 100).toFixed(1) : "0.0"}%</td>
        <td style="padding:10px 14px;text-align:right;font-weight:700;color:#16a34a;font-size:13px;">${fmt(t.commission)}</td>
      </tr>`)
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      <thead>
        <tr style="background-color:#f1f5f9;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Customer</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Line Items</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Total Amount</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Eff. Rate</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:700;">Commission</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:16px;color:#94a3b8;">No data</td></tr>'}</tbody>
      <tfoot>
        <tr style="background-color:#f8fafc;border-top:2px solid #e2e8f0;">
          <td style="padding:10px 14px;font-weight:700;font-size:13px;color:#0f172a;">Total</td>
          <td style="padding:10px 14px;text-align:center;font-weight:700;font-size:13px;color:#0f172a;">${items.length}</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:13px;color:#0f172a;">${fmt(report.total_commissionable_amount)}</td>
          <td></td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:14px;color:#16a34a;">${fmt(report.total_commission_amount)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function buildEmailHtml(report: any): string {
  const repName = report.sales_reps?.name || "Sales Representative";
  const periodName = report.commission_periods?.name || `${fmtDateShort(report.period_start)} – ${fmtDateShort(report.period_end)}`;
  const customerSummary = buildCustomerSummaryHtml(report);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commission Report — ${periodName} — ${repName}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:680px;margin:0 auto;padding:0;background-color:#f8fafc;">
  <div style="background-color:#ffffff;margin:20px;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;padding:36px 32px;">
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">Proximity Lab Services</div>
      <div style="font-size:13px;opacity:0.7;margin-bottom:20px;">Commission Statement</div>
      <div style="font-size:22px;font-weight:700;">${repName}</div>
      <div style="font-size:14px;opacity:0.85;margin-top:4px;">${periodName}</div>
    </div>

    <div style="padding:32px;">
      <p style="font-size:15px;color:#334155;margin:0 0 24px 0;">
        Please find your commission report for <strong>${periodName}</strong> attached to this email as a PDF.
      </p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:4px;">Report #</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${report.report_number}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;font-weight:600;margin-bottom:4px;">Total Invoiced</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${fmt(report.total_invoice_amount)}</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#16a34a;font-weight:600;margin-bottom:4px;">Commission Owed</div>
          <div style="font-size:16px;font-weight:800;color:#16a34a;">${fmt(report.total_commission_amount)}</div>
        </div>
      </div>

      <div style="margin-bottom:28px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;font-weight:700;margin-bottom:10px;">Commission Summary by Customer</div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          ${customerSummary}
        </div>
      </div>

      <div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:4px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#92400e;">
          The full commission report with all invoice line items is attached as a PDF. Please review and reach out with any questions.
        </p>
      </div>

      <p style="font-size:13px;color:#64748b;margin:0;">
        If you have any questions regarding this commission statement, please contact us at
        <a href="mailto:info@proximitylabservices.com" style="color:#0ea5e9;">info@proximitylabservices.com</a>.
      </p>
    </div>

    <div style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 4px 0;font-size:13px;color:#475569;font-weight:600;">Proximity Lab Services</p>
      <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;">16922 Telge Rd., Suite 2 · Cypress, TX 77429</p>
      <p style="margin:0;font-size:12px;color:#94a3b8;">(210) 316-1792 · info@proximitylabservices.com</p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(report: any): string {
  const repName = report.sales_reps?.name || "Sales Representative";
  const periodName = report.commission_periods?.name || `${fmtDateShort(report.period_start)} – ${fmtDateShort(report.period_end)}`;
  const items = report.commission_report_items || [];

  const byCustomer: Record<string, { amount: number; commission: number; count: number }> = {};
  items.forEach((item: any) => {
    const key = item.qbo_invoices?.customer_name || "Unknown";
    if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
    byCustomer[key].amount += item.commissionable_amount || 0;
    byCustomer[key].commission += item.commission_amount || 0;
    byCustomer[key].count += 1;
  });

  const summaryLines = Object.entries(byCustomer)
    .sort((a, b) => b[1].commission - a[1].commission)
    .map(([customer, t]) => `  ${customer}: ${fmt(t.commission)} (${t.count} line item${t.count !== 1 ? "s" : ""}, ${fmt(t.amount)} total)`)
    .join("\n");

  return `Commission Report — ${periodName} — ${repName}

Hello ${repName},

Please find your commission report for ${periodName} attached to this email.

Report #: ${report.report_number}
Total Invoiced: ${fmt(report.total_invoice_amount)}
Commission Owed: ${fmt(report.total_commission_amount)}

Commission Summary by Customer:
${summaryLines || "  No data"}

Total Commission: ${fmt(report.total_commission_amount)}

The full report with all invoice line items is attached as a PDF.

If you have any questions, please contact us at info@proximitylabservices.com.

---
Proximity Lab Services
16922 Telge Rd., Suite 2
Cypress, TX 77429
(210) 316-1792
info@proximitylabservices.com
`;
}

function buildPdfHtml(report: any): string {
  const items = report.commission_report_items || [];

  const byCustomer: Record<string, { amount: number; commission: number; count: number }> = {};
  items.forEach((item: any) => {
    const key = item.qbo_invoices?.customer_name || "Unknown";
    if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
    byCustomer[key].amount += item.commissionable_amount || 0;
    byCustomer[key].commission += item.commission_amount || 0;
    byCustomer[key].count += 1;
  });

  const summaryRows = Object.entries(byCustomer)
    .sort((a, b) => b[1].commission - a[1].commission)
    .map(([customer, t], idx) => `
    <tr style="${idx % 2 !== 0 ? "background:#f8fafc" : ""}">
      <td>${customer}</td>
      <td style="text-align:center">${t.count}</td>
      <td style="text-align:right">${fmt(t.amount)}</td>
      <td style="text-align:right">${t.amount > 0 ? ((t.commission / t.amount) * 100).toFixed(1) : "0.0"}%</td>
      <td style="text-align:right;font-weight:700;color:#16a34a">${fmt(t.commission)}</td>
    </tr>`).join("");

  const lineItemRows = items.map((item: any, idx: number) => {
    const inv = item.qbo_invoices || {};
    const arPaid = inv.ar_paid || "";
    const arStyle = arPaid.toLowerCase() === "paid"
      ? "background:#dcfce7;color:#16a34a"
      : "background:#fef9c3;color:#ca8a04";
    return `
    <tr style="${idx % 2 !== 0 ? "background:#f8fafc" : ""}">
      <td>${fmtDateShort(inv.transaction_date || inv.invoice_date)}</td>
      <td>${inv.num || inv.invoice_number || "—"}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.customer_name || "—"}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.product_service || "—"}</td>
      <td>${arPaid ? `<span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;${arStyle}">${arPaid}</span>` : "—"}</td>
      <td style="text-align:right">${fmt(item.commissionable_amount)}</td>
      <td style="text-align:right">${((item.commission_rate || 0) * 100).toFixed(1)}%</td>
      <td style="text-align:right;font-weight:600;color:#16a34a">${fmt(item.commission_amount)}</td>
    </tr>`;
  }).join("");

  const statusClass = (report.status || "draft").toLowerCase().replace(/\s+/g, "-");
  const badgeColors: Record<string, string> = {
    approved: "background:#dcfce7;color:#16a34a",
    draft: "background:#f1f5f9;color:#64748b",
    "pending-approval": "background:#fef9c3;color:#ca8a04",
    emailed: "background:#ccfbf1;color:#0d9488",
    paid: "background:#dbeafe;color:#2563eb",
    rejected: "background:#fee2e2;color:#dc2626",
  };
  const badgeStyle = badgeColors[statusClass] || "background:#f1f5f9;color:#64748b";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; color:#1e293b; background:white; padding:48px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:36px; padding-bottom:24px; border-bottom:2px solid #e2e8f0; }
  .company-name { font-size:22px; font-weight:800; color:#0f172a; }
  .company-sub { font-size:12px; color:#64748b; margin-top:2px; }
  .report-title { text-align:right; }
  .report-title h1 { font-size:20px; font-weight:700; color:#0f172a; }
  .report-title .num { font-size:13px; color:#64748b; margin-top:4px; }
  .rep-block { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px 24px; margin-bottom:24px; display:flex; justify-content:space-between; gap:24px; }
  .rep-block .lbl { font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:600; margin-bottom:3px; }
  .rep-block .val { font-size:15px; font-weight:600; color:#0f172a; }
  .rep-block .sub { font-size:12px; color:#64748b; margin-top:2px; }
  .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
  .sc { padding:14px 18px; border-radius:10px; border:1px solid #e2e8f0; }
  .sc .sl { font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:600; margin-bottom:5px; }
  .sc .sv { font-size:20px; font-weight:800; color:#0f172a; }
  .sc.hi { background:#f0fdf4; border-color:#86efac; }
  .sc.hi .sv { color:#16a34a; }
  .section-title { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; font-weight:700; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; margin-bottom:28px; font-size:12px; }
  thead tr { background:#f1f5f9; }
  th { padding:9px 12px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; font-weight:700; }
  td { padding:9px 12px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
  tfoot td { font-weight:700; background:#f8fafc; border-top:2px solid #e2e8f0; font-size:13px; }
  tfoot td:last-child { color:#16a34a; font-size:14px; }
  .footer { margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:flex-end; }
  .sig-line { border-top:1px solid #cbd5e1; width:200px; padding-top:8px; font-size:11px; color:#94a3b8; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company-name">Proximity Lab Services</div>
    <div class="company-sub">Commission Statement</div>
  </div>
  <div class="report-title">
    <h1>Commission Report</h1>
    <div class="num">${report.report_number}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Generated ${fmtDate(report.created_at)}</div>
    <div style="margin-top:8px;"><span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:700;text-transform:uppercase;${badgeStyle}">${report.status}</span></div>
  </div>
</div>
<div class="rep-block">
  <div>
    <div class="lbl">Sales Representative</div>
    <div class="val">${report.sales_reps?.name || "—"}</div>
    <div class="sub">${report.sales_reps?.email || ""}</div>
  </div>
  <div>
    <div class="lbl">Commission Period</div>
    <div class="val">${report.commission_periods?.name || "Custom Period"}</div>
    <div class="sub">${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}</div>
  </div>
  <div>
    <div class="lbl">Report Date</div>
    <div class="val">${fmtDate(report.created_at)}</div>
  </div>
</div>
<div class="summary-grid">
  <div class="sc"><div class="sl">Line Items</div><div class="sv">${items.length}</div></div>
  <div class="sc"><div class="sl">Total Invoiced</div><div class="sv">${fmt(report.total_invoice_amount)}</div></div>
  <div class="sc"><div class="sl">Commissionable</div><div class="sv">${fmt(report.total_commissionable_amount)}</div></div>
  <div class="sc hi"><div class="sl">Commission Owed</div><div class="sv">${fmt(report.total_commission_amount)}</div></div>
</div>
<div class="section-title">Invoice Line Items</div>
<table>
  <thead><tr>
    <th>Txn Date</th><th>Num</th><th>Customer</th><th>Product / Service</th><th>A/R Paid</th>
    <th style="text-align:right">Amount</th><th style="text-align:right">Rate</th><th style="text-align:right">Commission</th>
  </tr></thead>
  <tbody>${lineItemRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">No line items</td></tr>'}</tbody>
  <tfoot><tr>
    <td colspan="5">Total</td>
    <td style="text-align:right">${fmt(report.total_commissionable_amount)}</td>
    <td></td>
    <td style="text-align:right">${fmt(report.total_commission_amount)}</td>
  </tr></tfoot>
</table>
<div class="section-title">Commission Summary by Customer</div>
<table>
  <thead><tr>
    <th>Customer</th><th style="text-align:center">Line Items</th>
    <th style="text-align:right">Total Amount</th><th style="text-align:right">Eff. Rate</th><th style="text-align:right">Commission</th>
  </tr></thead>
  <tbody>${summaryRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">No data</td></tr>'}</tbody>
  <tfoot><tr>
    <td>Total</td><td style="text-align:center">${items.length}</td>
    <td style="text-align:right">${fmt(report.total_commissionable_amount)}</td>
    <td></td>
    <td style="text-align:right">${fmt(report.total_commission_amount)}</td>
  </tr></tfoot>
</table>
<div class="footer">
  <div><div class="sig-line">Approved By</div></div>
  <div><div class="sig-line">Sales Representative Signature</div></div>
  <div style="text-align:right;font-size:11px;color:#94a3b8">
    <div>Proximity Lab Services</div>
    <div style="margin-top:4px">Confidential Commission Statement</div>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured", details: "RESEND_API_KEY is not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reportId } = await req.json();

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: "Missing reportId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: report, error: reportError } = await supabase
      .from("commission_reports")
      .select(`
        *,
        sales_reps(id, name, email),
        commission_periods(id, name, start_date, end_date),
        commission_report_items(
          *,
          qbo_invoices(invoice_number, num, customer_name, invoice_date, transaction_date, total_amount, status, ar_paid, product_service)
        )
      `)
      .eq("id", reportId)
      .maybeSingle();

    if (reportError) {
      console.error("Report query error:", JSON.stringify(reportError));
      return new Response(
        JSON.stringify({ error: "Report query failed", details: reportError.message, hint: reportError.hint, code: reportError.code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!report) {
      return new Response(
        JSON.stringify({ error: "Report not found", details: `No report found with id: ${reportId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (report.commission_report_items) {
      report.commission_report_items = report.commission_report_items.slice().sort((a: any, b: any) => {
        const dateA = new Date(a.qbo_invoices?.transaction_date || a.qbo_invoices?.invoice_date || 0).getTime();
        const dateB = new Date(b.qbo_invoices?.transaction_date || b.qbo_invoices?.invoice_date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const numA = (a.qbo_invoices?.num || a.qbo_invoices?.invoice_number || "").toLowerCase();
        const numB = (b.qbo_invoices?.num || b.qbo_invoices?.invoice_number || "").toLowerCase();
        return numA.localeCompare(numB, undefined, { numeric: true });
      });
    }

    const { data: settings } = await supabase
      .from("commission_settings")
      .select("cc_emails")
      .maybeSingle();

    const repEmail = report.sales_reps?.email;
    if (!repEmail) {
      return new Response(
        JSON.stringify({ error: "Sales rep has no email address configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ccEmails: string[] = settings?.cc_emails || [];
    const repName = report.sales_reps?.name || "Sales Representative";
    const periodName = report.commission_periods?.name ||
      `${fmtDateShort(report.period_start)} – ${fmtDateShort(report.period_end)}`;

    const subject = `Commission: ${periodName} - ${repName}`;
    const emailHtml = buildEmailHtml(report);
    const emailText = buildEmailText(report);
    const pdfHtml = buildPdfHtml(report);

    const fromEmail = Deno.env.get("EMAIL_FROM") || "Proximity Lab Services <noreply@proximitylabservices.com>";

    const emailPayload: any = {
      from: fromEmail,
      to: [repEmail],
      subject,
      html: emailHtml,
      text: emailText,
      reply_to: "info@proximitylabservices.com",
      attachments: [
        {
          filename: `Commission_Report_${report.report_number}_${repName.replace(/\s+/g, "_")}.html`,
          content: btoa(unescape(encodeURIComponent(pdfHtml))),
          content_type: "text/html",
        }
      ],
    };

    if (ccEmails.length > 0) {
      emailPayload.cc = ccEmails;
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(errorData.message || "Failed to send email via Resend");
    }

    const result = await resendResponse.json();
    console.log("Commission report email sent:", result.id);

    await supabase
      .from("commission_reports")
      .update({
        status: "Emailed",
        emailed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Commission report emailed successfully",
        emailId: result.id,
        sentTo: repEmail,
        cc: ccEmails,
        subject,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending commission report email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send commission report email", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
