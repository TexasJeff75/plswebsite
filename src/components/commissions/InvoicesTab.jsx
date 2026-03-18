import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, ListFilter as Filter, ChevronDown, ChevronRight, FileText, DollarSign, Calendar, User, CircleAlert as AlertCircle, Check } from 'lucide-react';
import { qboInvoicesService, salesRepsService, commissionPeriodsService } from '../../services/commissionsService';

const STATUS_COLORS = {
  'Paid': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Unpaid': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Partially Paid': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Overdue': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Voided': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InvoicesTab() {
  const [invoices, setInvoices] = useState([]);
  const [reps, setReps] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [assigningRep, setAssigningRep] = useState({});
  const [showN8NInfo, setShowN8NInfo] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [inv, r, p] = await Promise.all([
        qboInvoicesService.getAll(),
        salesRepsService.getAll(),
        commissionPeriodsService.getAll()
      ]);
      setInvoices(inv);
      setReps(r);
      setPeriods(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignRep(invoiceId, repId) {
    setAssigningRep(prev => ({ ...prev, [invoiceId]: true }));
    try {
      await qboInvoicesService.assignSalesRep(invoiceId, repId || null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigningRep(prev => ({ ...prev, [invoiceId]: false }));
    }
  }

  async function handleAssignPeriod(invoiceId, periodId) {
    try {
      await qboInvoicesService.assignPeriod(invoiceId, periodId || null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = invoices.filter(inv => {
    if (search && !inv.customer_name?.toLowerCase().includes(search.toLowerCase()) &&
        !inv.invoice_number?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRep && inv.sales_rep_id !== filterRep) return false;
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterPeriod && inv.commission_period_id !== filterPeriod) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const unassigned = filtered.filter(i => !i.sales_rep_id).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">QBO Invoices</h2>
          <p className="text-sm text-slate-400">{filtered.length} invoices · {fmt(totalFiltered)} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowN8NInfo(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            N8N Setup
          </button>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showN8NInfo && (
        <div className="bg-slate-800/80 border border-teal-500/30 rounded-xl p-5 space-y-3">
          <h3 className="text-teal-400 font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" /> N8N + QuickBooks Online Integration
          </h3>
          <p className="text-sm text-slate-300">Configure your N8N workflow to sync QBO invoices into this system. Use the Supabase node to upsert into the <code className="bg-slate-700 px-1 rounded text-teal-300">qbo_invoices</code> table.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-slate-400 text-xs uppercase font-semibold mb-1">Table Name</p>
              <code className="text-teal-300">qbo_invoices</code>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-slate-400 text-xs uppercase font-semibold mb-1">Upsert Key</p>
              <code className="text-teal-300">qbo_invoice_id</code>
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">Required QBO Fields to Map:</p>
            <code className="text-teal-300 block leading-relaxed">
              qbo_invoice_id, invoice_number, customer_name, invoice_date,<br/>
              total_amount, balance, status, customer_email
            </code>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {unassigned > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{unassigned}</strong> invoice{unassigned !== 1 ? 's' : ''} not yet assigned to a sales rep.</span>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or invoice #..."
            className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
          />
        </div>
        <select value={filterRep} onChange={e => setFilterRep(e.target.value)}
          className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
          <option value="">All Reps</option>
          {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
          <option value="">All Statuses</option>
          {['Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Voided'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
          className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
          <option value="">All Periods</option>
          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No invoices found</p>
          <p className="text-sm">Sync invoices from QuickBooks Online via N8N to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <div key={inv.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden hover:border-slate-600/60 transition-colors">
              <button
                onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left"
              >
                <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                  <div>
                    <p className="text-white font-medium text-sm truncate">{inv.customer_name}</p>
                    <p className="text-slate-500 text-xs">{inv.invoice_number || inv.qbo_invoice_id}</p>
                  </div>
                  <div className="text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[inv.status] || STATUS_COLORS['Unpaid']}`}>
                      {inv.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{fmt(inv.total_amount)}</p>
                    <p className="text-slate-500 text-xs">{formatDate(inv.invoice_date)}</p>
                  </div>
                  <div>
                    {inv.sales_reps ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-teal-400 text-xs font-bold">{inv.sales_reps.name?.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-slate-300 truncate">{inv.sales_reps.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-400 font-medium">Unassigned</span>
                    )}
                  </div>
                </div>
                {expandedId === inv.id ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
              </button>

              {expandedId === inv.id && (
                <div className="px-5 pb-5 border-t border-slate-700/60 pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Assign Sales Rep</label>
                      <select
                        value={inv.sales_rep_id || ''}
                        onChange={e => handleAssignRep(inv.id, e.target.value)}
                        disabled={assigningRep[inv.id]}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      >
                        <option value="">-- None --</option>
                        {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Commission Period</label>
                      <select
                        value={inv.commission_period_id || ''}
                        onChange={e => handleAssignPeriod(inv.id, e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                      >
                        <option value="">-- None --</option>
                        {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Customer Email</label>
                      <p className="text-sm text-slate-300 pt-2">{inv.customer_email || '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Invoice Total</p>
                      <p className="text-white font-semibold mt-0.5">{fmt(inv.total_amount)}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Balance Due</p>
                      <p className="text-white font-semibold mt-0.5">{fmt(inv.balance)}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Due Date</p>
                      <p className="text-white font-semibold mt-0.5">{formatDate(inv.due_date)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
