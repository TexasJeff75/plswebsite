const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STRATUS_TENANT_ID = process.env.STRATUS_TENANT_ID;
const STRATUS_API_CLIENT_ID = process.env.STRATUS_API_CLIENT_ID;
const STRATUS_CLIENT_ID = process.env.STRATUS_CLIENT_ID;
const STRATUS_CLIENT_SECRET = process.env.STRATUS_CLIENT_SECRET;

const STRATUS_BASE_URL = 'https://api.stratusdx.com';
const STRATUS_TOKEN_URL = `https://login.microsoftonline.com/${STRATUS_TENANT_ID}/oauth2/v2.0/token`;
const STRATUS_SCOPE = `${STRATUS_API_CLIENT_ID}/.default`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function supabaseAdminHeaders() {
  return {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseSelect(table, query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: supabaseAdminHeaders(),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Select ${table} failed: ${err}`);
  }
  return response.json();
}

async function supabaseUpsert(table, data, onConflict) {
  const headers = {
    ...supabaseAdminHeaders(),
    'Prefer': 'return=representation,resolution=merge-duplicates',
  };
  const url = onConflict
    ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
    : `${SUPABASE_URL}/rest/v1/${table}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upsert ${table} failed: ${err}`);
  }
  return response.json();
}

async function supabaseRpc(fnName, params) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: supabaseAdminHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`RPC ${fnName} failed: ${err}`);
  }
  return response.json();
}

async function getAccessToken() {
  const cached = await supabaseSelect(
    'stratus_token_cache',
    'select=access_token,expires_at'
  );

  if (cached?.[0]?.access_token && cached[0].expires_at) {
    const expiresAt = new Date(cached[0].expires_at).getTime();
    if (Date.now() < expiresAt - 60000) {
      console.log('[TOKEN] Using cached token, expires at', cached[0].expires_at);
      return cached[0].access_token;
    }
    console.log('[TOKEN] Cached token expired, requesting new one');
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: STRATUS_CLIENT_ID,
    client_secret: STRATUS_CLIENT_SECRET,
    scope: STRATUS_SCOPE,
  });

  const tokenResponse = await fetch(STRATUS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`OAuth token request failed (${tokenResponse.status}): ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabaseUpsert('stratus_token_cache', {
    id: 1,
    access_token: tokenData.access_token,
    token_type: tokenData.token_type || 'Bearer',
    expires_at: expiresAt,
    acquired_at: new Date().toISOString(),
  }, 'id');

  console.log('[TOKEN] New token acquired, expires at', expiresAt);
  return tokenData.access_token;
}

async function stratusApiFetch(path, token, method = 'GET') {
  const url = `${STRATUS_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  return response;
}

async function stratusFetchWithRetry(path, token) {
  let response = await stratusApiFetch(path, token);

  if (response.status === 401) {
    console.log('[API] Got 401, refreshing token and retrying');
    const newToken = await getAccessToken();
    response = await stratusApiFetch(path, newToken);
  }

  return response;
}

function extractPanels(orderData) {
  if (!orderData) return [];
  if (Array.isArray(orderData.panels)) return orderData.panels;
  if (Array.isArray(orderData.Panels)) return orderData.Panels;
  if (orderData.panels && typeof orderData.panels === 'object') {
    return Object.values(orderData.panels);
  }
  return [];
}

function extractPatientInitials(orderData) {
  if (!orderData) return null;
  const firstName = orderData.patientFirstName || orderData.PatientFirstName || '';
  const lastName = orderData.patientLastName || orderData.PatientLastName || '';
  if (firstName || lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || null;
  }
  return orderData.patientInitials || null;
}

async function findFacilityMapping(organizationName, locationName) {
  if (!organizationName && !locationName) return null;

  try {
    const result = await supabaseRpc('find_stratus_facility_mapping', {
      p_facility_identifier: locationName || organizationName,
      p_organization_identifier: organizationName || null,
    });
    if (result && result.length > 0) {
      return {
        organization_id: result[0].organization_id,
        facility_id: result[0].facility_id,
      };
    }
  } catch (err) {
    console.error('[MAPPING] find_stratus_facility_mapping error:', err.message);
  }
  return null;
}

async function processOrder(order, token) {
  const accessionId = order.accessionId || order.AccessionId || order.id;
  if (!accessionId) {
    console.warn('[ORDER] No accessionId found, skipping');
    return { status: 'skipped', reason: 'no accessionId' };
  }

  const organizationName = order.organizationName || order.OrganizationName || null;
  const locationName = order.locationName || order.LocationName || null;
  const providerName = order.providerName || order.ProviderName || order.orderingProviderName || null;
  const patientInitials = extractPatientInitials(order);
  const panels = extractPanels(order);
  const orderStatus = order.status || order.Status || order.orderStatus || null;
  const processedAtUtc = order.processedAtUtc || order.ProcessedAtUtc || null;

  let detailData = order;
  if (!order.panels && !order.Panels && !order.patientFirstName) {
    try {
      const detailResponse = await stratusFetchWithRetry(`/orders/${accessionId}`, token);
      if (detailResponse.ok) {
        detailData = await detailResponse.json();
      }
    } catch (err) {
      console.error(`[ORDER] Failed to fetch detail for ${accessionId}:`, err.message);
    }
  }

  const mapping = await findFacilityMapping(
    detailData.organizationName || organizationName,
    detailData.locationName || locationName
  );

  const record = {
    stratus_guid: accessionId,
    accession_id: accessionId,
    accession_number: accessionId,
    order_data: detailData,
    order_status: detailData.status || orderStatus,
    organization_name: detailData.organizationName || organizationName,
    location_name: detailData.locationName || locationName,
    provider_name: detailData.providerName || detailData.orderingProviderName || providerName,
    patient_initials: extractPatientInitials(detailData) || patientInitials,
    panels: extractPanels(detailData).length > 0 ? extractPanels(detailData) : panels,
    processed_at_utc: processedAtUtc,
    sync_status: 'synced',
    retrieved_at: new Date().toISOString(),
    organization_id: mapping?.organization_id || null,
    facility_id: mapping?.facility_id || null,
  };

  await supabaseUpsert('lab_orders', record, 'stratus_guid');

  await fetchResultsForOrder(accessionId, token, mapping);

  return { status: 'synced', accessionId };
}

async function fetchResultsForOrder(accessionId, token, mapping) {
  try {
    const resultsResponse = await stratusFetchWithRetry(`/orders/${accessionId}/results`, token);
    if (!resultsResponse.ok) {
      console.error(`[RESULTS] Failed for ${accessionId}: ${resultsResponse.status}`);
      return;
    }

    const resultsData = await resultsResponse.json();
    const results = Array.isArray(resultsData) ? resultsData : (resultsData.results || []);

    for (const result of results) {
      const resultRecord = {
        stratus_guid: `${accessionId}-${result.id || result.testId || Date.now()}`,
        accession_id: accessionId,
        accession_number: accessionId,
        lab_order_id: null,
        organization_id: mapping?.organization_id || null,
        facility_id: mapping?.facility_id || null,
        result_data: result,
        result_status: result.status || result.Status || null,
        abnormal_flag: result.abnormalFlag || result.AbnormalFlag || null,
        result_value: result.value || result.Value || null,
        reference_range: result.referenceRange || result.ReferenceRange || null,
        units: result.units || result.Units || null,
        resulted_at_utc: result.resultedAtUtc || result.ResultedAtUtc || null,
        result_date: result.resultedAtUtc ? new Date(result.resultedAtUtc).toISOString() : new Date().toISOString(),
        sync_status: 'synced',
        retrieved_at: new Date().toISOString(),
      };

      await supabaseUpsert('lab_results', resultRecord, 'stratus_guid');
    }
  } catch (err) {
    console.error(`[RESULTS] Error fetching results for ${accessionId}:`, err.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  try {
    if (!STRATUS_TENANT_ID || !STRATUS_CLIENT_ID || !STRATUS_CLIENT_SECRET || !STRATUS_API_CLIENT_ID) {
      return respond(500, { error: 'StratusDX OAuth environment variables not configured' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return respond(500, { error: 'Supabase service role key not configured' });
    }

    console.log('[SYNC] Starting StratusDX sync');
    const token = await getAccessToken();
    console.log('[SYNC] Token acquired');

    const checkpointData = await supabaseSelect(
      'stratus_sync_checkpoint',
      'select=last_processed_at_utc'
    );
    const lastProcessedAt = checkpointData?.[0]?.last_processed_at_utc;
    console.log('[SYNC] Last checkpoint:', lastProcessedAt || 'none (full sync)');

    const allOrders = [];
    let skip = 0;
    const top = 200;
    let hasMore = true;
    const MAX_PAGES = 50;

    for (let page = 0; page < MAX_PAGES && hasMore; page++) {
      let path = `/orders/recent?top=${top}&skip=${skip}`;
      if (lastProcessedAt) {
        path += `&since=${encodeURIComponent(lastProcessedAt)}`;
      }

      console.log(`[SYNC] Fetching page ${page + 1}: ${path}`);
      const response = await stratusFetchWithRetry(path, token);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Orders fetch failed (${response.status}): ${errText}`);
      }

      const pageData = await response.json();
      const orders = Array.isArray(pageData) ? pageData : (pageData.orders || pageData.value || []);

      console.log(`[SYNC] Page ${page + 1}: ${orders.length} orders`);

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      allOrders.push(...orders);
      skip += orders.length;

      if (orders.length < top) {
        hasMore = false;
      }
    }

    console.log(`[SYNC] Total orders to process: ${allOrders.length}`);

    const processed = [];
    const errors = [];
    let highestProcessedAt = lastProcessedAt ? new Date(lastProcessedAt) : null;

    for (const order of allOrders) {
      try {
        const result = await processOrder(order, token);
        processed.push(result);

        const orderProcessedAt = order.processedAtUtc || order.ProcessedAtUtc;
        if (orderProcessedAt) {
          const dt = new Date(orderProcessedAt);
          if (!highestProcessedAt || dt > highestProcessedAt) {
            highestProcessedAt = dt;
          }
        }
      } catch (err) {
        console.error(`[SYNC] Error processing order:`, err.message);
        errors.push({ error: err.message, accessionId: order.accessionId || order.id });
      }
    }

    const newCheckpoint = highestProcessedAt ? highestProcessedAt.toISOString() : null;
    const summary = {
      total_fetched: allOrders.length,
      total_processed: processed.length,
      errors: errors.length,
      new_checkpoint: newCheckpoint,
    };

    await supabaseUpsert('stratus_sync_checkpoint', {
      id: 1,
      last_processed_at_utc: newCheckpoint,
      last_sync_run_at: new Date().toISOString(),
      last_sync_summary: summary,
    }, 'id');

    console.log('[SYNC] Complete:', JSON.stringify(summary));

    return respond(200, {
      success: true,
      message: 'StratusDX sync completed',
      summary,
      processed,
      errors,
    });

  } catch (error) {
    console.error('[SYNC] Error:', error);
    return respond(500, { error: 'Sync failed', details: error.message });
  }
};
