import { supabase } from '../lib/supabase';

export async function getLabOrders(filters = {}) {
  let query = supabase
    .from('lab_orders')
    .select(`
      *,
      organization:organizations(id, name),
      facility:facilities(id, name)
    `)
    .order('created_at', { ascending: false });

  if (filters.organizationId) {
    query = query.eq('organization_id', filters.organizationId);
  }

  if (filters.facilityId) {
    query = query.eq('facility_id', filters.facilityId);
  }

  if (filters.syncStatus) {
    query = query.eq('sync_status', filters.syncStatus);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getLabOrderById(id) {
  const { data, error } = await supabase
    .from('lab_orders')
    .select(`
      *,
      organization:organizations(id, name),
      facility:facilities(id, name),
      confirmations:lab_order_confirmations(id, stratus_guid, accession_number, received_time, sync_status, created_at),
      results:lab_results(id, stratus_guid, accession_number, result_status, result_date, sync_status, created_at)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLabConfirmations(filters = {}) {
  let query = supabase
    .from('lab_order_confirmations')
    .select(`
      *,
      order:lab_orders(id, stratus_guid, accession_number),
      organization:organizations(id, name),
      facility:facilities(id, name)
    `)
    .order('created_at', { ascending: false });

  if (filters.organizationId) {
    query = query.eq('organization_id', filters.organizationId);
  }

  if (filters.facilityId) {
    query = query.eq('facility_id', filters.facilityId);
  }

  if (filters.syncStatus) {
    query = query.eq('sync_status', filters.syncStatus);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getLabResults(filters = {}) {
  let query = supabase
    .from('lab_results')
    .select(`
      *,
      order:lab_orders(id, stratus_guid, accession_number),
      organization:organizations(id, name),
      facility:facilities(id, name)
    `)
    .order('created_at', { ascending: false });

  if (filters.organizationId) {
    query = query.eq('organization_id', filters.organizationId);
  }

  if (filters.facilityId) {
    query = query.eq('facility_id', filters.facilityId);
  }

  if (filters.syncStatus) {
    query = query.eq('sync_status', filters.syncStatus);
  }

  if (filters.resultStatus) {
    query = query.eq('result_status', filters.resultStatus);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getLabResultById(id) {
  const { data, error } = await supabase
    .from('lab_results')
    .select(`
      *,
      order:lab_orders(id, stratus_guid, accession_number, order_data),
      organization:organizations(id, name),
      facility:facilities(id, name)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateLabOrderStatus(id, status, errorMessage = null) {
  const updates = {
    sync_status: status,
    sync_error: errorMessage,
  };

  if (status === 'retrieved') {
    updates.retrieved_at = new Date().toISOString();
  } else if (status === 'acknowledged') {
    updates.acknowledged_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('lab_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getLabOrdersByAccessionNumber(accessionNumber) {
  const { data, error } = await supabase
    .from('lab_orders')
    .select(`
      *,
      organization:organizations(id, name),
      facility:facilities(id, name),
      confirmations:lab_order_confirmations(id, stratus_guid, received_time, sync_status),
      results:lab_results(id, stratus_guid, result_status, result_date, sync_status)
    `)
    .eq('accession_number', accessionNumber);

  if (error) throw error;
  return data;
}

export async function getStratusOrganizations() {
  const { data, error } = await supabase
    .from('stratus_organizations')
    .select('*')
    .eq('is_active', true)
    .order('organization_name');

  if (error) throw error;
  return data;
}

export async function getStratusTestMethods() {
  const { data, error } = await supabase
    .from('stratus_test_methods')
    .select('*')
    .eq('is_active', true)
    .order('test_method_name');

  if (error) throw error;
  return data;
}

export async function getLabDataStats(organizationId = null) {
  const filters = {};
  if (organizationId) {
    filters.organizationId = organizationId;
  }

  const [orders, confirmations, results] = await Promise.all([
    getLabOrders(filters),
    getLabConfirmations(filters),
    getLabResults(filters),
  ]);

  return {
    orders: {
      total: orders.length,
      pending: orders.filter(o => o.sync_status === 'pending').length,
      retrieved: orders.filter(o => o.sync_status === 'retrieved').length,
      acknowledged: orders.filter(o => o.sync_status === 'acknowledged').length,
      errors: orders.filter(o => o.sync_status === 'error').length,
    },
    confirmations: {
      total: confirmations.length,
      pending: confirmations.filter(c => c.sync_status === 'pending').length,
      retrieved: confirmations.filter(c => c.sync_status === 'retrieved').length,
      acknowledged: confirmations.filter(c => c.sync_status === 'acknowledged').length,
      errors: confirmations.filter(c => c.sync_status === 'error').length,
    },
    results: {
      total: results.length,
      pending: results.filter(r => r.sync_status === 'pending').length,
      retrieved: results.filter(r => r.sync_status === 'retrieved').length,
      acknowledged: results.filter(r => r.sync_status === 'acknowledged').length,
      errors: results.filter(r => r.sync_status === 'error').length,
    },
  };
}

export async function exploreStratusAPI(endpoint, method = 'GET', testParams = {}) {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explore-stratus-api`;
  const headers = {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoint,
      method,
      testParams,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to explore API');
  }

  return await response.json();
}
