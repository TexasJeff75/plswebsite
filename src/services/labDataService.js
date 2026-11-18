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

export async function assignOrderToFacility(orderId, organizationId, facilityId = null) {
  const updates = { organization_id: organizationId };
  if (facilityId) updates.facility_id = facilityId;
  const { data, error } = await supabase
    .from('lab_orders')
    .update(updates)
    .eq('id', orderId)
    .select('id, organization_id, facility_id')
    .single();
  if (error) throw error;
  return data;
}

export async function assignResultToFacility(resultId, organizationId, facilityId = null) {
  const updates = { organization_id: organizationId };
  if (facilityId) updates.facility_id = facilityId;
  const { data, error } = await supabase
    .from('lab_results')
    .update(updates)
    .eq('id', resultId)
    .select('id, organization_id, facility_id')
    .single();
  if (error) throw error;
  return data;
}

export async function assignConfirmationToFacility(confirmationId, organizationId, facilityId = null) {
  const updates = { organization_id: organizationId };
  if (facilityId) updates.facility_id = facilityId;
  const { data, error } = await supabase
    .from('lab_order_confirmations')
    .update(updates)
    .eq('id', confirmationId)
    .select('id, organization_id, facility_id')
    .single();
  if (error) throw error;
  return data;
}

export async function bulkAssignByAccession(accessionId, organizationId, facilityId = null) {
  const updates = { organization_id: organizationId };
  if (facilityId) updates.facility_id = facilityId;
  const [ordersRes, resultsRes, confirmationsRes] = await Promise.all([
    supabase.from('lab_orders').update(updates).eq('accession_number', accessionId).select('id'),
    supabase.from('lab_results').update(updates).eq('accession_number', accessionId).select('id'),
    supabase.from('lab_order_confirmations').update(updates).eq('accession_number', accessionId).select('id'),
  ]);
  const errors = [ordersRes.error, resultsRes.error, confirmationsRes.error].filter(Boolean);
  if (errors.length > 0) throw errors[0];
  const counts = {
    orders: ordersRes.data?.length || 0,
    results: resultsRes.data?.length || 0,
    confirmations: confirmationsRes.data?.length || 0,
  };

  if (counts.orders + counts.results + counts.confirmations === 0) {
    throw new Error('No records found for this accession');
  }

  return counts;
}

