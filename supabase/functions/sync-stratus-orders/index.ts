import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRATUS_BASE_URL = "https://testapi.stratusdx.net/interface";
const STRATUS_USERNAME = "novagen_stratusdx_11";
const STRATUS_PASSWORD = "9b910d57-49cb";

const MAX_BATCHES = 50;
const BATCH_SIZE = 5;
const CONCURRENT_LIMIT = 3;
const RETRY_DELAY_MS = 1000;

interface StratusOrdersResponse {
  status: string;
  total_count: number;
  result_count: number;
  results: string[];
}

interface StratusAckResponse {
  status: string;
  id: string;
  message: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processOrderWithRetry(
  guid: string,
  supabaseClient: any,
  headers: any,
  retries = 2
): Promise<{ guid: string; status: string; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data: existing } = await supabaseClient
        .from('lab_orders')
        .select('id, sync_status, organization_id, facility_id')
        .eq('stratus_guid', guid)
        .maybeSingle();

      if (existing && existing.sync_status === 'acknowledged') {
        console.log(`Order ${guid} already acknowledged, re-ACKing to clear queue`);
        const reAckResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}/ack`, {
          method: "POST",
          headers,
        });

        if (reAckResponse.ok) {
          return { guid, status: 're-acknowledged' };
        }
        throw new Error(`Re-ACK failed: ${reAckResponse.statusText}`);
      }

      console.log(`[${guid}] Retrieving order details...`);
      const detailResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}`, {
        method: "GET",
        headers,
      });

      if (!detailResponse.ok) {
        throw new Error(`Failed to fetch order: ${detailResponse.statusText}`);
      }

      const orderData = await detailResponse.json();

      let organizationId = existing?.organization_id;
      let facilityId = existing?.facility_id;

      if (!organizationId) {
        const facilityIdentifier = orderData.facility_name || orderData.facility_id || '';
        const orgIdentifier = orderData.organization_name || orderData.organization_id || '';

        if (facilityIdentifier) {
          const { data: mapping } = await supabaseClient
            .rpc('find_stratus_facility_mapping', {
              p_facility_identifier: facilityIdentifier,
              p_organization_identifier: orgIdentifier || null,
            });

          if (mapping && mapping.length > 0) {
            organizationId = mapping[0].organization_id;
            facilityId = mapping[0].facility_id;
            console.log(`[${guid}] Mapped to org: ${organizationId}, facility: ${facilityId}`);

            await supabaseClient
              .from('stratus_facility_mappings')
              .update({
                last_matched_at: new Date().toISOString(),
                match_count: supabaseClient.raw('match_count + 1'),
              })
              .eq('id', mapping[0].mapping_id);
          }
        }
      }

      const { error: upsertError } = await supabaseClient
        .from('lab_orders')
        .upsert({
          stratus_guid: guid,
          organization_id: organizationId,
          facility_id: facilityId,
          order_data: orderData,
          sync_status: 'retrieved',
          retrieved_at: new Date().toISOString(),
        }, {
          onConflict: 'stratus_guid',
          ignoreDuplicates: false
        });

      if (upsertError) {
        throw new Error(`Upsert failed: ${upsertError.message}`);
      }

      console.log(`[${guid}] Acknowledging order...`);
      const ackResponse = await fetch(`${STRATUS_BASE_URL}/order/${guid}/ack`, {
        method: "POST",
        headers,
      });

      if (!ackResponse.ok) {
        throw new Error(`Failed to ACK: ${ackResponse.statusText}`);
      }

      await supabaseClient
        .from('lab_orders')
        .update({
          sync_status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('stratus_guid', guid);

      console.log(`[${guid}] ✓ Successfully processed`);
      return { guid, status: 'success' };

    } catch (error) {
      console.error(`[${guid}] Attempt ${attempt + 1}/${retries + 1} failed:`, error.message);

      if (attempt < retries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      await supabaseClient
        .from('lab_orders')
        .upsert({
          stratus_guid: guid,
          sync_status: 'error',
          sync_error: error.message,
        }, {
          onConflict: 'stratus_guid',
          ignoreDuplicates: false
        });

      return { guid, status: 'error', error: error.message };
    }
  }

  return { guid, status: 'error', error: 'Max retries exceeded' };
}

async function processBatchConcurrently(
  guids: string[],
  supabaseClient: any,
  headers: any
): Promise<any[]> {
  const results = [];

  for (let i = 0; i < guids.length; i += CONCURRENT_LIMIT) {
    const chunk = guids.slice(i, i + CONCURRENT_LIMIT);
    const chunkResults = await Promise.all(
      chunk.map(guid => processOrderWithRetry(guid, supabaseClient, headers))
    );
    results.push(...chunkResults);

    if (i + CONCURRENT_LIMIT < guids.length) {
      await sleep(500);
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const basicAuth = btoa(`${STRATUS_USERNAME}:${STRATUS_PASSWORD}`);
    const headers = {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    };

    console.log("=== StratusDX Orders Sync Started ===");
    console.log(`Max batches: ${MAX_BATCHES} | Batch size: ${BATCH_SIZE} | Concurrent: ${CONCURRENT_LIMIT}`);

    const allResults = [];
    let batchNumber = 0;
    let totalProcessed = 0;
    let continueProcessing = true;

    while (continueProcessing && batchNumber < MAX_BATCHES) {
      batchNumber++;
      console.log(`\n--- Batch ${batchNumber} ---`);

      const listResponse = await fetch(`${STRATUS_BASE_URL}/orders`, {
        method: "GET",
        headers,
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to fetch orders: ${listResponse.statusText}`);
      }

      const ordersData: StratusOrdersResponse = await listResponse.json();
      console.log(`Queue status: ${ordersData.result_count} retrieved | ${ordersData.total_count} total in queue`);

      if (!ordersData.results || ordersData.results.length === 0 || ordersData.total_count === 0) {
        console.log("✓ Queue empty - no more records to process");
        continueProcessing = false;
        break;
      }

      const batchResults = await processBatchConcurrently(
        ordersData.results,
        supabaseClient,
        headers
      );

      allResults.push(...batchResults);
      totalProcessed += batchResults.length;

      const successCount = batchResults.filter(r => r.status === 'success' || r.status === 're-acknowledged').length;
      const errorCount = batchResults.filter(r => r.status === 'error').length;
      console.log(`Batch ${batchNumber} complete: ${successCount} success, ${errorCount} errors`);

      await sleep(1000);
    }

    const successful = allResults.filter(r => r.status === 'success' || r.status === 're-acknowledged');
    const errors = allResults.filter(r => r.status === 'error');

    console.log("\n=== Sync Complete ===");
    console.log(`Batches: ${batchNumber} | Processed: ${totalProcessed}`);
    console.log(`Success: ${successful.length} | Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order sync completed",
        summary: {
          batches: batchNumber,
          total_processed: totalProcessed,
          successful: successful.length,
          errors: errors.length,
        },
        results: allResults,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Fatal error syncing orders:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to sync orders",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
