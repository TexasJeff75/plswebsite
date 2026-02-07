const STRATUS_BASE_URL = "https://novagen.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_13";
const STRATUS_PASSWORD = "be917642-d7c6";
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
    const listResponse = await stratusFetch(`${STRATUS_BASE_URL}/order/received`);
    if (!listResponse.ok) {
      throw new Error(`Failed to fetch confirmations: ${listResponse.statusText}`);
    }

    const confirmationsData = await listResponse.json();
    console.log(`Found ${confirmationsData.result_count} pending confirmations`);

    const processedConfirmations = [];
    const errors = [];

    for (const guid of (confirmationsData.results || [])) {
      try {
        const existing = await supabaseSelect(
          'lab_order_confirmations',
          `stratus_guid=eq.${encodeURIComponent(guid)}&select=id,sync_status,organization_id,facility_id`,
          userToken
        );
        const existingConf = existing?.[0];

        if (existingConf && existingConf.sync_status === 'acknowledged') {
          console.log(`Confirmation ${guid} already acknowledged locally, re-ACKing on StratusDX to clear queue`);
          try {
            const reAckResponse = await stratusFetch(`${STRATUS_BASE_URL}/order/received/${guid}/ack`, 'POST');
            if (reAckResponse.ok) {
              console.log(`Re-ACK successful for confirmation ${guid}`);
              processedConfirmations.push({ guid, accessionNumber: null, status: 're-acknowledged' });
            } else {
              console.error(`Re-ACK failed for confirmation ${guid}: ${reAckResponse.statusText}`);
              errors.push({ guid, error: `Re-ACK failed: ${reAckResponse.statusText}` });
            }
          } catch (reAckErr) {
            console.error(`Re-ACK error for confirmation ${guid}: ${reAckErr.message}`);
            errors.push({ guid, error: `Re-ACK error: ${reAckErr.message}` });
          }
          continue;
        }

        const detailResponse = await stratusFetch(`${STRATUS_BASE_URL}/order/received/${guid}`);
        if (!detailResponse.ok) {
          throw new Error(`Failed to fetch confirmation ${guid}: ${detailResponse.statusText}`);
        }

        const confirmationText = await detailResponse.text();

        const receivedTimeMatch = confirmationText.match(/Received Time:(\d+)/);
        const accessionMatch = confirmationText.match(/Accession:(\d+)/);
        const hl7Match = confirmationText.match(/(MSH\|.*)/s);

        const receivedTime = receivedTimeMatch ? receivedTimeMatch[1] : null;
        const accessionNumber = accessionMatch ? accessionMatch[1] : null;
        const hl7Message = hl7Match ? hl7Match[1] : confirmationText;

        let labOrderId = null;
        let organizationId = existingConf?.organization_id || null;
        let facilityId = existingConf?.facility_id || null;

        if (accessionNumber) {
          const linkedOrders = await supabaseSelect(
            'lab_orders',
            `accession_number=eq.${encodeURIComponent(accessionNumber)}&select=id,organization_id,facility_id&limit=1`,
            userToken
          );
          const linkedOrder = linkedOrders?.[0];
          if (linkedOrder) {
            labOrderId = linkedOrder.id;
            organizationId = organizationId || linkedOrder.organization_id;
            facilityId = facilityId || linkedOrder.facility_id;
          }
        }

        const record = {
          lab_order_id: labOrderId,
          organization_id: organizationId,
          facility_id: facilityId,
          accession_number: accessionNumber,
          received_time: receivedTime,
          hl7_message: hl7Message,
          confirmation_data: { raw: confirmationText },
          sync_status: 'retrieved',
          retrieved_at: new Date().toISOString(),
        };

        if (existingConf) {
          await supabaseUpdate(
            'lab_order_confirmations',
            `id=eq.${existingConf.id}`,
            record,
            userToken
          );
        } else {
          await supabaseInsert(
            'lab_order_confirmations',
            { stratus_guid: guid, ...record },
            userToken
          );
        }

        const ackResponse = await stratusFetch(`${STRATUS_BASE_URL}/order/received/${guid}/ack`, 'POST');
        if (!ackResponse.ok) {
          errors.push({ guid, error: `Failed to ACK: ${ackResponse.statusText}` });
          continue;
        }

        await supabaseUpdate(
          'lab_order_confirmations',
          `stratus_guid=eq.${encodeURIComponent(guid)}`,
          {
            sync_status: 'acknowledged',
            acknowledged_at: new Date().toISOString(),
          },
          userToken
        );

        processedConfirmations.push({ guid, accessionNumber, status: 'success' });

      } catch (err) {
        console.error(`Error processing confirmation ${guid}:`, err);
        errors.push({ guid, error: err.message });

        try {
          await supabaseUpdate(
            'lab_order_confirmations',
            `stratus_guid=eq.${encodeURIComponent(guid)}`,
            { sync_status: 'error', sync_error: err.message },
            userToken
          );
        } catch (_) {}
      }
    }

    return respond(200, {
      success: true,
      message: 'Confirmation sync completed',
      summary: {
        total: confirmationsData.result_count,
        processed: processedConfirmations.length,
        errors: errors.length,
      },
      processedConfirmations,
      errors,
    });

  } catch (error) {
    console.error('Error syncing confirmations:', error);
    return respond(500, { error: 'Failed to sync confirmations', details: error.message });
  }
};
