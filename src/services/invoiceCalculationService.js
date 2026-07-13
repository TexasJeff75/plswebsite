import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

const WEEKS_PER_MONTH = 4.345;

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function formatMMDDYY(dateStr) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}${dd}${yy}`;
}

function deriveOrgCode(name) {
  const cleaned = name.replace(/[^A-Za-z0-9]/g, '');
  return cleaned.substring(0, 4).toUpperCase();
}

function weeklyRate(monthlyFee) {
  return Math.round((Number(monthlyFee) / WEEKS_PER_MONTH) * 100) / 100;
}

function parseDate(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    return new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

/**
 * Parse a lab data export Excel file.
 * Expected columns: Test Method, Accession #, Requisition Date, ...
 * Returns an array of records: { testMethod, accessionNumber, requisitionDate (ISO date string) }
 */
export function parseLabDataFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
          raw: true,
        });

        if (raw.length === 0) {
          reject(new Error('File is empty.'));
          return;
        }

        const header = raw[0].map((h) => String(h ?? '').trim().toLowerCase());
        const tmIdx = header.findIndex((h) => h.includes('test method'));
        const accIdx = header.findIndex((h) => h.includes('accession'));
        const reqIdx = header.findIndex(
          (h) => h.includes('requisition date') || h === 'requisition date'
        );

        if (tmIdx === -1 || reqIdx === -1) {
          reject(
            new Error(
              'Could not find required columns. Expected "Test Method" and "Requisition Date".'
            )
          );
          return;
        }

        const records = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || !row[tmIdx]) continue;
          const parsed = parseDate(row[reqIdx]);
          if (!parsed) continue;
          records.push({
            testMethod: String(row[tmIdx]).trim(),
            accessionNumber: accIdx !== -1 ? String(row[accIdx] ?? '').trim() : '',
            requisitionDate: parsed.toISOString().split('T')[0],
          });
        }

        resolve(records);
      } catch (err) {
        reject(new Error(`Failed to parse file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Group records by week and test method, counting tests per group.
 * Returns: { weeks: [{ weekStart, weekEnd, methods: [{ testMethod, count }] }], orgCode }
 */
export function groupRecordsByWeek(records) {
  const weekMap = {};

  for (const rec of records) {
    const ws = getWeekStart(rec.requisitionDate);
    if (!weekMap[ws]) weekMap[ws] = {};
    const key = rec.testMethod;
    weekMap[ws][key] = (weekMap[ws][key] || 0) + 1;
  }

  const weeks = Object.keys(weekMap)
    .sort()
    .map((ws) => ({
      weekStart: ws,
      weekEnd: getWeekEnd(ws),
      methods: Object.entries(weekMap[ws])
        .map(([testMethod, count]) => ({ testMethod, count }))
        .sort((a, b) => b.count - a.count),
    }));

  return weeks;
}

