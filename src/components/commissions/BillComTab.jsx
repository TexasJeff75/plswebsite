import React, { useState, useEffect } from 'react';
import { Building2, Send, CircleCheck as CheckCircle, CircleAlert as AlertCircle, ExternalLink, FileText, RefreshCw, X, Info } from 'lucide-react';
import { commissionReportsService, salesRepsService } from '../../services/commissionsService';

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
  const [createModal, setCreateModal] = useState(null);
  const [payableId, setPayableId] = useState('');
  const [creating, setCreating] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await commissionReportsService.getAll({ status: 'Approved' });
      const paid = await commissionReportsService.getAll({ status: 'Paid' });
      const emailed = await commissionReportsService.getAll({ status: 'Emailed' });
      setReports([...data, ...emailed, ...paid]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePayable(report) {
    if (!payableId.trim()) {
      setError('Please enter the Bill.com payable/bill ID after creating it.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await commissionReportsService.updateBillComPayable(report.id, payableId.trim());
      setCreateModal(null);
      setPayableId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const readyForPayment = reports.filter(r => ['Approved', 'Emailed'].includes(r.status) && !r.billcom_payable_id);
  const paid = reports.filter(r => r.status === 'Paid' || r.billcom_payable_id);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Bill.com Payables
          </h2>
          <p className="text-sm text-slate-400">{readyForPayment.length} report{readyForPayment.length !== 1 ? 's' : ''} ready for payment</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSetup(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            <Info className="w-4 h-4" />
            Setup Guide
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showSetup && (
        <div className="bg-slate-800/80 border border-blue-500/30 rounded-xl p-5 space-y-4">
          <h3 className="text-blue-400 font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Bill.com + N8N Integration Setup
          </h3>
          <p className="text-sm text-slate-300">Use N8N to automate payable creation in Bill.com when a commission report is approved. Configure the following N8N workflow:</p>
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-200">Workflow Steps</p>
              <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
                <li>Trigger: Supabase webhook on <code className="bg-slate-600 px-1 rounded text-teal-300">commission_reports</code> WHERE status = Approved</li>
                <li>Look up sales rep's <code className="bg-slate-600 px-1 rounded text-teal-300">billcom_vendor_id</code> from <code className="bg-slate-600 px-1 rounded text-teal-300">sales_reps</code> table</li>
                <li>Bill.com Node: Create Bill / Payable with vendor ID and commission amount</li>
                <li>Update <code className="bg-slate-600 px-1 rounded text-teal-300">commission_reports.billcom_payable_id</code> with the returned Bill ID</li>
                <li>Update report status to <code className="bg-slate-600 px-1 rounded text-teal-300">Paid</code></li>
              </ol>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-200">Required Bill.com Fields</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><code className="text-teal-300">vendorId</code><span className="text-slate-500"> — from sales rep profile</span></div>
                <div><code className="text-teal-300">amount</code><span className="text-slate-500"> — total_commission_amount</span></div>
                <div><code className="text-teal-300">invoiceDate</code><span className="text-slate-500"> — period end date</span></div>
                <div><code className="text-teal-300">description</code><span className="text-slate-500"> — report number</span></div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">Alternatively, use the manual workflow below to record Bill.com payable IDs after creating them manually.</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {readyForPayment.length === 0 && paid.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No payables ready</p>
          <p className="text-sm">Approve commission reports to create Bill.com payables.</p>
        </div>
      ) : null}

      {readyForPayment.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            Ready for Payment ({readyForPayment.length})
          </h3>
          {readyForPayment.map(report => (
            <div key={report.id} className="bg-slate-800/60 border border-amber-500/20 rounded-xl p-5 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold">{report.sales_reps?.name}</p>
                      <span className="text-xs text-slate-500">{report.report_number}</span>
                    </div>
                    <p className="text-slate-400 text-sm">{report.commission_periods?.name || `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                        <span className="text-xs text-teal-500">Commission Amount</span>
                        <p className="text-teal-400 font-bold">{fmt(report.total_commission_amount)}</p>
                      </div>
                      {report.sales_reps?.billcom_vendor_id && (
                        <div className="px-3 py-1 bg-slate-700/50 rounded-lg">
                          <span className="text-xs text-slate-500">Vendor ID</span>
                          <p className="text-slate-300 text-sm font-mono">{report.sales_reps.billcom_vendor_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setCreateModal(report)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                  Record Payable
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paid.length > 0 && (
        <div className="space-y-3 mt-6">
          <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            Paid ({paid.length})
          </h3>
          {paid.map(report => (
            <div key={report.id} className="bg-slate-800/40 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{report.sales_reps?.name}</p>
                      <span className="text-xs text-slate-500">{report.report_number}</span>
                    </div>
                    <p className="text-slate-500 text-sm">{formatDate(report.period_start)} – {formatDate(report.period_end)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                  <div>
                    <p className="text-xs text-slate-500">Commission Paid</p>
                    <p className="text-emerald-400 font-semibold">{fmt(report.total_commission_amount)}</p>
                  </div>
                  {report.billcom_payable_id && (
                    <div className="px-3 py-1.5 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-500">Bill.com ID</p>
                      <p className="text-slate-300 text-xs font-mono">{report.billcom_payable_id}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Record Bill.com Payable</h3>
              <button onClick={() => { setCreateModal(null); setPayableId(''); setError(null); }} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
              <div className="bg-slate-700/30 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Sales Rep</span>
                  <span className="text-white font-medium">{createModal.sales_reps?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Period</span>
                  <span className="text-white">{createModal.commission_periods?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Commission Amount</span>
                  <span className="text-teal-400 font-bold">{fmt(createModal.total_commission_amount)}</span>
                </div>
                {createModal.sales_reps?.billcom_vendor_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Bill.com Vendor ID</span>
                    <span className="text-slate-300 font-mono text-xs">{createModal.sales_reps.billcom_vendor_id}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Bill.com Bill / Payable ID *</label>
                <input
                  value={payableId}
                  onChange={e => setPayableId(e.target.value)}
                  placeholder="Enter the Bill.com payable ID..."
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors font-mono"
                />
                <p className="text-xs text-slate-500 mt-1">Create the payable in Bill.com first, then enter the generated ID here to link it.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button onClick={() => { setCreateModal(null); setPayableId(''); setError(null); }} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
              <button
                onClick={() => handleCreatePayable(createModal)}
                disabled={creating || !payableId.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {creating ? 'Recording...' : 'Mark as Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