export async function getOrderPanels(orderId) {
  const { data, error } = await supabase
    .from('stratus_order_panels')
    .select('*')
    .eq('lab_order_id', orderId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getOrderTests(orderId) {
  const { data, error } = await supabase
    .from('stratus_order_tests')
    .select('*')
    .eq('lab_order_id', orderId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getOrderDiagnosisCodes(orderId) {
  const { data, error } = await supabase
    .from('stratus_order_diagnosis_codes')
    .select('*')
    .eq('lab_order_id', orderId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getOrderMedications(orderId) {
  const { data, error } = await supabase
    .from('stratus_order_medications')
    .select('*')
    .eq('lab_order_id', orderId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getOrderInsurance(orderId) {
  const { data, error } = await supabase
    .from('stratus_order_insurance')
    .select('*')
    .eq('lab_order_id', orderId)
    .order('insurance_type');
  if (error) throw error;
  return data;
}

export async function getResultObservations(resultId) {
  const { data, error } = await supabase
    .from('stratus_result_observations')
    .select('*')
    .eq('lab_result_id', resultId)
    .order('sort_order');
  if (error) throw error;
  return data;
}

// ---------- StratusDX Data Viewer (server-side filtering and paging) ----------

export const LAB_STATUSES = ['Pending', 'Pending Received', 'Final', 'Canceled', 'Rejected'];

// Which order date a date range applies to. The values are StratusDX compact
// strings (yyyyMMddHHmmss, US Central), which sort correctly as text.
export const LAB_DATE_FIELDS = {
  ordered: 'requisition_datetime',
  received: 'received_datetime',
  finalized: 'finalized_datetime',
};

const ORDER_LIST_COLUMNS = `
  id, stratus_guid, accession_id, accession_number, lab_status, order_status,
  patient_first_name, patient_last_name, location_name, organization_name,
  organization_id, facility_id, requisition_datetime, received_datetime, finalized_datetime,
  processed_at_utc, sync_status, sync_error,
  organization:organizations(id, name),
  facility:facilities(id, name)
`;

function compactDay(day, endOfDay) {
  return `${day.replaceAll('-', '')}${endOfDay ? '235959' : '000000'}`;
}

// filters: { search, dateField, from, to, unmappedOnly } (from/to as YYYY-MM-DD)
function applyOrderFilters(query, filters = {}) {
  const field = LAB_DATE_FIELDS[filters.dateField] || LAB_DATE_FIELDS.ordered;
  if (filters.from) query = query.gte(field, compactDay(filters.from, false));
  if (filters.to) query = query.lte(field, compactDay(filters.to, true));
  if (filters.unmappedOnly) query = query.is('facility_id', null);
  const term = (filters.search || '').replace(/[,()*%"'\\]/g, ' ').trim();
  if (term) {
    const like = `*${term}*`;
    query = query.or([
      `accession_id.ilike.${like}`,
      `patient_last_name.ilike.${like}`,
      `patient_first_name.ilike.${like}`,
      `location_name.ilike.${like}`,
      `organization_name.ilike.${like}`,
    ].join(','));
  }
  return query;
}

// One page of orders, newest first, with the total that match.
export async function searchLabOrders({ filters = {}, status = null, page = 0, pageSize = 50 } = {}) {
  let query = supabase.from('lab_orders').select(ORDER_LIST_COLUMNS, { count: 'exact' });
  query = applyOrderFilters(query, filters);
  if (status) query = query.eq('lab_status', status);
  const from = page * pageSize;
  const { data, error, count } = await query
    .order('requisition_datetime', { ascending: false, nullsFirst: false })
    .order('processed_at_utc', { ascending: false, nullsFirst: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: data || [], total: count || 0 };
}

// How many orders match the filters, per status, plus how many are unmapped.
export async function countLabOrders(filters = {}) {
  const head = (extra) => {
    let q = applyOrderFilters(supabase.from('lab_orders').select('id', { count: 'exact', head: true }), filters);
    return extra(q);
  };
  const results = await Promise.all([
    ...LAB_STATUSES.map((s) => head((q) => q.eq('lab_status', s))),
    head((q) => q),
    head((q) => q.is('facility_id', null)),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  const byStatus = {};
  LAB_STATUSES.forEach((s, i) => { byStatus[s] = results[i].count || 0; });
  return { byStatus, total: results[LAB_STATUSES.length].count || 0, unmapped: results[LAB_STATUSES.length + 1].count || 0 };
}

// All test results saved for an order.
export async function getOrderResultObservations(orderId) {
  const { data, error } = await supabase
    .from('stratus_result_observations')
    .select('*')
    .eq('lab_order_id', orderId)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

// Assigns an order and its results to an organization (and facility).
export async function assignOrderAndResults(orderId, organizationId, facilityId = null) {
  const updates = { organization_id: organizationId, facility_id: facilityId || null };
  const [orderRes, resultsRes] = await Promise.all([
    supabase.from('lab_orders').update(updates).eq('id', orderId).select('id').single(),
    supabase.from('lab_results').update(updates).eq('lab_order_id', orderId),
  ]);
  if (orderRes.error) throw orderRes.error;
  if (resultsRes.error) throw resultsRes.error;
  return orderRes.data;
}

// ---------- Facility Lab Orders tab (patient history and result reports) ----------

const FACILITY_ORDER_COLUMNS = `
  id, stratus_guid, accession_number, lab_status, patient_first_name, patient_last_name,
  patient_dob, provider_name, panels, requisition_datetime, received_datetime, finalized_datetime
`;

// Every order for a facility (light columns), newest first. Read in pages,
// since the API returns at most 1,000 rows per request.
export async function listFacilityOrders(facilityId, maxRows = 20000) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await supabase
      .from('lab_orders')
      .select(FACILITY_ORDER_COLUMNS)
      .eq('facility_id', facilityId)
      .order('requisition_datetime', { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

// All saved results for a set of orders, with each result's panel name.
export async function getObservationsForOrders(orderIds) {
  const ids = [...new Set(orderIds)].filter(Boolean);
  const out = [];
  for (let i = 0; i < ids.length; i += 25) {
    const batch = ids.slice(i, i + 25);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('stratus_result_observations')
        .select('id, lab_order_id, test_code, test_name, result_value, result_display, result_flag, result_uom, test_uom, is_abnormal, sort_order, panel:stratus_order_panels(panel_name)')
        .in('lab_order_id', batch)
        .order('sort_order')
        .range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []).map((o) => ({ ...o, panel_name: o.panel?.panel_name || null })));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}
