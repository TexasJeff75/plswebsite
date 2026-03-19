import React, { useState, useEffect } from 'react';
import { FilePlus, FileText, CircleCheck as CheckCircle, Circle as XCircle, Mail, DollarSign, Eye, ChevronDown, ChevronRight, CircleAlert as AlertCircle, Printer, Send, Building2, Download, Clock, RotateCcw } from 'lucide-react';
import {
  commissionReportsService,
  salesRepsService,
  commissionPeriodsService,
  commissionCalculationsService,
  qboInvoicesService,
  commissionRulesService
} from '../../services/commissionsService';
import { useAuth } from '../../contexts/AuthContext';
import CommissionPDFGenerator from './CommissionPDFGenerator';

const STATUS_COLORS = {
  'Draft': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'Pending Approval': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Approved': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Rejected': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Paid': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Emailed': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportsTab() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [reps, setReps] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [detailReport, setDetailReport] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [generateModal, setGenerateModal] = useState(false);
  const [genForm, setGenForm] = useState({ sales_rep_id: '', period_id: '' });
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pdfReport, setPdfReport] = useState(null);
  const [emailPreviewReport, setEmailPreviewReport] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [repHistory, setRepHistory] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [r, rp, p] = await Promise.all([
        commissionReportsService.getAll(),
        salesRepsService.getAll(),
        commissionPeriodsService.getAll()
      ]);
      setReports(r);
      setReps(rp);
      setPeriods(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!genForm.sales_rep_id || !genForm.period_id) {
      setError('Please select both a sales rep and a period.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const [invoices, rules, rep] = await Promise.all([
        qboInvoicesService.getAll({ salesRepId: genForm.sales_rep_id, periodId: genForm.period_id, paidOnly: true }),
        commissionRulesService.getAll(genForm.sales_rep_id),
        salesRepsService.getById(genForm.sales_rep_id)
      ]);

      if (invoices.length === 0) {
        setError('No invoices found for this rep and period.');
        setGenerating(false);
        return;
      }

      const calculations = await Promise.all(invoices.map(async inv => {
        const calc = await commissionCalculationsService.calculateForInvoice(inv, rep, rules);
        return commissionCalculationsService.saveCalculation(calc);
      }));

      const calcsWithInvoices = calculations.map((c, i) => ({
        ...c,
        qbo_invoices: invoices[i],
        commission_periods: periods.find(p => p.id === genForm.period_id)
      }));

      await commissionReportsService.generateReport(genForm.sales_rep_id, genForm.period_id, calcsWithInvoices);
      setGenerateModal(false);
      setGenForm({ sales_rep_id: '', period_id: '' });
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(report) {
    setActionLoading(prev => ({ ...prev, [report.id]: 'approving' }));
    try {
      await commissionReportsService.approve(report.id, user?.id);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [report.id]: null }));
    }
  }

  async function handleRevertToDraft(report) {
    setActionLoading(prev => ({ ...prev, [report.id]: 'reverting' }));
    try {
      await commissionReportsService.updateStatus(report.id, 'Draft');
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [report.id]: null }));
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setActionLoading(prev => ({ ...prev, [rejectModal.id]: 'rejecting' }));
    try {
      await commissionReportsService.reject(rejectModal.id, rejectReason);
      setRejectModal(null);
      setRejectReason('');
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [rejectModal?.id]: null }));
    }
  }

  async function handleEmailSend(report) {
    setEmailPreviewReport(report);
  }

  async function handleConfirmSend(report) {
    setActionLoading(prev => ({ ...prev, [report.id]: 'emailing' }));
    setEmailPreviewReport(null);
    try {
      await commissionReportsService.markEmailed(report.id);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [report.id]: null }));
    }
  }

  async function loadDetail(report) {
    try {
      const [detail, history] = await Promise.all([
        commissionReportsService.getById(report.id),
        commissionReportsService.getHistoryForRep(report.sales_rep_id)
      ]);
      setDetailReport(detail);
      setRepHistory(history);
      setExpandedId(report.id);
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = reports.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterRep && r.sales_rep_id !== filterRep) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Commission Reports</h2>
          <p className="text-sm text-slate-400">{filtered.length} report{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <FilePlus className="w-4 h-4" />
          Generate Report
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto text-slate-500 hover:text-slate-300">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterRep} onChange={e => setFilterRep(e.target.value)}
          className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
          <option value="">All Reps</option>
          {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No reports yet</p>
          <p className="text-sm">Generate a report for a sales rep and period to begin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => (
            <div key={report.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden hover:border-slate-600/60 transition-colors">
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                  <div>
                    <p className="text-white font-semibold text-sm">{report.report_number}</p>
                    <p className="text-slate-500 text-xs">{formatDate(report.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm truncate">{report.sales_reps?.name}</p>
                    <p className="text-slate-500 text-xs">{report.commission_periods?.name || `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`}</p>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[report.status]}`}>
                      {report.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Commission</p>
                    <p className="text-teal-400 font-semibold">{fmt(report.total_commission_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Invoices</p>
                    <p className="text-white font-medium">{report.total_invoices} · {fmt(report.total_invoice_amount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {report.status === 'Draft' && (
                    <button
                      onClick={() => handleApprove(report)}
                      disabled={actionLoading[report.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {actionLoading[report.id] === 'approving' ? 'Approving...' : 'Approve'}
                    </button>
                  )}
                  {report.status === 'Draft' && (
                    <button
                      onClick={() => setRejectModal(report)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  )}
                  {report.status === 'Approved' && (
                    <button
                      onClick={() => handleEmailSend(report)}
                      disabled={actionLoading[report.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {actionLoading[report.id] === 'emailing' ? 'Sending...' : 'Send Email'}
                    </button>
                  )}
                  {['Approved', 'Emailed', 'Rejected'].includes(report.status) && (
                    <button
                      onClick={() => handleRevertToDraft(report)}
                      disabled={actionLoading[report.id]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600/40 hover:bg-slate-600/70 border border-slate-500/40 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {actionLoading[report.id] === 'reverting' ? 'Reverting...' : 'Revert to Draft'}
                    </button>
                  )}
                  <button
                    onClick={() => setPdfReport(report)}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    title="Preview PDF"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (expandedId === report.id) { setExpandedId(null); setRepHistory(null); } else { loadDetail(report); } }}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    {expandedId === report.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === report.id && detailReport?.id === report.id && (
                <div className="border-t border-slate-700/60">
                  <div className="px-5 pt-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 uppercase">Line Items</p>
                      <p className="text-white font-semibold mt-0.5">{detailReport.commission_report_items?.length ?? 0}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 uppercase">Total Amount</p>
                      <p className="text-white font-semibold mt-0.5">{fmt(detailReport.total_invoice_amount)}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-slate-500 uppercase">Commissionable</p>
                      <p className="text-white font-semibold mt-0.5">{fmt(detailReport.total_commissionable_amount)}</p>
                    </div>
                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 text-center">
                      <p className="text-xs text-teal-500 uppercase">Commission Owed</p>
                      <p className="text-teal-400 font-bold mt-0.5 text-lg">{fmt(detailReport.total_commission_amount)}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Invoice Line Items</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                      <table className="w-full text-xs min-w-max">
                        <thead>
                          <tr className="bg-slate-700/50">
                            <th className="px-3 py-2.5 text-left text-slate-400 font-semibold">Txn Date</th>
                            <th className="px-3 py-2.5 text-left text-slate-400 font-semibold">Num</th>
                            <th className="px-3 py-2.5 text-left text-slate-400 font-semibold">Customer</th>
                            <th className="px-3 py-2.5 text-left text-slate-400 font-semibold">Product / Service</th>
                            <th className="px-3 py-2.5 text-left text-slate-400 font-semibold">A/R Paid</th>
                            <th className="px-3 py-2.5 text-right text-slate-400 font-semibold">Amount</th>
                            <th className="px-3 py-2.5 text-right text-slate-400 font-semibold">Rate</th>
                            <th className="px-3 py-2.5 text-right text-slate-400 font-semibold">Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailReport.commission_report_items?.map((item, idx) => {
                            const inv = item.qbo_invoices;
                            return (
                              <tr key={item.id} className={`border-t border-slate-700/40 ${idx % 2 === 0 ? '' : 'bg-slate-700/10'}`}>
                                <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatDate(inv?.transaction_date || inv?.invoice_date)}</td>
                                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{inv?.num || inv?.invoice_number || '—'}</td>
                                <td className="px-3 py-2 text-slate-200 whitespace-nowrap max-w-48 truncate">{inv?.customer_name || '—'}</td>
                                <td className="px-3 py-2 text-slate-400 whitespace-nowrap max-w-48 truncate">{inv?.product_service || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {inv?.ar_paid ? (
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${inv.ar_paid.toLowerCase() === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                      {inv.ar_paid}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-white font-medium whitespace-nowrap">{fmt(item.commissionable_amount)}</td>
                                <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">{((item.commission_rate || 0) * 100).toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right text-teal-400 font-semibold whitespace-nowrap">{fmt(item.commission_amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                            <td colSpan={5} className="px-3 py-2.5 text-slate-400 font-semibold text-xs uppercase">Total</td>
                            <td className="px-3 py-2.5 text-right text-white font-bold">{fmt(detailReport.total_commissionable_amount)}</td>
                            <td className="px-3 py-2.5"></td>
                            <td className="px-3 py-2.5 text-right text-teal-400 font-bold text-sm">{fmt(detailReport.total_commission_amount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Commission Summary</p>
                    <div className="bg-slate-700/20 border border-slate-700/60 rounded-xl overflow-hidden">
                      {(() => {
                        const byCustomer = {};
                        (detailReport.commission_report_items || []).forEach(item => {
                          const key = item.qbo_invoices?.customer_name || 'Unknown';
                          if (!byCustomer[key]) byCustomer[key] = { amount: 0, commission: 0, count: 0 };
                          byCustomer[key].amount += item.commissionable_amount || 0;
                          byCustomer[key].commission += item.commission_amount || 0;
                          byCustomer[key].count += 1;
                        });
                        return Object.entries(byCustomer)
                          .sort((a, b) => b[1].commission - a[1].commission)
                          .map(([customer, totals], i, arr) => (
                            <div key={customer} className={`flex items-center justify-between px-4 py-3 text-sm ${i < arr.length - 1 ? 'border-b border-slate-700/40' : ''}`}>
                              <div>
                                <p className="text-slate-200 font-medium">{customer}</p>
                                <p className="text-slate-500 text-xs">{totals.count} line item{totals.count !== 1 ? 's' : ''} · {fmt(totals.amount)} total</p>
                              </div>
                              <div className="text-right">
                                <p className="text-teal-400 font-semibold">{fmt(totals.commission)}</p>
                                <p className="text-slate-500 text-xs">{totals.amount > 0 ? ((totals.commission / totals.amount) * 100).toFixed(1) : '0.0'}% effective rate</p>
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>

                  {repHistory && repHistory.length > 0 && (
                    <div className="px-5 pb-5 pt-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Report History — {detailReport.sales_reps?.name}
                      </p>
                      <div className="relative">
                        <div className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-700/60" />
                        <div className="space-y-0">
                          {repHistory.map((hist, idx) => {
                            const isCurrent = hist.id === detailReport.id;
                            const statusDot = {
                              'Draft': 'bg-slate-500',
                              'Pending Approval': 'bg-amber-400',
                              'Approved': 'bg-emerald-400',
                              'Rejected': 'bg-red-400',
                              'Paid': 'bg-blue-400',
                              'Emailed': 'bg-teal-400',
                            }[hist.status] || 'bg-slate-500';
                            const statusText = {
                              'Draft': 'text-slate-400 border-slate-500/30 bg-slate-500/10',
                              'Pending Approval': 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                              'Approved': 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                              'Rejected': 'text-red-400 border-red-500/30 bg-red-500/10',
                              'Paid': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
                              'Emailed': 'text-teal-400 border-teal-500/30 bg-teal-500/10',
                            }[hist.status] || 'text-slate-400 border-slate-500/30 bg-slate-500/10';
                            return (
                              <div key={hist.id} className={`relative flex items-start gap-4 pl-7 py-3 rounded-lg transition-colors ${isCurrent ? 'bg-teal-500/5 border border-teal-500/15' : 'hover:bg-slate-700/20'}`}>
                                <div className={`absolute left-[7px] top-[18px] w-2 h-2 rounded-full border-2 border-slate-900 ${statusDot} ${isCurrent ? 'w-2.5 h-2.5 left-[5.5px]' : ''}`} />
                                <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-slate-200">{hist.commission_periods?.name || `${formatDate(hist.period_start)} – ${formatDate(hist.period_end)}`}</span>
                                      {isCurrent && <span className="px-1.5 py-0.5 bg-teal-500/20 border border-teal-500/30 text-teal-400 rounded text-xs font-medium">Current</span>}
                                      <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${statusText}`}>{hist.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">{hist.report_number} · Generated {formatDate(hist.created_at)} · {hist.unique_invoice_count ?? hist.total_invoices} invoice{(hist.unique_invoice_count ?? hist.total_invoices) !== 1 ? 's' : ''}</p>
                                    {hist.rejection_reason && (
                                      <p className="text-xs text-red-400 mt-0.5 italic">Rejected: {hist.rejection_reason}</p>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-semibold text-teal-400">{fmt(hist.total_commission_amount)}</p>
                                    <p className="text-xs text-slate-500">{fmt(hist.total_invoice_amount)} invoiced</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {detailReport.rejection_reason && (
                    <div className="mx-5 mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
                      <span className="font-medium">Rejection Reason:</span> {detailReport.rejection_reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {generateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Generate Commission Report</h3>
              <button onClick={() => { setGenerateModal(false); setError(null); }} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Sales Representative *</label>
                <select value={genForm.sales_rep_id} onChange={e => setGenForm(f => ({ ...f, sales_rep_id: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
                  <option value="">-- Select Rep --</option>
                  {reps.filter(r => r.status === 'Active').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Commission Period *</label>
                <select value={genForm.period_id} onChange={e => setGenForm(f => ({ ...f, period_id: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
                  <option value="">-- Select Period --</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name} ({formatDate(p.start_date)} – {formatDate(p.end_date)})</option>)}
                </select>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3 text-sm text-slate-400">
                Commission is calculated only on <span className="text-emerald-400 font-medium">paid invoices</span> (A/R Paid = Paid) assigned to this rep in the selected period.
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button onClick={() => { setGenerateModal(false); setError(null); }} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <FilePlus className="w-4 h-4" />
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <h3 className="text-white font-semibold text-lg mb-2">Reject Report</h3>
              <p className="text-slate-400 text-sm mb-4">Please provide a reason for rejecting report <strong className="text-white">{rejectModal.report_number}</strong>.</p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Enter rejection reason..."
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Reject Report
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfReport && (
        <CommissionPDFGenerator report={pdfReport} onClose={() => setPdfReport(null)} />
      )}

      {emailPreviewReport && (
        <CommissionPDFGenerator
          report={emailPreviewReport}
          onClose={() => setEmailPreviewReport(null)}
          onSend={() => handleConfirmSend(emailPreviewReport)}
          sendLabel="Confirm & Mark Sent"
        />
      )}
    </div>
  );
}