export const testMethodRateService = {
  async getAll() {
    const { data, error } = await supabase
      .from('test_method_rates')
      .select('*')
      .order('test_method');
    if (error) throw error;
    return data;
  },

  async upsert(rate) {
    const { data, error } = await supabase
      .from('test_method_rates')
      .upsert(
        {
          test_method: rate.test_method,
          rate: rate.rate,
          description: rate.description || '',
          is_active: rate.is_active ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'test_method' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('test_method_rates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('test_method_rates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const invoiceBatchService = {
  async getAll() {
    const { data, error } = await supabase
      .from('weekly_invoice_batches')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('weekly_invoice_batches')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(requisitionDate, createdBy, sourceFileName) {
    const weekStart = getWeekStart(requisitionDate);
    const weekEnd = getWeekEnd(weekStart);
    const { data, error } = await supabase
      .from('weekly_invoice_batches')
      .insert({
        requisition_date: requisitionDate,
        week_start: weekStart,
        week_end: weekEnd,
        created_by: createdBy,
        notes: sourceFileName ? `Source: ${sourceFileName}` : '',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('weekly_invoice_batches')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('weekly_invoice_batches')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async markExported(id) {
    const { data, error } = await supabase
      .from('weekly_invoice_batches')
      .update({
        status: 'exported',
        exported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markReviewed(id) {
    const { data, error } = await supabase
      .from('weekly_invoice_batches')
      .update({
        status: 'reviewed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Generate invoices from parsed lab data for a specific week.
   * Creates one invoice per organization, with line items per test method.
   *
   * @param {string} batchId - The batch ID
   * @param {string} requisitionDate - The requisition date (ISO)
   * @param {Array} weekRecords - Records for this week: [{ testMethod, accessionNumber, requisitionDate }]
   * @param {string} sourceFileName - The uploaded file name
   * @param {string} organizationId - The organization to invoice
   * @param {string} orgName - Organization name (for invoice number)
   * @param {Object} rateMap - { testMethod: rate } lookup
   */
  async generateInvoicesFromData(
    batchId,
    requisitionDate,
    weekRecords,
    sourceFileName,
    organizationId,
    orgName,
    rateMap
  ) {
    const weekStart = getWeekStart(requisitionDate);
    const weekEnd = getWeekEnd(weekStart);
    const dateStr = formatMMDDYY(requisitionDate);
    const orgCode = deriveOrgCode(orgName);
    const invoiceNumber = `${orgCode}-${dateStr}`;

    // Check for existing invoice in this batch
    const { data: existing } = await supabase
      .from('weekly_invoices')
      .select('id')
      .eq('batch_id', batchId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (existing) {
      return { invoiceId: existing.id, totalAmount: 0, lineCount: 0, skipped: true };
    }

    // Count tests by method
    const methodCounts = {};
    for (const rec of weekRecords) {
      const key = rec.testMethod;
      methodCounts[key] = (methodCounts[key] || 0) + 1;
    }

    // Create the invoice
    const { data: invoice, error: invError } = await supabase
      .from('weekly_invoices')
      .insert({
        batch_id: batchId,
        organization_id: organizationId,
        invoice_number: invoiceNumber,
        requisition_date: requisitionDate,
        week_start: weekStart,
        week_end: weekEnd,
        qb_customer_name: orgName,
        status: 'draft',
      })
      .select()
      .single();
    if (invError) throw invError;

    // Create line items per test method
    let invoiceTotal = 0;
    let lineCount = 0;
    const methods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);

    for (const [testMethod, count] of methods) {
      const rate = rateMap[testMethod] ?? 0;
      const amount = Math.round(count * rate * 100) / 100;

      const { error: liError } = await supabase
        .from('weekly_invoice_line_items')
        .insert({
          invoice_id: invoice.id,
          facility_name: testMethod,
          line_type: 'test_fee',
          description: `${testMethod} (${count} tests @ ${rate.toFixed(2)}/test)`,
          quantity: count,
          unit_price: rate,
          amount,
          test_count: count,
          source_file: sourceFileName,
        });
      if (liError) throw liError;

      invoiceTotal += amount;
      lineCount++;
    }

    invoiceTotal = Math.round(invoiceTotal * 100) / 100;

    // Update invoice total
    const { error: updError } = await supabase
      .from('weekly_invoices')
      .update({ total_amount: invoiceTotal, line_count: lineCount })
      .eq('id', invoice.id);
    if (updError) throw updError;

    return { invoiceId: invoice.id, totalAmount: invoiceTotal, lineCount };
  },

  async recalculateBatchTotals(batchId) {
    const { data: invoices, error } = await supabase
      .from('weekly_invoices')
      .select('id, total_amount, status')
      .eq('batch_id', batchId);
    if (error) throw error;

    const activeInvoices = invoices.filter((i) => i.status !== 'void');
    const totalAmount = Math.round(
      activeInvoices.reduce((s, i) => s + Number(i.total_amount), 0) * 100
    ) / 100;

    const { error: batchUpdError } = await supabase
      .from('weekly_invoice_batches')
      .update({
        total_amount: totalAmount,
        invoice_count: activeInvoices.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);
    if (batchUpdError) throw batchUpdError;

    return { totalAmount, invoiceCount: activeInvoices.length };
  },
};

export const weeklyInvoiceService = {
  async getByBatch(batchId) {
    const { data, error } = await supabase
      .from('weekly_invoices')
      .select('*, organizations(id, name), weekly_invoice_line_items(*)')
      .eq('batch_id', batchId)
      .order('invoice_number');
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('weekly_invoices')
      .select('*, organizations(id, name), weekly_invoice_line_items(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('weekly_invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('weekly_invoices')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async recalculateTotal(invoiceId) {
    const { data: items, error } = await supabase
      .from('weekly_invoice_line_items')
      .select('amount')
      .eq('invoice_id', invoiceId);
    if (error) throw error;

    const total = Math.round(
      items.reduce((sum, item) => sum + Number(item.amount), 0) * 100
    ) / 100;

    const { data: updated, error: updError } = await supabase
      .from('weekly_invoices')
      .update({
        total_amount: total,
        line_count: items.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single();
    if (updError) throw updError;
    return updated;
  },
};

export const invoiceLineItemService = {
  async create(item) {
    const { data, error } = await supabase
      .from('weekly_invoice_line_items')
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('weekly_invoice_line_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('weekly_invoice_line_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export function exportToQuickBooksCSV(invoices, batch) {
  const rows = [];

  rows.push([
    'Invoice No',
    'Customer',
    'Invoice Date',
    'Due Date',
    'Item',
    'Description',
    'Quantity',
    'Rate',
    'Amount',
  ]);

  for (const inv of invoices) {
    if (inv.status === 'void') continue;
    const lines = inv.weekly_invoice_line_items || [];
    for (const line of lines) {
      rows.push([
        inv.invoice_number,
        inv.qb_customer_name || inv.organizations?.name || '',
        batch.requisition_date,
        batch.week_end,
        line.facility_name || '',
        line.description || '',
        String(line.quantity),
        String(line.unit_price),
        String(line.amount),
      ]);
    }
  }

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const c = String(cell ?? '');
          if (c.includes(',') || c.includes('"') || c.includes('\n')) {
            return `"${c.replace(/"/g, '""')}"`;
          }
          return c;
        })
        .join(',')
    )
    .join('\n');
}

export {
  getWeekStart,
  getWeekEnd,
  weeklyRate,
  formatMMDDYY,
  deriveOrgCode,
};
