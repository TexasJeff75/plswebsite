import React, { useState, useEffect } from 'react';
import {
  Building2, CircleCheck as CheckCircle, CircleAlert as AlertCircle,
  RefreshCw, X, DollarSign, Calendar, User, FileText, Hash
} from 'lucide-react';
import { commissionReportsService } from '../../services/commissionsService';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BillComTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payableId, setPayableId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [approved, emailed, paid] = await Promise.all([
        commissionReportsService.getAll({ status: 'Approved' }),
        commissionReportsService.getAll({ status: 'Emailed' }),
        commissionReportsService.getAll({ status: 'Paid' }),
      ]);
      setReports([...approved, ...emailed, ...paid]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid(report) {
    setSaving(true);
    setError(null);
    try {
      await commissionReportsService.updateBillComPayable(report.id, payableId.trim() || `MANUAL-${Date.now()}`);
      setPayModal(null);
      setPayableId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const readyForPayment = reports.filter(r => ['Approved', 'Emailed'].includes(r.status) && !r.billcom_payable_id);
  const paid = reports.filter(r => r.status === 'Paid' || r.billcom_payable_id);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-teal-400" />
            Payment Tracking
          </h2>
          <p className="text-sm text-slate-400">
            {readyForPayment.length} report{readyForPayment.length !== 1 ? 's' : ''} pending payment
            {paid.length > 0 && ` · ${paid.length} paid`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : readyForPayment.length === 0 && paid.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No payments to track</p>
          <p className="text-sm mt-1">Approve commission reports in the Reports tab to queue them for payment.</p>
        </div>
      ) : null}

      {readyForPayment.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Pending Payment ({readyForPayment.length})
          </h3>
          {readyForPayment.map(report => (
            <div key={report.id} className="bg-slate-800/60 border border-amber-500/20 rounded-xl p-5 hover:border-amber-500/35 transition-colors">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-400 font-bold text-sm">{report.sales_reps?.name?.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold">{report.sales_reps?.name}</p>
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono text-slate-500 bg-slate-700/60">{report.report_number}</span>
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {report.commission_periods?.name || `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`}
                    </p>
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <div className="px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                        <span className="text-xs text-teal-500 block">Commission Owed</span>
                        <p className="text-teal-400 font-bold">{fmt(report.total_commission_amount)}</p>
                      </div>
                      <div className="px-3 py-1.5 bg-slate-700/40 rounded-lg">
                        <span className="text-xs text-slate-500 block">Invoices</span>
                        <p className="text-slate-300 font-medium">{report.total_invoices}</p>
                      </div>
                      {report.sales_reps?.billcom_vendor_id && (
                        <div className="px-3 py-1.5 bg-slate-700/40 rounded-lg">
                          <span className="text-xs text-slate-500 block">Bill.com Vendor ID</span>
                          <p className="text-slate-300 text-xs font-mono">{report.sales_reps.billcom_vendor_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setPayModal(report); setPayableId(''); setError(null); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Paid
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paid.length > 0 && (
        <div className="space-y-2 mt-6">
          <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            Paid ({paid.length})
          </h3>
          {paid.map(report => (
            <div key={report.id} className="bg-slate-800/40 border border-emerald-500/15 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{report.sales_reps?.name}</p>
                      <span className="text-xs text-slate-500 font-mono">{report.report_number}</span>
                    </div>
                    <p className="text-slate-500 text-sm">{formatDate(report.period_start)} – {formatDate(report.period_end)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-right flex-wrap">
                  <div>
                    <p className="text-xs text-slate-500">Commission Paid</p>
                    <p className="text-emerald-400 font-semibold">{fmt(report.total_commission_amount)}</p>
                  </div>
                  {report.billcom_payable_id && !report.billcom_payable_id.startsWith('MANUAL-') && (
                    <div className="px-3 py-1.5 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-500">Reference ID</p>
                      <p className="text-slate-300 text-xs font-mono">{report.billcom_payable_id}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Mark as Paid</h3>
              <button
                onClick={() => { setPayModal(null); setPayableId(''); setError(null); }}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />{error}
                </div>
              )}
              <div className="bg-slate-700/30 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Sales Rep</span>
                  <span className="text-white font-medium">{payModal.sales_reps?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Period</span>
                  <span className="text-white">{payModal.commission_periods?.name || `${formatDate(payModal.period_start)} – ${formatDate(payModal.period_end)}`}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Report</span>
                  <span className="text-white font-mono text-xs">{payModal.report_number}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-600/50 mt-2">
                  <span className="text-slate-400 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Commission Amount</span>
                  <span className="text-teal-400 font-bold text-base">{fmt(payModal.total_commission_amount)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Payment Reference / Bill.com ID <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  value={payableId}
                  onChange={e => setPayableId(e.target.value)}
                  placeholder="e.g. Bill.com payable ID, check number..."
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                />
                <p className="text-xs text-slate-500 mt-1.5">Leave blank to record as a manual payment without a reference ID.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button
                onClick={() => { setPayModal(null); setPayableId(''); setError(null); }}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMarkPaid(payModal)}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
