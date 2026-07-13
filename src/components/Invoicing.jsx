import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, FileSpreadsheet, Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, Download, Check, X, CircleAlert as AlertCircle, Loader as Loader2, Receipt, Building2, Eye, EyeOff, ArrowLeft, TrendingUp, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  invoiceBatchService,
  weeklyInvoiceService,
  invoiceLineItemService,
  exportToQuickBooksCSV,
  getWeekStart,
  getWeekEnd,
  weeklyRate,
} from '../services/invoiceCalculationService';

const BATCH_STATUS_COLORS = {
  draft: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  reviewed: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  exported: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  void: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const LINE_TYPE_COLORS = {
  service_fee: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  lis_saas_fee: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  custom: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '\u2014';
  const [y, m, day] = String(d).split('T')[0].split('-').map(Number);
  if (y && m && day) {
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function Invoicing() {
  const { profile } = useAuth();
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [requisitionDate, setRequisitionDate] = useState(todayISO());
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [view, setView] = useState('list');

  const isAllowed =
    profile?.role === 'Super Admin' || profile?.role === 'Proximity Admin';

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoiceBatchService.getAll();
      setBatches(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBatchDetail = useCallback(async (batchId) => {
    try {
      const data = await weeklyInvoiceService.getByBatch(batchId);
      setInvoices(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  async function handleGenerate() {
    if (!requisitionDate) return;
    setGenerating(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const batch = await invoiceBatchService.create(requisitionDate, user?.id);
      const result = await invoiceBatchService.generateInvoices(
        batch.id,
        requisitionDate
      );
      await loadBatches();
      setSelectedBatch(batch);
      await loadBatchDetail(batch.id);
      setView('detail');
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectBatch(batch) {
    setSelectedBatch(batch);
    setView('detail');
    await loadBatchDetail(batch.id);
  }

  async function handleDeleteBatch(batchId) {
    if (!confirm('Delete this entire batch and all its invoices? This cannot be undone.')) return;
    try {
      await invoiceBatchService.delete(batchId);
      if (selectedBatch?.id === batchId) {
        setSelectedBatch(null);
        setView('list');
        setInvoices([]);
      }
      await loadBatches();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkReviewed(batchId) {
    try {
      await invoiceBatchService.markReviewed(batchId);
      await loadBatches();
      const updated = await invoiceBatchService.getById(batchId);
      setSelectedBatch(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleExportCSV(batch) {
    try {
      const csv = exportToQuickBooksCSV(invoices, batch);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly_invoices_${batch.week_start}_to_${batch.week_end}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await invoiceBatchService.markExported(batch.id);
      await loadBatches();
      const updated = await invoiceBatchService.getById(batch.id);
      setSelectedBatch(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVoidInvoice(invoiceId) {
    try {
      await weeklyInvoiceService.update(invoiceId, { status: 'void' });
      await loadBatchDetail(selectedBatch.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnvoidInvoice(invoiceId) {
    try {
      await weeklyInvoiceService.update(invoiceId, { status: 'draft' });
      await loadBatchDetail(selectedBatch.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteLineItem(invoiceId, lineItemId) {
    try {
      await invoiceLineItemService.delete(lineItemId);
      await weeklyInvoiceService.recalculateTotal(invoiceId);
      await loadBatchDetail(selectedBatch.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddLineItem(invoiceId, facilityName, description, unitPrice, lineType) {
    try {
      const amount = Math.round(Number(unitPrice) * 100) / 100;
      await invoiceLineItemService.create({
        invoice_id: invoiceId,
        facility_name: facilityName,
        line_type: lineType || 'custom',
        description: description || `Custom charge \u2014 ${facilityName}`,
        quantity: 1,
        unit_price: amount,
        amount,
      });
      await weeklyInvoiceService.recalculateTotal(invoiceId);
      await loadBatchDetail(selectedBatch.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateLineItem(lineItemId, invoiceId, updates) {
    try {
      if (updates.unit_price !== undefined) {
        updates.amount =
          Math.round(Number(updates.unit_price) * 100) / 100;
      }
      await invoiceLineItemService.update(lineItemId, updates);
      await weeklyInvoiceService.recalculateTotal(invoiceId);
      await loadBatchDetail(selectedBatch.id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">Access Restricted</h2>
          <p className="text-slate-400 text-sm">Invoicing is restricted to Proximity admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Weekly Invoicing</h1>
            <p className="text-slate-400 text-sm">Generate weekly client invoices for QuickBooks</p>
          </div>
        </div>
        {view === 'detail' && (
          <button
            onClick={() => {
              setView('list');
              setSelectedBatch(null);
              setInvoices([]);
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white bg-slate-800/60 border border-slate-700/60 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Batches
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400/60 text-xs mt-1 hover:text-red-400"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {view === 'list' && (
        <BatchListView
          batches={batches}
          loading={loading}
          generating={generating}
          requisitionDate={requisitionDate}
          setRequisitionDate={setRequisitionDate}
          onGenerate={handleGenerate}
          onSelect={handleSelectBatch}
          onDelete={handleDeleteBatch}
          fmt={fmt}
          formatDate={formatDate}
        />
      )}

      {view === 'detail' && selectedBatch && (
        <BatchDetailView
          batch={batches.find((b) => b.id === selectedBatch.id) || selectedBatch}
          invoices={invoices}
          loading={loading}
          expandedInvoice={expandedInvoice}
          setExpandedInvoice={setExpandedInvoice}
          onExport={handleExportCSV}
          onMarkReviewed={handleMarkReviewed}
          onDeleteBatch={handleDeleteBatch}
          onVoidInvoice={handleVoidInvoice}
          onUnvoidInvoice={handleUnvoidInvoice}
          onDeleteLineItem={handleDeleteLineItem}
          onAddLineItem={handleAddLineItem}
          onUpdateLineItem={handleUpdateLineItem}
          fmt={fmt}
          formatDate={formatDate}
        />
      )}
    </div>
  );
}

function BatchListView({
  batches,
  loading,
  generating,
  requisitionDate,
  setRequisitionDate,
  onGenerate,
  onSelect,
  onDelete,
  fmt,
  formatDate,
}) {
  const weekStart = requisitionDate ? getWeekStart(requisitionDate) : null;
  const weekEnd = weekStart ? getWeekEnd(weekStart) : null;

  return (
    <div className="space-y-6">
      {/* Generation Panel */}
      <div className="p-6 bg-slate-800/60 border border-slate-700/60 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <Plus className="w-4 h-4 text-teal-400" />
          </div>
          <h2 className="text-white font-semibold">Generate New Batch</h2>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Select the requisition date. The system will calculate the billing week
          (Sunday\u2013Saturday) and generate one invoice per organization with
          line items for each billable facility.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 max-w-xs">
            <label className="block text-slate-400 text-xs font-medium mb-1.5">
              Requisition Date
            </label>
            <input
              type="date"
              value={requisitionDate}
              onChange={(e) => setRequisitionDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50 transition-colors"
            />
          </div>
          {weekStart && weekEnd && (
            <div className="px-4 py-2.5 bg-slate-900/40 border border-slate-700/40 rounded-lg">
              <p className="text-slate-400 text-xs">Billing Week</p>
              <p className="text-white text-sm font-medium">
                {formatDate(weekStart)} \u2013 {formatDate(weekEnd)}
              </p>
            </div>
          )}
          <button
            onClick={onGenerate}
            disabled={generating || !requisitionDate}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating\u2026
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Generate Invoices
              </>
            )}
          </button>
        </div>
      </div>

      {/* Batch History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-lg">Invoice Batches</h2>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mb-4">
              <Receipt className="w-7 h-7 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">No invoice batches yet. Generate your first batch above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="group p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:border-slate-600/60 transition-all cursor-pointer"
                onClick={() => onSelect(batch)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-700/60 border border-slate-600/40 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {batch.batch_number}
                      </p>
                      <p className="text-slate-400 text-xs">
                        Req: {formatDate(batch.requisition_date)} \u00b7 Week: {formatDate(batch.week_start)} \u2013 {formatDate(batch.week_end)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-white font-semibold text-sm">{fmt(batch.total_amount)}</p>
                      <p className="text-slate-400 text-xs">{batch.invoice_count} invoices \u00b7 {batch.facility_count} facilities</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${BATCH_STATUS_COLORS[batch.status] || BATCH_STATUS_COLORS.draft}`}>
                      {batch.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(batch.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BatchDetailView({
  batch,
  invoices,
  loading,
  expandedInvoice,
  setExpandedInvoice,
  onExport,
  onMarkReviewed,
  onDeleteBatch,
  onVoidInvoice,
  onUnvoidInvoice,
  onDeleteLineItem,
  onAddLineItem,
  onUpdateLineItem,
  fmt,
  formatDate,
}) {
  const activeInvoices = invoices.filter((i) => i.status !== 'void');
  const voidedInvoices = invoices.filter((i) => i.status === 'void');
  const totalAmount = activeInvoices.reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div className="space-y-5">
      {/* Batch Summary */}
      <div className="p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-lg">{batch.batch_number}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${BATCH_STATUS_COLORS[batch.status] || BATCH_STATUS_COLORS.draft}`}>
                {batch.status}
              </span>
            </div>
            <p className="text-slate-400 text-sm">
              Requisition: {formatDate(batch.requisition_date)} \u00b7 Billing Week: {formatDate(batch.week_start)} \u2013 {formatDate(batch.week_end)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {batch.status === 'draft' && (
              <button
                onClick={() => onMarkReviewed(batch.id)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Mark Reviewed
              </button>
            )}
            <button
              onClick={() => onExport(batch)}
              disabled={activeInvoices.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export QuickBooks CSV
            </button>
            <button
              onClick={() => onDeleteBatch(batch.id)}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <StatCard label="Total Amount" value={fmt(totalAmount)} icon={DollarSign} />
          <StatCard label="Invoices" value={activeInvoices.length} icon={Receipt} />
          <StatCard label="Facilities" value={batch.facility_count} icon={Building2} />
          <StatCard label="Voided" value={voidedInvoices.length} icon={EyeOff} />
        </div>
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : activeInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mb-4">
            <Receipt className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm">No invoices in this batch. The selected week may have no billable facilities.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              isExpanded={expandedInvoice === invoice.id}
              onToggle={() =>
                setExpandedInvoice(
                  expandedInvoice === invoice.id ? null : invoice.id
                )
              }
              onVoid={() => onVoidInvoice(invoice.id)}
              onDeleteLineItem={(lineId) =>
                onDeleteLineItem(invoice.id, lineId)
              }
              onAddLineItem={(name, desc, price, type) =>
                onAddLineItem(invoice.id, name, desc, price, type)
              }
              onUpdateLineItem={(lineId, updates) =>
                onUpdateLineItem(lineId, invoice.id, updates)
              }
              fmt={fmt}
              formatDate={formatDate}
            />
          ))}

          {voidedInvoices.length > 0 && (
            <div className="pt-4">
              <p className="text-slate-500 text-xs font-medium mb-2">Voided Invoices</p>
              <div className="space-y-2">
                {voidedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-slate-800/20 border border-slate-700/30 rounded-lg opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <EyeOff className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-400 text-sm">{inv.invoice_number}</span>
                      <span className="text-slate-500 text-xs">{inv.organizations?.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-sm">{fmt(inv.total_amount)}</span>
                      <button
                        onClick={() => onUnvoidInvoice(inv.id)}
                        className="text-slate-400 hover:text-white text-xs"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="p-3 bg-slate-900/40 border border-slate-700/40 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-400 text-xs">{label}</span>
      </div>
      <p className="text-white font-semibold text-lg">{value}</p>
    </div>
  );
}

function InvoiceCard({
  invoice,
  isExpanded,
  onToggle,
  onVoid,
  onDeleteLineItem,
  onAddLineItem,
  onUpdateLineItem,
  fmt,
  formatDate,
}) {
  const lines = invoice.weekly_invoice_line_items || [];
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLine, setNewLine] = useState({
    facility_name: '',
    description: '',
    unit_price: '',
    line_type: 'custom',
  });

  function handleAdd() {
    if (!newLine.facility_name || !newLine.unit_price) return;
    onAddLineItem(
      newLine.facility_name,
      newLine.description,
      Number(newLine.unit_price),
      newLine.line_type
    );
    setNewLine({ facility_name: '', description: '', unit_price: '', line_type: 'custom' });
    setShowAddLine(false);
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Collapsed Header */}
      <div
        className="flex items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-800/60 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
          )}
          <div className="w-9 h-9 rounded-lg bg-slate-700/60 border border-slate-600/40 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-slate-300" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">
              {invoice.qb_customer_name || invoice.organizations?.name}
            </p>
            <p className="text-slate-400 text-xs">
              {invoice.invoice_number} \u00b7 {lines.length} line items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-white font-semibold text-sm">{fmt(invoice.total_amount)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVoid();
            }}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            title="Void invoice"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="border-t border-slate-700/50 p-4 space-y-4">
          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-slate-700/50">
                  <th className="text-left font-medium py-2 px-2">Facility</th>
                  <th className="text-left font-medium py-2 px-2">Type</th>
                  <th className="text-left font-medium py-2 px-2">Description</th>
                  <th className="text-right font-medium py-2 px-2">Unit Price</th>
                  <th className="text-right font-medium py-2 px-2">Amount</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <LineItemRow
                    key={line.id}
                    line={line}
                    onDelete={() => onDeleteLineItem(line.id)}
                    onUpdate={(updates) => onUpdateLineItem(line.id, updates)}
                    fmt={fmt}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700/50">
                  <td colSpan="4" className="text-right py-2 px-2 text-slate-400 text-xs font-medium">
                    Total
                  </td>
                  <td className="text-right py-2 px-2 text-white font-semibold">
                    {fmt(invoice.total_amount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add Line Item */}
          {showAddLine ? (
            <div className="p-3 bg-slate-900/40 border border-slate-700/40 rounded-lg space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Facility name"
                  value={newLine.facility_name}
                  onChange={(e) =>
                    setNewLine({ ...newLine, facility_name: e.target.value })
                  }
                  className="px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                />
                <select
                  value={newLine.line_type}
                  onChange={(e) =>
                    setNewLine({ ...newLine, line_type: e.target.value })
                  }
                  className="px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                >
                  <option value="custom">Custom</option>
                  <option value="service_fee">Service Fee</option>
                  <option value="lis_saas_fee">LIS SaaS Fee</option>
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={newLine.description}
                  onChange={(e) =>
                    setNewLine({ ...newLine, description: e.target.value })
                  }
                  className="px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Unit price"
                  value={newLine.unit_price}
                  onChange={(e) =>
                    setNewLine({ ...newLine, unit_price: e.target.value })
                  }
                  className="px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
                <button
                  onClick={() => setShowAddLine(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddLine(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-teal-400 hover:text-teal-300 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LineItemRow({ line, onDelete, onUpdate, fmt }) {
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(String(line.unit_price));

  function saveEdit() {
    const newPrice = Number(editPrice);
    if (!isNaN(newPrice) && newPrice !== line.unit_price) {
      onUpdate({ unit_price: newPrice });
    }
    setEditing(false);
  }

  return (
    <tr className="border-b border-slate-700/30 hover:bg-slate-800/30">
      <td className="py-2 px-2 text-slate-200 text-sm">{line.facility_name}</td>
      <td className="py-2 px-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${LINE_TYPE_COLORS[line.line_type] || LINE_TYPE_COLORS.custom}`}>
          {line.line_type.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="py-2 px-2 text-slate-400 text-sm">{line.description}</td>
      <td className="py-2 px-2 text-right">
        {editing ? (
          <input
            type="number"
            step="0.01"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
            className="w-24 px-2 py-1 bg-slate-900/60 border border-slate-700/60 rounded text-white text-sm text-right focus:outline-none focus:border-teal-500/50"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-slate-300 text-sm hover:text-teal-400 transition-colors"
          >
            {fmt(line.unit_price)}
          </button>
        )}
      </td>
      <td className="py-2 px-2 text-right text-white text-sm font-medium">{fmt(line.amount)}</td>
      <td className="py-2 px-1">
        <button
          onClick={onDelete}
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
