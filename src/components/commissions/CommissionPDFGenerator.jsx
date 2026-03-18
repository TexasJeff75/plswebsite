import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Loader } from 'lucide-react';
import { commissionReportsService } from '../../services/commissionsService';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildHtml(r) {
  const items = r.commission_report_items || [];

  const byCustomer = {};
  items.forEach(item => {
    const key = item.qbo_invoices?.customer_name || 'Unknown';
    if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
    byCustomer[key].amount += item.commissionable_amount || 0;
    byCustomer[key].commission += item.commission_amount || 0;
    byCustomer[key].count += 1;
  });
  const summaryRows = Object.entries(byCustomer)
    .sort((a, b) => b[1].commission - a[1].commission);

  const lineItemRows = items.map((item, idx) => {
    const inv = item.qbo_invoices || {};
    const arPaid = inv.ar_paid || '';
    const arStyle = arPaid.toLowerCase() === 'paid'
      ? 'background:#dcfce7;color:#16a34a'
      : 'background:#fef9c3;color:#ca8a04';
    return `
    <tr style="${idx % 2 !== 0 ? 'background:#f8fafc' : ''}">
      <td>${fmtDateShort(inv.transaction_date || inv.invoice_date)}</td>
      <td>${inv.num || inv.invoice_number || '—'}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.customer_name || '—'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inv.product_service || '—'}</td>
      <td>${arPaid ? `<span style="padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;${arStyle}">${arPaid}</span>` : '—'}</td>
      <td style="text-align:right">${fmt(item.commissionable_amount)}</td>
      <td style="text-align:right">${((item.commission_rate || 0) * 100).toFixed(1)}%</td>
      <td style="text-align:right;font-weight:600;color:#16a34a">${fmt(item.commission_amount)}</td>
    </tr>`;
  }).join('');

  const summaryTableRows = summaryRows.map(([customer, t]) => `
    <tr>
      <td>${customer}</td>
      <td style="text-align:center">${t.count}</td>
      <td style="text-align:right">${fmt(t.amount)}</td>
      <td style="text-align:right">${t.amount > 0 ? ((t.commission / t.amount) * 100).toFixed(1) : '0.0'}%</td>
      <td style="text-align:right;font-weight:700;color:#16a34a">${fmt(t.commission)}</td>
    </tr>`).join('');

  const statusClass = (r.status || 'draft').toLowerCase().replace(/\s+/g, '-');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Commission Report ${r.report_number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; color:#1e293b; background:white; padding:48px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:36px; padding-bottom:24px; border-bottom:2px solid #e2e8f0; }
  .company-name { font-size:22px; font-weight:800; color:#0f172a; letter-spacing:-0.5px; }
  .company-sub { font-size:12px; color:#64748b; margin-top:2px; }
  .report-title { text-align:right; }
  .report-title h1 { font-size:20px; font-weight:700; color:#0f172a; }
  .report-title .num { font-size:13px; color:#64748b; margin-top:4px; }
  .report-title .dt { font-size:12px; color:#94a3b8; margin-top:2px; }
  .badge { display:inline-block; padding:3px 10px; border-radius:9999px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-top:8px; }
  .badge-approved { background:#dcfce7; color:#16a34a; }
  .badge-draft { background:#f1f5f9; color:#64748b; }
  .badge-pending-approval { background:#fef9c3; color:#ca8a04; }
  .badge-emailed { background:#ccfbf1; color:#0d9488; }
  .badge-paid { background:#dbeafe; color:#2563eb; }
  .badge-rejected { background:#fee2e2; color:#dc2626; }
  .rep-block { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px 24px; margin-bottom:24px; display:flex; justify-content:space-between; gap:24px; }
  .rep-block .lbl { font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:600; margin-bottom:3px; }
  .rep-block .val { font-size:15px; font-weight:600; color:#0f172a; }
  .rep-block .sub { font-size:12px; color:#64748b; margin-top:2px; }
  .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
  .sc { padding:14px 18px; border-radius:10px; border:1px solid #e2e8f0; }
  .sc .sl { font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:600; margin-bottom:5px; }
  .sc .sv { font-size:20px; font-weight:800; color:#0f172a; }
  .sc .ss { font-size:11px; color:#94a3b8; margin-top:3px; }
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
  @media print { body { padding:20px; } }
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
    <div class="num">${r.report_number}</div>
    <div class="dt">Generated ${fmtDate(r.created_at)}</div>
    <div><span class="badge badge-${statusClass}">${r.status}</span></div>
  </div>
</div>

<div class="rep-block">
  <div>
    <div class="lbl">Sales Representative</div>
    <div class="val">${r.sales_reps?.name || '—'}</div>
    <div class="sub">${r.sales_reps?.email || ''}</div>
  </div>
  <div>
    <div class="lbl">Commission Period</div>
    <div class="val">${r.commission_periods?.name || 'Custom Period'}</div>
    <div class="sub">${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}</div>
  </div>
  <div>
    <div class="lbl">Report Date</div>
    <div class="val">${fmtDate(r.created_at)}</div>
  </div>
</div>

<div class="summary-grid">
  <div class="sc">
    <div class="sl">Line Items</div>
    <div class="sv">${items.length}</div>
    <div class="ss">${r.total_invoices} invoice${r.total_invoices !== 1 ? 's' : ''}</div>
  </div>
  <div class="sc">
    <div class="sl">Total Invoiced</div>
    <div class="sv">${fmt(r.total_invoice_amount)}</div>
  </div>
  <div class="sc">
    <div class="sl">Commissionable</div>
    <div class="sv">${fmt(r.total_commissionable_amount)}</div>
  </div>
  <div class="sc hi">
    <div class="sl">Commission Owed</div>
    <div class="sv">${fmt(r.total_commission_amount)}</div>
  </div>
</div>

<div class="section-title">Invoice Line Items</div>
<table>
  <thead>
    <tr>
      <th>Txn Date</th>
      <th>Num</th>
      <th>Customer</th>
      <th>Product / Service</th>
      <th>A/R Paid</th>
      <th style="text-align:right">Amount</th>
      <th style="text-align:right">Rate</th>
      <th style="text-align:right">Commission</th>
    </tr>
  </thead>
  <tbody>
    ${lineItemRows || '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">No line items</td></tr>'}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="5">Total</td>
      <td style="text-align:right">${fmt(r.total_commissionable_amount)}</td>
      <td></td>
      <td style="text-align:right">${fmt(r.total_commission_amount)}</td>
    </tr>
  </tfoot>
</table>

<div class="section-title">Commission Summary by Customer</div>
<table>
  <thead>
    <tr>
      <th>Customer</th>
      <th style="text-align:center">Line Items</th>
      <th style="text-align:right">Total Amount</th>
      <th style="text-align:right">Eff. Rate</th>
      <th style="text-align:right">Commission</th>
    </tr>
  </thead>
  <tbody>
    ${summaryTableRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">No data</td></tr>'}
  </tbody>
  <tfoot>
    <tr>
      <td>Total</td>
      <td style="text-align:center">${items.length}</td>
      <td style="text-align:right">${fmt(r.total_commissionable_amount)}</td>
      <td></td>
      <td style="text-align:right">${fmt(r.total_commission_amount)}</td>
    </tr>
  </tfoot>
</table>

${r.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:28px;font-size:12px;color:#475569"><strong>Notes:</strong> ${r.notes}</div>` : ''}

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

export default function CommissionPDFGenerator({ report, onClose }) {
  const frameRef = useRef(null);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    commissionReportsService.getById(report.id)
      .then(detail => {
        if (!cancelled) {
          setHtml(buildHtml(detail));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(buildHtml(report));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [report.id]);

  function handlePrint() {
    frameRef.current?.contentWindow?.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700">
        <div>
          <h3 className="text-white font-semibold">Commission Report — {report.report_number}</h3>
          <p className="text-slate-400 text-sm">{report.sales_reps?.name} · {report.commission_periods?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-slate-200 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading report data...</span>
            </div>
          </div>
        )}
        {html && (
          <iframe
            ref={frameRef}
            srcDoc={html}
            className="w-full h-full border-0"
            title="Commission Report Preview"
          />
        )}
      </div>
    </div>
  );
}
