// Builds the Payables alert email sent to Super Admins after a sync.
// Pure functions, so they can be tested without Supabase or Resend.

export interface PendingAlerts {
  recipients: string[];
  payments: Array<{ key: string; vendor_name: string | null; amount: number; process_date: string | null; status: string }>;
  approvals: Array<{ key: string; vendor_name: string | null; invoice_number: string | null; amount: number; due_date: string | null; days_waiting: number }>;
  missed: Array<{ key: string; vendor_name: string | null; invoice_number: string | null; amount: number; planned_date: string; seq: number; of: number }>;
}

export function alertKeys(a: PendingAlerts): string[] {
  return [...a.payments, ...a.approvals, ...a.missed].map((x) => x.key);
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

const formatDay = (d: string | null) => {
  if (!d) return "no date";
  const [y, m, dd] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

const statusLabel = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildAlertEmail(a: PendingAlerts, trackerUrl: string) {
  const parts: string[] = [];
  if (a.payments.length) parts.push(plural(a.payments.length, "payment problem", "payment problems"));
  if (a.missed.length) parts.push(plural(a.missed.length, "missed installment", "missed installments"));
  if (a.approvals.length) parts.push(plural(a.approvals.length, "bill waiting on approval", "bills waiting on approval"));
  const subject = `Payables alert: ${parts.join(", ")}`;

  const section = (title: string, color: string, note: string, rows: string[][]) => `
    <h2 style="font-size:16px;margin:24px 0 4px;color:${color};">${esc(title)}</h2>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">${esc(note)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows.map((r, i) => `<tr style="${i % 2 ? "background:#f8fafc;" : ""}">${r.map((c, j) =>
        `<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;${j === r.length - 1 ? "text-align:right;white-space:nowrap;" : ""}">${c}</td>`).join("")}</tr>`).join("")}
    </table>`;

  let body = "";
  const textLines: string[] = [subject, ""];

  if (a.payments.length) {
    body += section("Payment problems", "#b91c1c", "Open the payment in BILL to fix or reissue it.",
      a.payments.map((p) => [esc(p.vendor_name || "Unknown vendor"), `${esc(statusLabel(p.status))}<br><span style="color:#64748b;">Process date ${esc(formatDay(p.process_date))}</span>`, esc(money(p.amount))]));
    textLines.push("PAYMENT PROBLEMS (fix or reissue in BILL)");
    for (const p of a.payments) textLines.push(`- ${p.vendor_name || "Unknown vendor"}: ${money(p.amount)}, ${statusLabel(p.status)}, process date ${formatDay(p.process_date)}`);
    textLines.push("");
  }
  if (a.missed.length) {
    body += section("Missed installments", "#b45309", "Planned in the tracker but not scheduled in BILL within 3 days of the planned date.",
      a.missed.map((m) => [esc(m.vendor_name || "Unknown vendor"), `${esc(m.invoice_number || "No invoice #")} · payment ${m.seq} of ${m.of}<br><span style="color:#64748b;">Planned for ${esc(formatDay(m.planned_date))}</span>`, esc(money(m.amount))]));
    textLines.push("MISSED INSTALLMENTS (schedule in BILL or update the pay plan)");
    for (const m of a.missed) textLines.push(`- ${m.vendor_name || "Unknown vendor"} ${m.invoice_number || ""}: ${money(m.amount)}, payment ${m.seq} of ${m.of}, planned ${formatDay(m.planned_date)}`);
    textLines.push("");
  }
  if (a.approvals.length) {
    body += section("Waiting on approval for more than 7 days", "#0f766e", "Approve or deny these in BILL so they can be paid on time.",
      a.approvals.map((b) => [esc(b.vendor_name || "Unknown vendor"), `${esc(b.invoice_number || "No invoice #")} · due ${esc(formatDay(b.due_date))}<br><span style="color:#64748b;">${b.days_waiting} days waiting</span>`, esc(money(b.amount))]));
    textLines.push("WAITING ON APPROVAL FOR MORE THAN 7 DAYS");
    for (const b of a.approvals) textLines.push(`- ${b.vendor_name || "Unknown vendor"} ${b.invoice_number || ""}: ${money(b.amount)}, due ${formatDay(b.due_date)}, ${b.days_waiting} days waiting`);
    textLines.push("");
  }

  const link = `${trackerUrl.replace(/\/$/, "")}/tracker.html#/payables`;
  textLines.push(`Open Payables: ${link}`, "", "You get each alert once. Sent to Super Admins by the Deployment Tracker.");

  const html = `<!DOCTYPE html><html><body style="font-family:Poppins,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.5;color:#1e293b;max-width:680px;margin:0 auto;padding:0;background:#f8fafc;">
  <div style="background:#ffffff;margin:20px;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;color:#ffffff;padding:24px 28px;">
      <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#5eead4;">Proximity Lab Services · Payables</p>
      <h1 style="margin:6px 0 0;font-size:20px;">${esc(subject)}</h1>
    </div>
    <div style="padding:8px 28px 28px;">
      ${body}
      <p style="margin:28px 0 0;"><a href="${esc(link)}" style="display:inline-block;background:#14b8a6;color:#0f172a;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;">Open Payables</a></p>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">You get each alert once. Sent to Super Admins by the Deployment Tracker.</p>
    </div>
  </div>
</body></html>`;

  return { subject, html, text: textLines.join("\n") };
}
