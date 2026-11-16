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
