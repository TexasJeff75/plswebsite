import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Search, ChevronDown, ChevronRight, FileText, DollarSign, CircleAlert as AlertCircle, X, Check, RefreshCw, Download, Trash2, ArrowRight, FileSpreadsheet, Info, CircleCheck as CheckCircle2 } from 'lucide-react';
import { qboInvoicesService, salesRepsService, commissionPeriodsService } from '../../services/commissionsService';
import { supabase } from '../../lib/supabase';

const STATUS_COLORS = {
  'Paid': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Unpaid': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Partially Paid': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Overdue': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Voided': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const QBO_FIELD_OPTIONS = [
  { value: '', label: '— Skip this column —' },
  { value: 'invoice_number', label: 'Invoice Number *', required: true },
  { value: 'customer_name', label: 'Customer Name *', required: true },
  { value: 'invoice_date', label: 'Invoice Date *', required: true },
  { value: 'total_amount', label: 'Total Amount *', required: true },
  { value: 'balance', label: 'Balance Due' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'status', label: 'Status' },
  { value: 'customer_email', label: 'Customer Email' },
  { value: 'qbo_invoice_id', label: 'QB Invoice ID / Ref' },
];

const REQUIRED_FIELDS = ['invoice_number', 'customer_name', 'invoice_date', 'total_amount'];

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseAmount(str) {
  if (str == null || str === '') return 0;
  const cleaned = String(str).replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

function autoMapColumns(headers) {
  const mapping = {};
  const matchers = {
    invoice_number: [/invoice.*(no|num|number|#)/i, /^invoice$/i, /^inv.*(no|#)/i],
    customer_name: [/customer.*(name)?/i, /client.*(name)?/i, /^name$/i],
    invoice_date: [/invoice.*date/i, /^date$/i, /^inv.*date/i],
    total_amount: [/total.*(amount)?/i, /amount.*(total)?/i, /^amount$/i, /^total$/i],
    balance: [/balance/i, /amount.*(due|owed)/i],
    due_date: [/due.*date/i],
    status: [/^status$/i, /payment.*status/i],
    customer_email: [/email/i],
    qbo_invoice_id: [/qbo.*id/i, /quickbooks.*id/i, /ref.*no/i],
  };

  headers.forEach((header, idx) => {
    for (const [field, patterns] of Object.entries(matchers)) {
      if (patterns.some(p => p.test(header)) && !Object.values(mapping).includes(field)) {
        mapping[idx] = field;
        break;
      }
    }
    if (mapping[idx] == null) mapping[idx] = '';
  });
  return mapping;
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
  const [assigning, setAssigning] = useState({});

  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsedFile, setParsedFile] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fileInputRef = useRef(null);

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
    setAssigning(prev => ({ ...prev, [`rep_${invoiceId}`]: true }));
    try {
      await qboInvoicesService.assignSalesRep(invoiceId, repId || null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigning(prev => ({ ...prev, [`rep_${invoiceId}`]: false }));
    }
  }

  async function handleAssignPeriod(invoiceId, periodId) {
    setAssigning(prev => ({ ...prev, [`period_${invoiceId}`]: true }));
    try {
      await qboInvoicesService.assignPeriod(invoiceId, periodId || null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigning(prev => ({ ...prev, [`period_${invoiceId}`]: false }));
    }
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) processFile(file);
  }

  function processFile(file) {
    setImportResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, rows } = parseCSV(text);
      if (!headers.length) {
        setError('Could not parse the file. Make sure it is a valid CSV with headers.');
        return;
      }
      const mapping = autoMapColumns(headers);
      setParsedFile({ filename: file.name, headers, rows, preview: rows.slice(0, 5) });
      setColumnMapping(mapping);
    };
    reader.readAsText(file);
  }

  function getMappedValue(row, fieldName) {
    const colIdx = Object.entries(columnMapping).find(([, f]) => f === fieldName)?.[0];
    return colIdx != null ? row[parseInt(colIdx)] : undefined;
  }

  const mappedRequiredFields = REQUIRED_FIELDS.filter(f =>
    Object.values(columnMapping).includes(f)
  );
  const missingRequired = REQUIRED_FIELDS.filter(f => !Object.values(columnMapping).includes(f));
  const canImport = missingRequired.length === 0 && parsedFile?.rows?.length > 0;

  async function handleImport() {
    if (!canImport) return;
    setImporting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: batch, error: batchError } = await supabase
        .from('qb_import_batches')
        .insert({
          filename: parsedFile.filename,
          imported_by: user?.id,
          row_count: parsedFile.rows.length,
          status: 'Success',
        })
        .select()
        .single();
      if (batchError) throw batchError;

      const invoicesToInsert = parsedFile.rows
        .filter(row => row.some(cell => cell?.trim()))
        .map(row => ({
          qbo_invoice_id: getMappedValue(row, 'qbo_invoice_id') || `import-${batch.id}-${Math.random().toString(36).slice(2)}`,
          invoice_number: getMappedValue(row, 'invoice_number') || '',
          customer_name: getMappedValue(row, 'customer_name') || '',
          customer_email: getMappedValue(row, 'customer_email') || null,
          invoice_date: getMappedValue(row, 'invoice_date') || null,
          total_amount: parseAmount(getMappedValue(row, 'total_amount')),
          balance: parseAmount(getMappedValue(row, 'balance')),
          due_date: getMappedValue(row, 'due_date') || null,
          status: getMappedValue(row, 'status') || 'Unpaid',
          import_batch_id: batch.id,
        }));

      const { error: invError } = await supabase
        .from('qbo_invoices')
        .upsert(invoicesToInsert, { onConflict: 'qbo_invoice_id' });
      if (invError) throw invError;

      setImportResult({ count: invoicesToInsert.length, batchId: batch.id });
      setParsedFile(null);
      setColumnMapping({});
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function resetUpload() {
    setParsedFile(null);
    setColumnMapping({});
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
          <h2 className="text-lg font-semibold text-white">QB Invoices</h2>
          <p className="text-sm text-slate-400">{filtered.length} invoices · {fmt(totalFiltered)} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowUpload(v => !v); setImportResult(null); }}
            className="flex items-center gap-2 px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import QB Report
          </button>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="bg-slate-800/90 border border-slate-600/60 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-400" />
              Import QuickBooks Report
            </h3>
            <button onClick={() => { setShowUpload(false); resetUpload(); }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Export an <strong>Invoice</strong> report from QuickBooks (CSV format) and upload it here. The system will auto-detect column headers and let you map them before importing.
            </div>
          </div>

          {importResult ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Import Successful</p>
                <p className="text-slate-400 text-sm mt-1">{importResult.count} invoices imported from <span className="text-teal-400">{parsedFile?.filename || 'report'}</span></p>
              </div>
              <button
                onClick={() => { resetUpload(); setShowUpload(false); }}
                className="mt-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          ) : !parsedFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? 'border-teal-400 bg-teal-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileDrop} />
              <Upload className="w-10 h-10 mx-auto mb-3 text-slate-500" />
              <p className="text-white font-medium mb-1">Drop your QB report CSV here</p>
              <p className="text-slate-500 text-sm">or click to browse — CSV files only</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{parsedFile.filename}</p>
                    <p className="text-slate-500 text-xs">{parsedFile.rows.length} rows · {parsedFile.headers.length} columns detected</p>
                  </div>
                </div>
                <button onClick={resetUpload} className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
                  <X className="w-3.5 h-3.5" /> Change file
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-300">Map Columns</p>
                  {missingRequired.length > 0 ? (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missing: {missingRequired.map(f => QBO_FIELD_OPTIONS.find(o => o.value === f)?.label.replace(' *', '')).join(', ')}
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> All required fields mapped
                    </span>
                  )}
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {parsedFile.headers.map((header, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-700/40 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 truncate font-mono">{header}</p>
                        {parsedFile.preview[0]?.[idx] && (
                          <p className="text-xs text-slate-600 truncate mt-0.5 italic">{parsedFile.preview[0][idx]}</p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <select
                        value={columnMapping[idx] ?? ''}
                        onChange={e => setColumnMapping(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors w-52 flex-shrink-0"
                      >
                        {QBO_FIELD_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {parsedFile.preview.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Preview (first {parsedFile.preview.length} rows)</p>
                  <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-700/50">
                          {parsedFile.headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedFile.preview.map((row, ri) => (
                          <tr key={ri} className="border-t border-slate-700/40 hover:bg-slate-700/20">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 text-slate-300 whitespace-nowrap max-w-32 truncate">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700">
                <button onClick={resetUpload} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
                <button
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="flex items-center gap-2 px-5 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Importing...' : `Import ${parsedFile.rows.length} Invoices`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && !showUpload && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
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
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No invoices found</p>
          <p className="text-sm mt-1">Import a QuickBooks report to get started.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors mx-auto"
          >
            <Upload className="w-4 h-4" /> Import QB Report
          </button>
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
                      {inv.status || 'Unpaid'}
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
                        disabled={assigning[`rep_${inv.id}`]}
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
                        disabled={assigning[`period_${inv.id}`]}
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
