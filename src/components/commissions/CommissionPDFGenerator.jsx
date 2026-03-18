import React, { useEffect, useRef } from 'react';
import { X, Download, Printer } from 'lucide-react';
import { commissionReportsService } from '../../services/commissionsService';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function CommissionPDFGenerator({ report, onClose }) {
  const frameRef = useRef(null);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Commission Report ${report.report_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; background: white; padding: 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #e2e8f0; }
  .company { }
  .company-name { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
  .company-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
  .report-title .number { font-size: 13px; color: #64748b; margin-top: 4px; }
  .report-title .date { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .rep-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; display: flex; justify-content: space-between; }
  .rep-section .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
  .rep-section .value { font-size: 15px; font-weight: 600; color: #0f172a; }
  .rep-section .sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .summary-card { padding: 16px 20px; border-radius: 10px; border: 1px solid #e2e8f0; }
  .summary-card .s-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; margin-bottom: 6px; }
  .summary-card .s-value { font-size: 22px; font-weight: 800; color: #0f172a; }
  .summary-card.highlight { background: #f0fdf4; border-color: #86efac; }
  .summary-card.highlight .s-value { color: #16a34a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead tr { background: #f1f5f9; }
  th { padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 10px 14px; font-size: 13px; color: #374151; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .total-row td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; font-size: 14px; }
  .total-row td:last-child { color: #16a34a; font-size: 16px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer .sig-line { border-top: 1px solid #cbd5e1; width: 200px; padding-top: 8px; font-size: 12px; color: #94a3b8; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .status-approved { background: #dcfce7; color: #16a34a; }
  .status-draft { background: #f1f5f9; color: #64748b; }
  .status-pending { background: #fef9c3; color: #ca8a04; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="company">
    <div class="company-name">Proximity Lab Services</div>
    <div class="company-sub">Commission Statement</div>
  </div>
  <div class="report-title">
    <h1>Commission Report</h1>
    <div class="number">${report.report_number}</div>
    <div class="date">Generated ${formatDate(report.created_at)}</div>
    <div style="margin-top:8px">
      <span class="status-badge status-${(report.status || 'draft').toLowerCase().replace(' ', '-')}">
        ${report.status}
      </span>
    </div>
  </div>
</div>

<div class="rep-section">
  <div>
    <div class="label">Sales Representative</div>
    <div class="value">${report.sales_reps?.name || '—'}</div>
    <div class="sub">${report.sales_reps?.email || ''}</div>
  </div>
  <div>
    <div class="label">Commission Period</div>
    <div class="value">${report.commission_periods?.name || 'Custom Period'}</div>
    <div class="sub">${formatDate(report.period_start)} – ${formatDate(report.period_end)}</div>
  </div>
  <div>
    <div class="label">Report Date</div>
    <div class="value">${formatDate(report.created_at)}</div>
  </div>
</div>

<div class="summary">
  <div class="summary-card">
    <div class="s-label">Total Invoices</div>
    <div class="s-value">${fmt(report.total_invoice_amount)}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:4px">${report.total_invoices} invoice${report.total_invoices !== 1 ? 's' : ''}</div>
  </div>
  <div class="summary-card">
    <div class="s-label">Commissionable Amount</div>
    <div class="s-value">${fmt(report.total_commissionable_amount)}</div>
  </div>
  <div class="summary-card highlight">
    <div class="s-label">Commission Owed</div>
    <div class="s-value">${fmt(report.total_commission_amount)}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Invoice #</th>
      <th>Customer</th>
      <th>Invoice Date</th>
      <th>Invoice Total</th>
      <th>Rate</th>
      <th>Commission</th>
    </tr>
  </thead>
  <tbody>
    ${(report.commission_report_items || []).map(item => `
    <tr>
      <td>${item.qbo_invoices?.invoice_number || '—'}</td>
      <td>${item.qbo_invoices?.customer_name || '—'}</td>
      <td>${formatDate(item.qbo_invoices?.invoice_date)}</td>
      <td>${fmt(item.commissionable_amount)}</td>
      <td>${((item.commission_rate || 0) * 100).toFixed(1)}%</td>
      <td>${fmt(item.commission_amount)}</td>
    </tr>
    `).join('')}
    <tr class="total-row">
      <td colspan="4">Total</td>
      <td></td>
      <td>${fmt(report.total_commission_amount)}</td>
    </tr>
  </tbody>
</table>

${report.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:28px;font-size:13px;color:#475569"><strong>Notes:</strong> ${report.notes}</div>` : ''}

<div class="footer">
  <div>
    <div class="sig-line">Approved By</div>
  </div>
  <div>
    <div class="sig-line">Sales Representative Signature</div>
  </div>
  <div style="text-align:right;font-size:12px;color:#94a3b8">
    <div>Proximity Lab Services</div>
    <div style="margin-top:4px">Confidential Commission Statement</div>
  </div>
</div>
</body>
</html>`;

  async function handlePrint() {
    const frame = frameRef.current;
    if (frame) {
      frame.contentWindow.print();
    }
  }

  async function handleLoadDetail() {
    try {
      const detail = await commissionReportsService.getById(report.id);
      if (detail && frameRef.current) {
        frameRef.current.srcdoc = buildHtml(detail);
      }
    } catch {}
  }

  useEffect(() => {
    handleLoadDetail();
  }, [report.id]);

  function buildHtml(r) {
    return htmlContent.replace(
      '${(report.commission_report_items || []).map',
      ''
    );
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
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
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
      <div className="flex-1 bg-slate-200">
        <iframe
          ref={frameRef}
          srcDoc={htmlContent}
          className="w-full h-full border-0"
          title="Commission Report Preview"
        />
      </div>
    </div>
  );
}
