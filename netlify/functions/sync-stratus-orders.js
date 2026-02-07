const STRATUS_BASE_URL = "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_11";
const STRATUS_PASSWORD = "9b910d57-49cb";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

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

async function stratusFetch(url, method = 'GET') {
  const basicAuth = Buffer.from(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`).toString('base64');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  return response;
}

function supabaseHeaders(userToken) {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': userToken,
    'Content-Type': 'application/json',
  };
}

async function supabaseSelect(table, query, userToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: supabaseHeaders(userToken),
  });
  return response.json();
}

async function supabaseInsert(table, data, userToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...supabaseHeaders(userToken), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Insert failed');
  }
  return response.json();
}

async function supabaseUpdate(table, query, data, userToken) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(userToken), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Update failed');
  }
  return response.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  const userToken = event.headers.authorization || event.headers.Authorization;
  if (!userToken) {
    return respond(401, { error: 'Authorization required' });
  }

  try {
    const processedOrders = [];
    const errors = [];
    let totalProcessed = 0;
    let batchNumber = 0;
    let continueProcessing = true;

    while (continueProcessing) {
      batchNumber++;
      console.log(`=== Batch ${batchNumber} ===`);

      const listResponse = await stratusFetch(`${STRATUS_BASE_URL}/orders`);
      if (!listResponse.ok) {
        throw new Error(`Failed to fetch orders: ${listResponse.statusText}`);
      }

      const ordersData = await listResponse.json();
      console.log(`Batch ${batchNumber}: ${ordersData.result_count} orders (queue: ${ordersData.total_count})`);

      if (!ordersData.results || ordersData.results.length === 0) {
        continueProcessing = false;
        break;
      }

      for (const guid of ordersData.results) {
        try {
          const existing = await supabaseSelect(
            'lab_orders',
            `stratus_guid=eq.${encodeURIComponent(guid)}&select=id,sync_status,organization_id,facility_id`,
            userToken
          );
          const existingOrder = existing?.[0];

          if (existingOrder && existingOrder.sync_status === 'acknowledged') {
            console.log(`Order ${guid} already acknowledged, skipping`);
            continue;
          }

          const detailResponse = await stratusFetch(`${STRATUS_BASE_URL}/order/${guid}`);
          if (!detailResponse.ok) {
            throw new Error(`Failed to fetch order ${guid}: ${detailResponse.statusText}`);
          }

          const orderData = await detailResponse.json();
          let organizationId = existingOrder?.organization_id || null;
          let facilityId = existingOrder?.facility_id || null;

          if (existingOrder) {
            await supabaseUpdate(
              'lab_orders',
              `id=eq.${existingOrder.id}`,
              {
                order_data: orderData,
                organization_id: organizationId,
                facility_id: facilityId,
                sync_status: 'retrieved',
                retrieved_at: new Date().toISOString(),
              },
              userToken
            );
          } else {
            await supabaseInsert(
              'lab_orders',
              {
                stratus_guid: guid,
                organization_id: organizationId,
                facility_id: facilityId,
                order_data: orderData,
                sync_status: 'retrieved',
                retrieved_at: new Date().toISOString(),
              },
              userToken
            );
          }

          const ackResponse = await stratusFetch(`${STRATUS_BASE_URL}/order/${guid}/ack`, 'POST');
          if (!ackResponse.ok) {
            errors.push({ guid, error: `Failed to ACK: ${ackResponse.statusText}` });
            continue;
          }

          await supabaseUpdate(
            'lab_orders',
            `stratus_guid=eq.${encodeURIComponent(guid)}`,
            {
              sync_status: 'acknowledged',
              acknowledged_at: new Date().toISOString(),
            },
            userToken
          );

          processedOrders.push({ guid, status: 'success', batch: batchNumber });
          totalProcessed++;

        } catch (err) {
          console.error(`Error processing order ${guid}:`, err);
          errors.push({ guid, error: err.message, batch: batchNumber });

          try {
            await supabaseUpdate(
              'lab_orders',
              `stratus_guid=eq.${encodeURIComponent(guid)}`,
              { sync_status: 'error', sync_error: err.message },
              userToken
            );
          } catch (_) {}
        }
      }

      if (ordersData.results.length >= ordersData.total_count) {
        continueProcessing = false;
      }
    }

    return respond(200, {
      success: true,
      message: 'Order sync completed',
      summary: {
        batches: batchNumber,
        total_processed: totalProcessed,
        successful: processedOrders.length,
        errors: errors.length,
      },
      processedOrders,
      errors,
    });

  } catch (error) {
    console.error('Error syncing orders:', error);
    return respond(500, { error: 'Failed to sync orders', details: error.message });
  }
};
