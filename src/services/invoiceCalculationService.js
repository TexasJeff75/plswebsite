import { supabase } from '../lib/supabase';

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

  async create(requisitionDate, createdBy) {
    const weekStart = getWeekStart(requisitionDate);
    const weekEnd = getWeekEnd(weekStart);
    const { data, error } = await supabase
      .from('weekly_invoice_batches')
      .insert({
        requisition_date: requisitionDate,
        week_start: weekStart,
        week_end: weekEnd,
        created_by: createdBy,
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

  async generateInvoices(batchId, requisitionDate) {
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, type, contact_email')
      .eq('type', 'customer')
      .order('name');
    if (orgError) throw orgError;

    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length === 0) return { invoiceCount: 0, facilityCount: 0, totalAmount: 0 };

    const { data: facilities, error: facError } = await supabase
      .from('facilities')
      .select('id, name, organization_id, monthly_service_fee, monthly_lis_saas_fee, service_fee_start_date, site_configuration, overall_status')
      .in('organization_id', orgIds)
      .order('name');
    if (facError) throw facError;

    const weekStart = getWeekStart(requisitionDate);
    const weekEnd = getWeekEnd(weekStart);
    const dateStr = formatMMDDYY(requisitionDate);

    let totalAmount = 0;
    let facilityCount = 0;
    let invoiceCount = 0;

    for (const org of orgs) {
      const orgFacilities = facilities.filter(
        (f) =>
          f.organization_id === org.id &&
          f.service_fee_start_date &&
          f.service_fee_start_date <= requisitionDate &&
          f.overall_status !== 'cancelled'
      );

      if (orgFacilities.length === 0) continue;

      const orgCode = deriveOrgCode(org.name);
      const invoiceNumber = `${orgCode}-${dateStr}`;

      const { data: existing } = await supabase
        .from('weekly_invoices')
        .select('id')
        .eq('batch_id', batchId)
        .eq('organization_id', org.id)
        .maybeSingle();
      if (existing) continue;

      const { data: invoice, error: invError } = await supabase
        .from('weekly_invoices')
        .insert({
          batch_id: batchId,
          organization_id: org.id,
          invoice_number: invoiceNumber,
          requisition_date: requisitionDate,
          week_start: weekStart,
          week_end: weekEnd,
          qb_customer_name: org.name,
          status: 'draft',
        })
        .select()
        .single();
      if (invError) throw invError;

      let invoiceTotal = 0;
      for (const fac of orgFacilities) {
        const serviceFee = Number(fac.monthly_service_fee) || 0;
        const lisFee = Number(fac.monthly_lis_saas_fee) || 0;

        if (serviceFee > 0) {
          const weeklyService = weeklyRate(serviceFee);
          const { error: liError } = await supabase
            .from('weekly_invoice_line_items')
            .insert({
              invoice_id: invoice.id,
              facility_id: fac.id,
              facility_name: fac.name,
              line_type: 'service_fee',
              description: `Weekly service fee — ${fac.name}`,
              quantity: 1,
              unit_price: weeklyService,
              amount: weeklyService,
            });
          if (liError) throw liError;
          invoiceTotal += weeklyService;
          facilityCount++;
        }

        if (lisFee > 0) {
          const weeklyLis = weeklyRate(lisFee);
          const { error: liError } = await supabase
            .from('weekly_invoice_line_items')
            .insert({
              invoice_id: invoice.id,
              facility_id: fac.id,
              facility_name: fac.name,
              line_type: 'lis_saas_fee',
              description: `Weekly LIS SaaS fee — ${fac.name}`,
              quantity: 1,
              unit_price: weeklyLis,
              amount: weeklyLis,
            });
          if (liError) throw liError;
          invoiceTotal += weeklyLis;
        }
      }

      invoiceTotal = Math.round(invoiceTotal * 100) / 100;
      const { error: updError } = await supabase
        .from('weekly_invoices')
        .update({ total_amount: invoiceTotal, line_count: orgFacilities.length })
        .eq('id', invoice.id);
      if (updError) throw updError;

      totalAmount += invoiceTotal;
      invoiceCount++;
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    const { error: batchUpdError } = await supabase
      .from('weekly_invoice_batches')
      .update({
        total_amount: totalAmount,
        invoice_count: invoiceCount,
        facility_count: facilityCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId);
    if (batchUpdError) throw batchUpdError;

    return { invoiceCount, facilityCount, totalAmount };
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
      .update({ total_amount: total, line_count: items.length, updated_at: new Date().toISOString() })
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
    'Line Description',
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

export { getWeekStart, getWeekEnd, weeklyRate, formatMMDDYY, deriveOrgCode };
