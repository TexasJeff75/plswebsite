import { supabase } from '../lib/supabase';

export const salesRepsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('sales_reps')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('sales_reps')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(rep) {
    const { data, error } = await supabase
      .from('sales_reps')
      .insert(rep)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('sales_reps')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('sales_reps')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export const commissionRulesService = {
  async getAll(salesRepId = null) {
    let query = supabase
      .from('commission_rules')
      .select('*, sales_reps(name, email)')
      .order('priority', { ascending: false });
    if (salesRepId) query = query.eq('sales_rep_id', salesRepId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async create(rule) {
    const { data, error } = await supabase
      .from('commission_rules')
      .insert(rule)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('commission_rules')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('commission_rules')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

export const commissionPeriodsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('commission_periods')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(period) {
    const { data, error } = await supabase
      .from('commission_periods')
      .insert(period)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('commission_periods')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const qboInvoicesService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('qbo_invoices')
      .select(`
        *,
        sales_reps(id, name, email),
        commission_periods(id, name)
      `)
      .order('invoice_date', { ascending: false });

    if (filters.salesRepId) query = query.eq('sales_rep_id', filters.salesRepId);
    if (filters.periodId) query = query.eq('commission_period_id', filters.periodId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dateFrom) query = query.gte('invoice_date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('invoice_date', filters.dateTo);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('qbo_invoices')
      .select(`
        *,
        sales_reps(id, name, email),
        qbo_invoice_line_items(*),
        commission_calculations(*)
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async assignSalesRep(invoiceId, salesRepId) {
    const { data, error } = await supabase
      .from('qbo_invoices')
      .update({ sales_rep_id: salesRepId, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async assignPeriod(invoiceId, periodId) {
    const { data, error } = await supabase
      .from('qbo_invoices')
      .update({ commission_period_id: periodId, updated_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const commissionCalculationsService = {
  async calculateForInvoice(invoice, salesRep, rules) {
    const applicableRule = rules
      .filter(r => r.is_active && (!r.sales_rep_id || r.sales_rep_id === salesRep.id))
      .sort((a, b) => b.priority - a.priority)[0];

    const rate = applicableRule?.commission_rate ?? salesRep.default_commission_rate;
    const commissionableAmount = invoice.total_amount;
    const commissionAmount = parseFloat((commissionableAmount * rate).toFixed(2));

    return {
      invoice_id: invoice.id,
      sales_rep_id: salesRep.id,
      commission_rule_id: applicableRule?.id ?? null,
      commission_period_id: invoice.commission_period_id,
      commissionable_amount: commissionableAmount,
      commission_rate: rate,
      commission_amount: commissionAmount,
      status: 'Calculated'
    };
  },

  async saveCalculation(calc) {
    const { data, error } = await supabase
      .from('commission_calculations')
      .upsert(calc, { onConflict: 'invoice_id,sales_rep_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getForPeriod(periodId, salesRepId) {
    let query = supabase
      .from('commission_calculations')
      .select(`
        *,
        qbo_invoices(invoice_number, customer_name, invoice_date, total_amount, status),
        commission_rules(name, rule_type)
      `)
      .eq('commission_period_id', periodId);
    if (salesRepId) query = query.eq('sales_rep_id', salesRepId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
};

export const commissionReportsService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('commission_reports')
      .select(`
        *,
        sales_reps(id, name, email),
        commission_periods(id, name)
      `)
      .order('created_at', { ascending: false });

    if (filters.salesRepId) query = query.eq('sales_rep_id', filters.salesRepId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.periodId) query = query.eq('commission_period_id', filters.periodId);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('commission_reports')
      .select(`
        *,
        sales_reps(*),
        commission_periods(*),
        commission_report_items(
          *,
          qbo_invoices(invoice_number, customer_name, invoice_date, total_amount, status)
        )
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async generateReport(salesRepId, periodId, calculations) {
    const period = calculations[0]?.commission_periods;
    const totalInvoices = calculations.length;
    const totalInvoiceAmount = calculations.reduce((sum, c) => sum + (c.qbo_invoices?.total_amount ?? 0), 0);
    const totalCommissionableAmount = calculations.reduce((sum, c) => sum + c.commissionable_amount, 0);
    const totalCommissionAmount = calculations.reduce((sum, c) => sum + c.commission_amount, 0);

    const reportNumber = `CR-${Date.now()}`;

    const { data: report, error: reportError } = await supabase
      .from('commission_reports')
      .insert({
        report_number: reportNumber,
        sales_rep_id: salesRepId,
        commission_period_id: periodId,
        period_start: period?.start_date ?? new Date().toISOString().split('T')[0],
        period_end: period?.end_date ?? new Date().toISOString().split('T')[0],
        total_invoices: totalInvoices,
        total_invoice_amount: parseFloat(totalInvoiceAmount.toFixed(2)),
        total_commissionable_amount: parseFloat(totalCommissionableAmount.toFixed(2)),
        total_commission_amount: parseFloat(totalCommissionAmount.toFixed(2)),
        status: 'Draft'
      })
      .select()
      .single();

    if (reportError) throw reportError;

    const items = calculations.map(c => ({
      report_id: report.id,
      invoice_id: c.invoice_id,
      calculation_id: c.id,
      commissionable_amount: c.commissionable_amount,
      commission_rate: c.commission_rate,
      commission_amount: c.commission_amount,
      is_included: c.status !== 'Excluded'
    }));

    const { error: itemsError } = await supabase
      .from('commission_report_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return report;
  },

  async updateStatus(id, status, extra = {}) {
    const { data, error } = await supabase
      .from('commission_reports')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async approve(id, userId) {
    return commissionReportsService.updateStatus(id, 'Approved', {
      approved_by: userId,
      approved_at: new Date().toISOString()
    });
  },

  async reject(id, reason) {
    return commissionReportsService.updateStatus(id, 'Rejected', {
      rejection_reason: reason
    });
  },

  async markEmailed(id) {
    return commissionReportsService.updateStatus(id, 'Emailed', {
      emailed_at: new Date().toISOString()
    });
  },

  async updateBillComPayable(id, payableId) {
    return commissionReportsService.updateStatus(id, 'Paid', {
      billcom_payable_id: payableId
    });
  }
};

export const importBatchesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('qb_import_batches')
      .select('*, auth_user:imported_by(email)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  }
};
