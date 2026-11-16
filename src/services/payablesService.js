import { supabase } from '../lib/supabase';

async function functionError(error) {
  // FunctionsHttpError keeps the response; surface the function's own message.
  try {
    const body = await error.context?.json();
    if (body?.error) return new Error(body.error);
  } catch {
    // fall through
  }
  return error;
}

export const payablesService = {
  async getFilterOptions() {
    const { data, error } = await supabase.rpc('ap_filter_options');
    if (error) throw error;
    return data;
  },

  async getSpendDashboard({ from, to, basis, vendorId, chartOfAccountId, departmentId, accountingClassId, locationId, groupBy }) {
    const { data, error } = await supabase.rpc('ap_spend_dashboard', {
      p_from: from,
      p_to: to,
      p_basis: basis,
      p_vendor_id: vendorId || null,
      p_chart_of_account_id: chartOfAccountId || null,
      p_department_id: departmentId || null,
      p_accounting_class_id: accountingClassId || null,
      p_location_id: locationId || null,
      p_group_by: groupBy,
    });
    if (error) throw error;
    return data;
  },

  async getVendorDetail(vendorId) {
    const { data, error } = await supabase.rpc('ap_vendor_detail', { p_vendor_id: vendorId });
    if (error) throw error;
    return data;
  },

  // Matches synced BILL payments to Pay Plan installments and updates statuses.
  async refreshPayPlans() {
    const { error } = await supabase.rpc('ap_refresh_pay_plans');
    if (error) throw error;
  },

  async getForecast() {
    const { data, error } = await supabase.rpc('ap_forecast');
    if (error) throw error;
    return data;
  },

  async getPayPlanView() {
    const { data, error } = await supabase.rpc('ap_pay_plan_view');
    if (error) throw error;
    return data;
  },

  async savePayPlan({ billId, planType, installments, notes }) {
    const { data, error } = await supabase.rpc('ap_save_pay_plan', {
      p_bill_id: billId,
      p_plan_type: planType,
      p_installments: installments,
      p_notes: notes || null,
    });
    if (error) throw error;
    return data;
  },

  // action: 'hold' | 'unhold' | 'review' | 'clear_review'. Returns { updated, skipped: [{ bill_id, reason }] }.
  async bulkUpdateBills(billIds, action, note) {
    const { data, error } = await supabase.rpc('ap_bulk_update_bills', { p_bill_ids: billIds, p_action: action, p_note: note || null });
    if (error) throw error;
    return data;
  },

  // Each bill gets one planned payment on plannedDate for what is still owed.
  async bulkPlanBills(billIds, plannedDate) {
    const { data, error } = await supabase.rpc('ap_bulk_plan_bills', { p_bill_ids: billIds, p_planned_date: plannedDate });
    if (error) throw error;
    return data;
  },

    async deletePayPlan(billId) {
    const { error } = await supabase.rpc('ap_delete_pay_plan', { p_bill_id: billId });
    if (error) throw error;
  },

  // Pass paymentId = null to unlink.
  async linkInstallment(installmentId, paymentId) {
    const { error } = await supabase.rpc('ap_link_installment', {
      p_installment_id: installmentId,
      p_payment_id: paymentId,
    });
    if (error) throw error;
  },

  async saveCashSettings({ startingCash, minCash }) {
    const { error } = await supabase.rpc('ap_save_settings', {
      p_starting_cash: startingCash === '' || startingCash === null ? null : Number(startingCash),
      p_min_cash: minCash === '' || minCash === null ? null : Number(minCash),
    });
    if (error) throw error;
  },

  // Weekly release (bill-pay function, separate full-access BILL app).
  async releaseCheck(installmentIds) {
    const { data, error } = await supabase.functions.invoke('bill-pay', { method: 'POST', body: { action: 'check', installmentIds } });
    if (error) throw await functionError(error);
    return data;
  },

  async releasePayments({ installmentIds, fundingAccountId, confirmLarge }) {
    const { data, error } = await supabase.functions.invoke('bill-pay', {
      method: 'POST',
      body: { action: 'release', installmentIds, fundingAccountId, confirmLarge },
    });
    if (error) throw await functionError(error);
    return data;
  },

  async getDefaultFundingAccount() {
    const { data, error } = await supabase.from('ap_settings').select('default_funding_account_id').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data?.default_funding_account_id || null;
  },

  async setDefaultFundingAccount(fundingAccountId) {
    const { error } = await supabase.rpc('ap_set_default_funding_account', { p_funding_account_id: fundingAccountId });
    if (error) throw error;
  },

  async cancelReleasedPayment(installmentId) {
    const { data, error } = await supabase.functions.invoke('bill-pay', { method: 'POST', body: { action: 'cancel', installmentId } });
    if (error) throw await functionError(error);
    return data;
  },

  // Removes all copied BILL data and pay plans (for switching sandbox to production).
  async clearBillData() {
    const { data, error } = await supabase.rpc('ap_clear_bill_data');
    if (error) throw error;
    return data;
  },

  // Runs the bill-sync function until it reports nothing left to copy.
  // A first sync of a large BILL account can take several rounds.
  async runSync(onProgress) {
    const totals = {};
    for (let round = 1; round <= 20; round++) {
      const { data, error } = await supabase.functions.invoke('bill-sync', { method: 'POST', body: {} });
      if (error) throw await functionError(error);
      for (const [key, n] of Object.entries(data?.counts || {})) totals[key] = (totals[key] || 0) + n;
      onProgress?.({ round, totals, more: !!data?.more });
      if (!data?.more) return { totals, status: data?.status };
    }
    return { totals, status: 'partial' };
  },
};
