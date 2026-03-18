import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, Search, ChevronDown, ChevronRight, FileText,
  CircleAlert as AlertCircle, X, Check, RefreshCw,
  ArrowRight, FileSpreadsheet, Info, CircleCheck as CheckCircle2,
  Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { qboInvoicesService, salesRepsService, commissionPeriodsService } from '../../services/commissionsService';
import { supabase } from '../../lib/supabase';

const STATUS_COLORS = {
  'Paid': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Unpaid': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Partially Paid': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Overdue': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Voided': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'Invoice': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseAmount(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function excelDateToISO(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    const month = String(d.m).padStart(2, '0');
    const day = String(d.d).padStart(2, '0');
    return `${d.y}-${month}-${day}`;
  }
  if (typeof val === 'string' && val.trim()) {
    const parts = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (parts) {
      const [, m, d, y] = parts;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return val;
  }
  return null;
}

function parseQBXlsx(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  let headerRowIdx = -1;
  const headerPatterns = ['transaction date', 'date', 'customer', 'amount'];

  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const row = raw[i];
    if (!row) continue;
    const cells = row.map(c => String(c ?? '').toLowerCase().trim());
    const matched = headerPatterns.filter(p => cells.some(c => c.includes(p)));
    if (matched.length >= 3) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { error: 'Could not detect the header row. Make sure this is a QuickBooks Sales Rep report.' };
  }

  const headers = raw[headerRowIdx].map(h => String(h ?? '').trim());

  const colIdx = (patterns) => {
    for (const p of patterns) {
      const idx = headers.findIndex(h => h.toLowerCase().includes(p.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const cols = {
    txn_date: colIdx(['transaction date', 'txn date', 'date']),
    rep: colIdx(['1099 rep', 'rep original', 'sales rep', 'rep']),
    num: colIdx(['num', 'invoice num', 'invoice no', 'number']),
    comm_paid: colIdx(['comm paid', 'comm', 'paid']),
    date: colIdx(['date']),
    due_date: colIdx(['due date']),
    txn_type: colIdx(['transaction type', 'type']),
    customer: colIdx(['customer']),
    product: colIdx(['product/service', 'product', 'service', 'item']),
    amount: colIdx(['amount']),
    sales_manager: colIdx(['sales manager', 'manager']),
  };

  if (cols.txn_date === -1 && cols.date === -1) {
    return { error: 'Could not find a date column in the report.' };
  }
  if (cols.amount === -1) {
    return { error: 'Could not find an Amount column in the report.' };
  }
  if (cols.customer === -1) {
    return { error: 'Could not find a Customer column in the report.' };
  }

  const dataRows = raw.slice(headerRowIdx + 1);
  const invoices = [];
  let currentMonth = null;

  for (const row of dataRows) {
    if (!row || row.every(c => c == null || String(c).trim() === '')) continue;

    const firstCell = String(row[0] ?? '').trim();
    const secondCell = String(row[1] ?? '').trim();

    if (firstCell && !secondCell && row.slice(1).every(c => c == null || String(c).trim() === '')) {
      currentMonth = firstCell;
      continue;
    }
    if (firstCell.toLowerCase().startsWith('total for') || firstCell.toLowerCase().startsWith('paid')) {
      continue;
    }

    const amount = parseAmount(cols.amount !== -1 ? row[cols.amount] : null);
    const customer = cols.customer !== -1 ? String(row[cols.customer] ?? '').trim() : '';
    const txnDate = cols.txn_date !== -1 ? row[cols.txn_date] : (cols.date !== -1 ? row[cols.date] : null);

    if (!customer && amount === 0) continue;
    if (!customer) continue;

    const invoiceDateISO = excelDateToISO(txnDate);
    const dueDateISO = cols.due_date !== -1 ? excelDateToISO(row[cols.due_date]) : null;
    const commDateISO = cols.date !== -1 && cols.date !== cols.txn_date ? excelDateToISO(row[cols.date]) : null;

    const num = cols.num !== -1 ? String(row[cols.num] ?? '').trim() : '';
    const rep = cols.rep !== -1 ? String(row[cols.rep] ?? '').trim() : '';
    const txnType = cols.txn_type !== -1 ? String(row[cols.txn_type] ?? '').trim() : 'Invoice';
    const product = cols.product !== -1 ? String(row[cols.product] ?? '').trim() : '';
    const salesManager = cols.sales_manager !== -1 ? String(row[cols.sales_manager] ?? '').trim() : '';
    const commPaid = cols.comm_paid !== -1 ? String(row[cols.comm_paid] ?? '').toLowerCase().trim() : '';

    invoices.push({
      invoice_number: num || `${customer}-${invoiceDateISO}`,
      customer_name: customer,
      invoice_date: invoiceDateISO,
      due_date: dueDateISO,
      total_amount: amount,
      balance: amount,
      status: txnType || 'Invoice',
      month_group: currentMonth,
      rep_name: rep,
      product_service: product,
      sales_manager: salesManager,
      comm_paid: commPaid === 'yes',
    });
  }

  return { invoices, headers, cols };
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
  const [parsedData, setParsedData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [parseError, setParseError] = useState(null);

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
    setParseError(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const result = parseQBXlsx(workbook);

        if (result.error) {
          setParseError(result.error);
          return;
        }
        if (!result.invoices.length) {
          setParseError('No invoice rows found in the file. Make sure this is a 1099 Sales Rep Report exported from QuickBooks.');
          return;
        }
        setParsedData({ filename: file.name, ...result });
      } catch (err) {
        setParseError(`Failed to read file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function resolveOrCreatePeriod(isoDate, periodCache) {
    if (!isoDate) return null;
    const d = new Date(isoDate + 'T00:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${month}`;
    if (periodCache[key]) return periodCache[key];

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const name = `${monthNames[month]} ${year}`;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    const { data: existing } = await supabase
      .from('commission_periods')
      .select('id')
      .eq('start_date', startDate)
      .maybeSingle();

    if (existing) {
      periodCache[key] = existing.id;
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from('commission_periods')
      .insert({ name, start_date: startDate, end_date: endDate })
      .select('id')
      .single();
    if (error) throw error;
    periodCache[key] = created.id;
    return created.id;
  }

  async function handleImport() {
    if (!parsedData?.invoices?.length) return;
    setImporting(true);
    setParseError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: allReps } = await supabase.from('sales_reps').select('id, name');
      const repByName = {};
      (allReps || []).forEach(r => {
        repByName[r.name.trim().toLowerCase()] = r.id;
      });

      const periodCache = {};

      const { data: batch, error: batchError } = await supabase
        .from('qb_import_batches')
        .insert({
          filename: parsedData.filename,
          imported_by: user?.id,
          row_count: parsedData.invoices.length,
          status: 'Success',
          notes: `QB 1099 Sales Rep Report — ${parsedData.invoices.length} line items`,
        })
        .select()
        .single();
      if (batchError) throw batchError;

      const VALID_STATUSES = ['Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Voided'];

      const toInsert = await Promise.all(parsedData.invoices.map(async (inv, i) => {
        const rawStatus = inv.status || '';
        const status = VALID_STATUSES.includes(rawStatus)
          ? rawStatus
          : inv.comm_paid ? 'Paid' : 'Unpaid';

        const repId = inv.rep_name
          ? (repByName[inv.rep_name.trim().toLowerCase()] ?? null)
          : null;

        const periodId = await resolveOrCreatePeriod(inv.invoice_date, periodCache);

        return {
          qbo_invoice_id: `${batch.id}-${i}-${inv.invoice_number}`,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          customer_email: null,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          total_amount: inv.total_amount,
          balance: inv.balance,
          status,
          import_batch_id: batch.id,
          sales_rep_id: repId,
          commission_period_id: periodId,
        };
      }));

      const { error: invError } = await supabase
        .from('qbo_invoices')
        .insert(toInsert);
      if (invError) throw invError;

      setImportResult({ count: toInsert.length, filename: parsedData.filename });
      setParsedData(null);
      await loadAll();
    } catch (err) {
      setParseError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function resetUpload() {
    setParsedData(null);
    setImportResult(null);
    setParseError(null);
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

  const monthGroups = parsedData?.invoices
    ? [...new Set(parsedData.invoices.map(i => i.month_group).filter(Boolean))]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">QB Invoices</h2>
          <p className="text-sm text-slate-400">{filtered.length} invoices · {fmt(totalFiltered)} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowUpload(v => !v); resetUpload(); }}
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
              Import QuickBooks 1099 Sales Rep Report
            </h3>
            <button onClick={() => { setShowUpload(false); resetUpload(); }} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              In QuickBooks, run the <strong>1099 Sales Rep Report</strong> and export it as <strong>Excel (.xlsx)</strong>. Upload the file here — the system will automatically detect the grouped rows, skip subtotals, and import each line item.
            </div>
          </div>

          {importResult ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Import Successful</p>
                <p className="text-slate-400 text-sm mt-1">
                  <span className="text-teal-400 font-medium">{importResult.count}</span> line items imported from <span className="text-slate-300">{importResult.filename}</span>
                </p>
              </div>
              <button
                onClick={() => { resetUpload(); setShowUpload(false); }}
                className="mt-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          ) : !parsedData ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragOver ? 'border-teal-400 bg-teal-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileDrop} />
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-slate-500" />
              <p className="text-white font-medium mb-1">Drop your QB Excel report here</p>
              <p className="text-slate-500 text-sm">or click to browse — .xlsx files only</p>
              {parseError && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-left">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{parseError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{parsedData.filename}</p>
                    <p className="text-slate-500 text-xs">
                      {parsedData.invoices.length} line items
                      {monthGroups.length > 0 && ` · ${monthGroups.length} month group${monthGroups.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <button onClick={resetUpload} className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
                  <X className="w-3.5 h-3.5" /> Change file
                </button>
              </div>

              {monthGroups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {monthGroups.map(m => (
                    <span key={m} className="px-2.5 py-1 bg-slate-700/50 border border-slate-600/50 rounded-full text-xs text-slate-300 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-teal-400" />{m}
                    </span>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr className="bg-slate-700/50">
                      <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Month</th>
                      <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Date</th>
                      <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Customer</th>
                      <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Product/Service</th>
                      <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Rep</th>
                      <th className="px-3 py-2.5 text-left text-slate-400 font-medium">Type</th>
                      <th className="px-3 py-2.5 text-right text-slate-400 font-medium">Amount</th>
                      <th className="px-3 py-2.5 text-center text-slate-400 font-medium">Comm Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.invoices.slice(0, 10).map((inv, i) => (
                      <tr key={i} className="border-t border-slate-700/40 hover:bg-slate-700/20">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{inv.month_group || '—'}</td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatDate(inv.invoice_date)}</td>
                        <td className="px-3 py-2 text-slate-200 whitespace-nowrap max-w-40 truncate">{inv.customer_name}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap max-w-40 truncate">{inv.product_service || '—'}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{inv.rep_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{inv.status}</td>
                        <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${inv.total_amount < 0 ? 'text-red-400' : 'text-white'}`}>{fmt(inv.total_amount)}</td>
                        <td className="px-3 py-2 text-center">
                          {inv.comm_paid ? <Check className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                    {parsedData.invoices.length > 10 && (
                      <tr className="border-t border-slate-700/40">
                        <td colSpan={8} className="px-3 py-2 text-center text-slate-500 italic">
                          ... and {parsedData.invoices.length - 10} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {parseError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{parseError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  <span className="text-white font-medium">{parsedData.invoices.length}</span> line items will be imported.
                  You can assign sales reps and commission periods after import.
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={resetUpload} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-2 px-5 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {importing ? 'Importing...' : `Import ${parsedData.invoices.length} Items`}
                  </button>
                </div>
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
          {['Invoice', 'Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Voided'].map(s => <option key={s}>{s}</option>)}
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
          <p className="text-sm mt-1">Import a QuickBooks 1099 Sales Rep Report to get started.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
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
                    <p className="text-slate-500 text-xs">{inv.invoice_number}</p>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[inv.status] || STATUS_COLORS['Invoice']}`}>
                      {inv.status || 'Invoice'}
                    </span>
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${(inv.total_amount ?? 0) < 0 ? 'text-red-400' : 'text-white'}`}>{fmt(inv.total_amount)}</p>
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
                      <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Due Date</label>
                      <p className="text-sm text-slate-300 pt-2">{formatDate(inv.due_date)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Invoice Total</p>
                      <p className={`font-semibold mt-0.5 ${(inv.total_amount ?? 0) < 0 ? 'text-red-400' : 'text-white'}`}>{fmt(inv.total_amount)}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Balance Due</p>
                      <p className="text-white font-semibold mt-0.5">{fmt(inv.balance)}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase">Period</p>
                      <p className="text-white font-semibold mt-0.5 text-sm truncate">{inv.commission_periods?.name || '—'}</p>
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
