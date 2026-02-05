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

  async syncOrders() {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stratus-orders`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
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
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stratus-confirmations`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
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
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-stratus-results`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
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
