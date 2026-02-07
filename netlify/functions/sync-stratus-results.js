const STRATUS_BASE_URL = "https://novagen.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_12";
const STRATUS_PASSWORD = "a9943167-93f1";
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
    const listResponse = await stratusFetch(`${STRATUS_BASE_URL}/results`);
    if (!listResponse.ok) {
      throw new Error(`Failed to fetch results: ${listResponse.statusText}`);
    }

    const resultsData = await listResponse.json();
    console.log(`Found ${resultsData.result_count} pending results`);

    const processedResults = [];
    const errors = [];

    for (const guid of (resultsData.results || [])) {
      try {
        const existing = await supabaseSelect(
          'lab_results',
          `stratus_guid=eq.${encodeURIComponent(guid)}&select=id,sync_status,organization_id,facility_id`,
          userToken
        );
        const existingResult = existing?.[0];

        if (existingResult && existingResult.sync_status === 'acknowledged') {
          console.log(`Result ${guid} already acknowledged locally, re-ACKing on StratusDX to clear queue`);
          try {
            const reAckResponse = await stratusFetch(`${STRATUS_BASE_URL}/result/${guid}/ack`, 'POST');
            if (reAckResponse.ok) {
              console.log(`Re-ACK successful for result ${guid}`);
              processedResults.push({ guid, accessionNumber: null, status: 're-acknowledged' });
            } else {
              console.error(`Re-ACK failed for result ${guid}: ${reAckResponse.statusText}`);
              errors.push({ guid, error: `Re-ACK failed: ${reAckResponse.statusText}` });
            }
          } catch (reAckErr) {
            console.error(`Re-ACK error for result ${guid}: ${reAckErr.message}`);
            errors.push({ guid, error: `Re-ACK error: ${reAckErr.message}` });
          }
          continue;
        }

        const detailResponse = await stratusFetch(`${STRATUS_BASE_URL}/result/${guid}`);
        if (!detailResponse.ok) {
          throw new Error(`Failed to fetch result ${guid}: ${detailResponse.statusText}`);
        }

        const resultText = await detailResponse.text();
        let resultData;
        try {
          resultData = JSON.parse(resultText);
        } catch {
          resultData = { raw: resultText };
        }

        const accessionMatch = guid.match(/^(\d+)-/);
        const accessionNumber = accessionMatch ? accessionMatch[1] : null;

        let labOrderId = null;
        let organizationId = existingResult?.organization_id || null;
        let facilityId = existingResult?.facility_id || null;

        if (accessionNumber) {
          const linkedOrders = await supabaseSelect(
            'lab_orders',
            `accession_number=eq.${encodeURIComponent(accessionNumber)}&select=id,facility_id,organization_id&limit=1`,
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
          result_data: resultData,
          hl7_result: typeof resultData === 'string' ? resultData : null,
          sync_status: 'retrieved',
          retrieved_at: new Date().toISOString(),
          result_date: new Date().toISOString(),
        };

        if (existingResult) {
          await supabaseUpdate(
            'lab_results',
            `id=eq.${existingResult.id}`,
            record,
            userToken
          );
        } else {
          await supabaseInsert(
            'lab_results',
            { stratus_guid: guid, ...record },
            userToken
          );
        }

        const ackResponse = await stratusFetch(`${STRATUS_BASE_URL}/result/${guid}/ack`, 'POST');
        if (!ackResponse.ok) {
          errors.push({ guid, error: `Failed to ACK: ${ackResponse.statusText}` });
          continue;
        }

        await supabaseUpdate(
          'lab_results',
          `stratus_guid=eq.${encodeURIComponent(guid)}`,
          {
            sync_status: 'acknowledged',
            acknowledged_at: new Date().toISOString(),
          },
          userToken
        );

        processedResults.push({ guid, accessionNumber, status: 'success' });

      } catch (err) {
        console.error(`Error processing result ${guid}:`, err);
        errors.push({ guid, error: err.message });

        try {
          await supabaseUpdate(
            'lab_results',
            `stratus_guid=eq.${encodeURIComponent(guid)}`,
            { sync_status: 'error', sync_error: err.message },
            userToken
          );
        } catch (_) {}
      }
    }

    return respond(200, {
      success: true,
      message: 'Results sync completed',
      summary: {
        total: resultsData.result_count,
        processed: processedResults.length,
        errors: errors.length,
      },
      processedResults,
      errors,
    });

  } catch (error) {
    console.error('Error syncing results:', error);
    return respond(500, { error: 'Failed to sync results', details: error.message });
  }
};
