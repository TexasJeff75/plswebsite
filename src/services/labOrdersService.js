import { supabase } from '../lib/supabase';

export const labOrdersService = {
  async getOrders(filters = {}) {
    let query = supabase
      .from('lab_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.facility_id) {
      query = query.eq('facility_id', filters.facility_id);
    }

    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters.sync_status) {
      query = query.eq('sync_status', filters.sync_status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async getOrderById(id) {
    const { data, error } = await supabase
      .from('lab_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getConfirmations(filters = {}) {
    let query = supabase
      .from('lab_order_confirmations')
      .select('*, lab_order:lab_orders(*)')
      .order('created_at', { ascending: false });

    if (filters.facility_id) {
      query = query.eq('facility_id', filters.facility_id);
    }

    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters.lab_order_id) {
      query = query.eq('lab_order_id', filters.lab_order_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async getResults(filters = {}) {
    let query = supabase
      .from('lab_results')
      .select('*, lab_order:lab_orders(*)')
      .order('result_date', { ascending: false });

    if (filters.facility_id) {
      query = query.eq('facility_id', filters.facility_id);
    }

    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters.lab_order_id) {
      query = query.eq('lab_order_id', filters.lab_order_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async getResultById(id) {
    const { data, error } = await supabase
      .from('lab_results')
      .select('*, lab_order:lab_orders(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrder(id, updates) {
    const { data, error } = await supabase
      .from('lab_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async linkOrderToFacility(orderId, facilityId, organizationId) {
    const { data, error } = await supabase
      .from('lab_orders')
      .update({
        facility_id: facilityId,
        organization_id: organizationId,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async _getSyncHeaders() {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) throw new Error('Your session has expired. Please refresh the page and sign in again.');
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  },

  async syncAll() {
    const headers = await this._getSyncHeaders();
    const response = await fetch('/.netlify/functions/sync-stratus', {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.details || errorJson.error || errorText;
      } catch {
        errorDetails = errorText;
      }
      throw new Error(errorDetails || 'Failed to sync');
    }

    return await response.json();
  },

  async syncOrders() {
    return this.syncAll();
  },

  async syncConfirmations() {
    return { success: true, message: 'Confirmations are now included in the unified sync' };
  },

  async syncResults() {
    return { success: true, message: 'Results are now included in the unified sync' };
  },

  async getOrderStats(facilityId) {
    const { data: orders, error: ordersError } = await supabase
      .from('lab_orders')
      .select('sync_status,order_status,processed_at_utc')
      .eq('facility_id', facilityId);

    const { data: results, error: resultsError } = await supabase
      .from('lab_results')
      .select('id,result_status,abnormal_flag,resulted_at_utc')
      .eq('facility_id', facilityId);

    if (ordersError || resultsError) {
      throw ordersError || resultsError;
    }

    const stats = {
      total_orders: orders?.length || 0,
      pending: orders?.filter(o => o.sync_status === 'pending').length || 0,
      retrieved: orders?.filter(o => o.sync_status === 'retrieved').length || 0,
      acknowledged: orders?.filter(o => o.sync_status === 'acknowledged').length || 0,
      synced: orders?.filter(o => o.sync_status === 'synced').length || 0,
      errors: orders?.filter(o => o.sync_status === 'error').length || 0,
      total_results: results?.length || 0,
      abnormal_results: results?.filter(r => r.abnormal_flag && r.abnormal_flag !== 'Normal').length || 0,
      finalized_results: results?.filter(r => r.result_status === 'Final' || r.result_status === 'finalized').length || 0,
    };

    return stats;
  }
};
