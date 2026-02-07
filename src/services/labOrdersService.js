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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  },

  async syncOrders() {
    const headers = await this._getSyncHeaders();
    const response = await fetch('/.netlify/functions/sync-stratus-orders', {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to sync orders');
    }

    return await response.json();
  },

  async syncConfirmations() {
    const headers = await this._getSyncHeaders();
    const response = await fetch('/.netlify/functions/sync-stratus-confirmations', {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to sync confirmations');
    }

    return await response.json();
  },

  async syncResults() {
    const headers = await this._getSyncHeaders();
    const response = await fetch('/.netlify/functions/sync-stratus-results', {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to sync results');
    }

    return await response.json();
  },

  async syncAll() {
    const [ordersResult, confirmationsResult, resultsResult] = await Promise.allSettled([
      this.syncOrders(),
      this.syncConfirmations(),
      this.syncResults(),
    ]);

    return {
      orders: ordersResult.status === 'fulfilled' ? ordersResult.value : { error: ordersResult.reason },
      confirmations: confirmationsResult.status === 'fulfilled' ? confirmationsResult.value : { error: confirmationsResult.reason },
      results: resultsResult.status === 'fulfilled' ? resultsResult.value : { error: resultsResult.reason },
    };
  },

  async getOrderStats(facilityId) {
    const { data: orders, error: ordersError } = await supabase
      .from('lab_orders')
      .select('sync_status')
      .eq('facility_id', facilityId);

    const { data: results, error: resultsError } = await supabase
      .from('lab_results')
      .select('id')
      .eq('facility_id', facilityId);

    if (ordersError || resultsError) {
      throw ordersError || resultsError;
    }

    const stats = {
      total_orders: orders?.length || 0,
      pending: orders?.filter(o => o.sync_status === 'pending').length || 0,
      retrieved: orders?.filter(o => o.sync_status === 'retrieved').length || 0,
      acknowledged: orders?.filter(o => o.sync_status === 'acknowledged').length || 0,
      errors: orders?.filter(o => o.sync_status === 'error').length || 0,
      total_results: results?.length || 0,
    };

    return stats;
  }
};
